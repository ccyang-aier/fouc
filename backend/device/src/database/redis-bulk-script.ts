/** Read helpers are shared by two server-owned scripts, never supplied by the HTTP caller. */
const READ = `
local max_safe = 9007199254740991
local function now_ms()
  local time = redis.call('TIME')
  return tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
end
local function exact(value) return string.format('%.0f', value) end
local function snapshot(key, limit)
  local kind = redis.call('TYPE', key).ok
  if kind == 'none' then return {'none', '', '-2'} end
  local usage = redis.call('MEMORY', 'USAGE', key)
  if usage and usage > limit then return {err='FOUC_LIMIT Key 超过 1 MiB 快照上限'} end
  local expiry = redis.call('PEXPIRETIME', key)
  if expiry > max_safe then return {err='FOUC_LIMIT 绝对过期时间超出精确比较范围'} end
  local dump = redis.call('DUMP', key)
  if not dump or #dump > limit then return {err='FOUC_LIMIT 无法取得有界原始 DUMP 快照'} end
  return {kind, dump, exact(expiry)}
end
local function command(action, key, value)
  if action == 'delete' then return {'DEL', key} end
  if action == 'persist' then return {'PERSIST', key} end
  if action == 'relative-ttl' then return {'PEXPIRE', key, value} end
  if action == 'absolute-ttl' then return {'PEXPIREAT', key, value} end
  return nil
end
`;

/** EVAL_RO makes the preview's zero-write boundary enforceable by Redis itself. */
export const REDIS_BULK_SNAPSHOT_SCRIPT = READ + `
if not redis.acl_check_cmd then return redis.error_reply('FOUC_LIMIT 批量预览需要 Redis 7 或更高版本') end
local action, value = ARGV[1], ARGV[2]
local now = now_ms()
if action == 'relative-ttl' and tonumber(value) > max_safe - now then
  return redis.error_reply('FOUC_LIMIT 执行后的绝对期限超出精确范围')
end
local rows, total = {}, 0
for i, key in ipairs(KEYS) do
  local row = snapshot(key, tonumber(ARGV[3]))
  if row.err then return redis.error_reply(row.err) end
  total = total + #row[2]
  if total > tonumber(ARGV[4]) then return redis.error_reply('FOUC_LIMIT 所选 Key 的 DUMP 合计超过 8 MiB') end
  local write = command(action, key, value)
  if not write or not redis.acl_check_cmd(unpack(write)) then
    return redis.error_reply('FOUC_PERMISSION Redis ACL 拒绝所选 Key 的批量命令')
  end
  rows[i] = row
end
local dangerous = action == 'delete' or (action == 'absolute-ttl' and tonumber(value) <= now)
return {exact(now), dangerous and '1' or '0', rows}
`;

/** One isolated Lua execution; all CAS/ACL guards precede all writes. Redis does not roll back script errors. */
export const REDIS_BULK_COMMIT_SCRIPT = READ + `
local action, value = ARGV[1], ARGV[2]
local now = now_ms()
local rows, snapshots, conflict, total = {}, {}, false, 0
local deadline_passed = action == 'absolute-ttl' and tonumber(value) <= now and ARGV[3] ~= '1'
local relative_overflow = action == 'relative-ttl' and tonumber(value) > max_safe - now
for i, key in ipairs(KEYS) do
  local current = snapshot(key, tonumber(ARGV[4]))
  local expected = 6 + (i - 1) * 3
  local reason = nil
  if current.err then reason = current.err
  else total = total + #current[2] end
  if not reason and total > tonumber(ARGV[5]) then
    rows[i] = {'conflict', '', '当前 DUMP 合计超过 8 MiB，未执行任何写入'}
    for j = i + 1, #KEYS do rows[j] = {'skipped', '', '快照上限阻止本批次，未读取或写入'} end
    return {'conflict', exact(now), rows}
  end
  if reason then
  elseif current[1] ~= ARGV[expected] then reason = 'Key 已过期、被创建或类型已变化'
  elseif current[2] ~= ARGV[expected + 1] then reason = '原始 DUMP 内容已变化'
  elseif current[3] ~= ARGV[expected + 2] then reason = '绝对过期时间已变化'
  elseif deadline_passed then reason = '绝对期限已过去，需重新预览并明确确认立即过期删除'
  elseif relative_overflow then reason = '执行后的绝对期限超出精确范围'
  else
    local write = command(action, key, value)
    if not redis.acl_check_cmd or not write or not redis.acl_check_cmd(unpack(write)) then reason = 'Redis ACL 已拒绝批量命令' end
  end
  snapshots[i] = current
  if reason then conflict = true; rows[i] = {'conflict', '', reason}
  else rows[i] = {'skipped', current[3], '其他 Key 冲突时整个批次不写入'} end
end
if conflict then return {'conflict', exact(now), rows} end
local failed = false
for i, key in ipairs(KEYS) do
  local current = snapshots[i]
  if failed then rows[i] = {'skipped', current[3], '前一个命令失败，未执行本项'}
  elseif current[1] == 'none' then rows[i] = {'missing', '-2', '预览与提交时均不存在，未写入'}
  elseif action == 'persist' and current[3] == '-1' then rows[i] = {'unchanged', '-1', '已经永久，无需改动'}
  else
    local reply = redis.pcall(unpack(command(action, key, value)))
    if type(reply) == 'table' and reply.err then
      failed = true; rows[i] = {'failed', current[3], reply.err}
    elseif tonumber(reply) ~= 1 then
      failed = true; rows[i] = {'unknown', '', '命令未返回预期确认，需刷新核对 Key'}
    else
      local expiry = redis.pcall('PEXPIRETIME', key)
      if type(expiry) == 'table' and expiry.err then rows[i] = {'applied', '', '写入已确认，但期限读取失败：' .. expiry.err}
      else rows[i] = {'applied', exact(expiry), ''} end
    end
  end
end
return {failed and 'partial' or 'complete', exact(now), rows}
`;
