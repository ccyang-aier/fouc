/**
 * 可选的 DTS 线上只读验收。
 * 输入为 Tauri Cookie handoff 相同格式的 JSON 文件；不接受密码，也不输出 Cookie 或原始响应。
 */
import { readFile } from 'node:fs/promises';
import { DtsRuntime, type CookieHandoff } from '../src/connectors/dts/provider';

const cookieFile = process.env.DTS_COOKIE_FILE;
if (!cookieFile) throw new Error('Set DTS_COOKIE_FILE to a local CookieHandoff JSON file');
const cookies = JSON.parse(await readFile(cookieFile, 'utf8')) as CookieHandoff[];
const runtime = new DtsRuntime('dts-live-verification');
runtime.importCookies(cookies);

const identity = await runtime.identity();
const filters = await runtime.filters();
const list = await runtime.list({ filter: 'myTodos', page: 1, pageSize: 6 });
const detail = list.items[0] ? await runtime.detail(list.items[0].id) : null;

console.log(JSON.stringify({
  ok: true,
  identityConfirmed: Boolean(identity.externalId),
  filterIds: filters.map((item) => item.id),
  ticketCount: list.items.length,
  total: list.total,
  detail: detail ? { id: detail.id, fieldCount: detail.fields.length, flowNodeCount: detail.flowNodes.length, relationCount: detail.relations.length, permissionCount: detail.permissions.length } : null,
}, null, 2));
