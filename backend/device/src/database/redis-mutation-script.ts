/** DBX's guarded hash/ZSet edits, with ACL preflight and compensation for Redis's
 * non-rollback scripting semantics. The script and commands are server-owned. */
export const REDIS_SNAPSHOT_SCRIPT = `
local key = KEYS[1]
local kind = redis.call('TYPE', key).ok
if kind == 'none' then return {'none', '', '-2'} end
local size = redis.call('MEMORY', 'USAGE', key)
if size and size > tonumber(ARGV[1]) then return redis.error_reply('FOUC_LIMIT Key 超过当前 1 MiB 编辑上限') end
local expiry = redis.call('PEXPIRETIME', key)
if expiry > 9007199254740991 then return redis.error_reply('FOUC_LIMIT Key 过期时间超出当前精确编辑范围') end
local dump = redis.call('DUMP', key)
if not dump or #dump > tonumber(ARGV[1]) then return redis.error_reply('FOUC_LIMIT Key 无法取得有界编辑快照') end
return {kind, dump, string.format('%.0f', expiry)}
`;

export const REDIS_MUTATION_SCRIPT = `
local key = KEYS[1]
local kind = redis.call('TYPE', key).ok
local expected_type = ARGV[1]
local expected_dump = ARGV[2]
local expected_expiry = ARGV[3]
local action = ARGV[4]
local function fail(message) return redis.error_reply('FOUC_CONFLICT ' .. message) end
if kind ~= expected_type then return fail('Key 类型已变化或已过期，请刷新后重新编辑') end
if kind ~= 'none' then
  if redis.call('DUMP', key) ~= expected_dump or string.format('%.0f', redis.call('PEXPIRETIME', key)) ~= expected_expiry then
    return fail('Key 内容或过期时间已变化，请刷新后重新编辑')
  end
elseif action ~= 'create' then return fail('Key 已不存在') end
if action == 'create' and kind ~= 'none' then return fail('目标 Key 已存在') end
local count = tonumber(ARGV[5])
local commands = {}
local cursor = 6
for i = 1, count do
  local size = tonumber(ARGV[cursor]); cursor = cursor + 1
  local command = {}
  for j = 1, size do command[j] = ARGV[cursor]; cursor = cursor + 1 end
  commands[i] = command
end
local first = commands[1]
if action == 'rename' and redis.call('EXISTS', KEYS[2]) ~= 0 then return fail('新 Key 已存在，不能覆盖') end
if action == 'hash-add' and redis.call('HEXISTS', key, first[3]) ~= 0 then return fail('Hash 字段已存在') end
if action == 'hash-set' then
  local old = ARGV[cursor]
  if redis.call('HEXISTS', key, old) ~= 1 then return fail('原 Hash 字段已不存在') end
  if old ~= first[3] and redis.call('HEXISTS', key, first[3]) ~= 0 then return fail('新 Hash 字段已存在') end
  local expiry = redis.pcall('HPEXPIRETIME', key, 'FIELDS', 1, old)
  if type(expiry) == 'table' and expiry.err then
    if not string.find(string.lower(expiry.err), 'unknown command', 1, true) then return expiry end
  elseif type(expiry) == 'table' and tonumber(expiry[1]) > 0 then
    if tonumber(expiry[1]) > 9007199254740991 then return redis.error_reply('FOUC_LIMIT Hash 字段过期时间超出当前精确编辑范围') end
    commands[#commands + 1] = {'HPEXPIREAT', key, string.format('%.0f', expiry[1]), 'FIELDS', '1', first[3]}
  end
end
if action == 'hash-remove' and redis.call('HEXISTS', key, first[3]) ~= 1 then return fail('Hash 字段已不存在') end
if action == 'set-add' and redis.call('SISMEMBER', key, first[3]) ~= 0 then return fail('Set 成员已存在') end
if action == 'set-remove' and redis.call('SISMEMBER', key, first[3]) ~= 1 then return fail('Set 成员已不存在') end
if action == 'zset-add' and redis.call('ZSCORE', key, first[4]) ~= false then return fail('ZSet 成员已存在') end
if action == 'zset-set' then
  local old = ARGV[cursor]
  if redis.call('ZSCORE', key, old) == false then return fail('原 ZSet 成员已不存在') end
  if old ~= first[4] and redis.call('ZSCORE', key, first[4]) ~= false then return fail('新 ZSet 成员已存在') end
end
if action == 'zset-remove' and redis.call('ZSCORE', key, first[3]) == false then return fail('ZSet 成员已不存在') end
if action == 'list-set' or action == 'list-remove' then
  local length = redis.call('LLEN', key)
  if length > 10000 or tonumber(first[3]) >= length then return fail('List 索引已失效或超过当前编辑上限') end
  if action == 'list-remove' and redis.call('LPOS', key, first[4]) ~= false then return fail('List 删除标记冲突，请重试') end
end
if action == 'stream-remove' and #redis.call('XRANGE', key, first[3], first[3], 'COUNT', 1) ~= 1 then
  return fail('Stream 消息已不存在')
end
if action == 'expiry' and first[1] == 'PEXPIREAT' then
  local now = redis.call('TIME')
  if tonumber(first[3]) <= tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000) then
    return fail('指定过期时间已过去，请重新选择')
  end
end
if not redis.acl_check_cmd then return redis.error_reply('FOUC_PERMISSION 当前编辑流程需要 Redis 7 或更高版本') end
for _, command in ipairs(commands) do
  if not redis.acl_check_cmd(unpack(command)) then return redis.error_reply('FOUC_PERMISSION 缺少变更所需命令权限：' .. command[1]) end
end
local restore = nil
if #commands > 1 then
  restore = {'RESTORE', key, expected_expiry == '-1' and '0' or expected_expiry, expected_dump, 'REPLACE', 'ABSTTL'}
  if not redis.acl_check_cmd(unpack(restore)) then return redis.error_reply('FOUC_PERMISSION 多步编辑需要 RESTORE 权限以补偿执行错误') end
end
if ARGV[#ARGV] == 'preview' then return commands end
local result = 'OK'
for i, command in ipairs(commands) do
  local reply = redis.pcall(unpack(command))
  if type(reply) == 'table' and reply.err then
    if i > 1 then
      local restored = redis.pcall(unpack(restore))
      if type(restored) == 'table' and restored.err then return redis.error_reply('FOUC_UNKNOWN 编辑和补偿均失败，必须刷新核对 Key：' .. restored.err) end
    end
    return reply
  end
  result = type(reply) == 'table' and (reply.ok or 'OK') or tostring(reply)
end
return result
`;
