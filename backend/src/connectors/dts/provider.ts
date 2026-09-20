import tls from 'node:tls';
import type {
  ConnectorIdentity, ConnectorProviderDefinition, DtsFilterDefinition, DtsFilterId,
  DtsTicketDetail, DtsTicketListInput, DtsTicketListResult,
} from '@shared/index';
import { CookieJar, type CookieHandoff } from './cookie-jar';
import { listRows, listTotal, mapPermissions, mapRelations, mapTicketDetail, mapTicketSummary } from './mapper';

const ORIGIN = 'https://clouddragon.xfusion.com';
const BASE = `${ORIGIN}/dts/DTSPortal/v1`;
export const DTS_LOGIN_URL = `${ORIGIN}/dts/DTSPortal/workspace`;
const ALLOWED_FILTERS = new Set<DtsFilterId>(['myTodos', 'myProcessed', 'myCreate', 'myFollowed', 'myOverdue', 'ccToMe', 'closed', 'unclosed', 'cancel']);

export const DTS_PROVIDER: ConnectorProviderDefinition = {
  id: 'dts', name: 'DTS', category: '研发协作', version: '1.0.0',
  description: '通过当前设备安全读取 DTS 工单、流程、关联与权限信息。',
  authMethods: ['managed_web_session'], targetTypes: ['desktop_sidecar'],
  capabilities: [
    { id: 'dts.identity.get', name: '读取当前身份', description: '确认 DTS 登录身份', effect: 'read', approval: 'never', idempotent: true, traits: ['identity.read'] },
    { id: 'dts.filters.list', name: '读取个人视图', description: '读取当前账号可用的首页筛选器', effect: 'read', approval: 'never', idempotent: true, traits: ['work_item.filter.list'] },
    { id: 'dts.tickets.list', name: '查询工单', description: '按受控个人视图分页查询工单摘要', effect: 'read', approval: 'never', idempotent: true, traits: ['work_item.list'] },
    { id: 'dts.tickets.get', name: '读取工单详情', description: '读取工单详情和流程', effect: 'read', approval: 'never', idempotent: true, traits: ['work_item.read'] },
    { id: 'dts.tickets.relations', name: '读取工单关联', description: '读取工单关联引用', effect: 'read', approval: 'never', idempotent: true, traits: ['work_item.relations'] },
    { id: 'dts.tickets.permissions', name: '读取工单权限', description: '解释当前账号对工单的权限', effect: 'read', approval: 'never', idempotent: true, traits: ['work_item.permissions'] },
  ],
};

export class ConnectorError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
}

export class DtsRuntime {
  private readonly jar = new CookieJar();

  constructor(readonly instanceId: string) {}

  importCookies(cookies: CookieHandoff[]): void {
    // WebView handoff 是完整会话快照，必须替换而非合并，避免重新认证时残留旧 Cookie。
    this.jar.clear();
    this.jar.import(cookies);
  }
  clear(): void { this.jar.clear(); }
  get hasSession(): boolean { return this.jar.size > 0; }

  async identity(): Promise<ConnectorIdentity> {
    const result = await this.call('/getUserInfo', { method: 'GET' });
    const source = asObject(result);
    const account = deepText(source, ['account', 'userAccount', 'loginName', 'uid', 'userName', 'employeeNumber']);
    const displayName = deepText(source, ['displayName', 'userName', 'name', 'userCnName']);
    const externalId = deepText(source, ['userId', 'id', 'uid', 'employeeNumber', 'account']) ?? account;
    if (!externalId && !displayName) throw new ConnectorError('authentication_failed', 'DTS 未返回可确认的登录身份', 401);
    return { externalId: externalId ?? displayName!, displayName, account, tenantId: deepText(source, ['tenantId', 'enterpriseId']), verifiedAt: Date.now() };
  }

  async filters(): Promise<DtsFilterDefinition[]> {
    const result = asObject(await this.call('/ticketlist/getHomeFilters', { method: 'GET' }));
    const labels: Record<DtsFilterId, string> = { myTodos: '待处理', myProcessed: '曾处理', myCreate: '我创建', myFollowed: '我关注', myOverdue: '已逾期', ccToMe: '抄送我', closed: '已关闭', unclosed: '未关闭', cancel: '已撤销' };
    return [...ALLOWED_FILTERS].filter((id) => id in result).map((id) => {
      const raw = result[id];
      const countValue = typeof raw === 'number' ? raw : Number(asObject(raw).count ?? asObject(raw).total);
      return { id, name: labels[id], count: Number.isFinite(countValue) ? countValue : null };
    });
  }

  async list(input: DtsTicketListInput): Promise<DtsTicketListResult> {
    validateListInput(input);
    const result = await this.call('/ticketlist/listByVersionAndHead', {
      method: 'POST',
      body: JSON.stringify({ pageIndex: input.page, pageSize: input.pageSize, filterId: input.filter, conditions: [], keyword: input.keyword?.trim() ?? '', pbiId: '', storePbiId: '', orderBy: [], workBenchViewId: '', tableConditions: [], queryAction: 'WORKBENCH' }),
    });
    const rows = listRows(result);
    const items = rows.map((row) => mapTicketSummary(row, this.instanceId)).filter((value) => value != null);
    return { items, total: listTotal(result, items.length), page: input.page, pageSize: input.pageSize, filter: input.filter };
  }

  async detail(id: string): Promise<DtsTicketDetail> {
    validateTicketId(id);
    const [rawDetail, rawRelations, rawPermissions] = await Promise.all([
      this.call(`/getTicket?dtsNo=${encodeURIComponent(id)}`, { method: 'GET' }),
      this.call(`/ticket/getRelationTickets?dtsNo=${encodeURIComponent(id)}`, { method: 'GET' }),
      this.call('/ticket/getDtsPermit', { method: 'POST', body: JSON.stringify({ dtsNos: [id] }) }),
    ]);
    const detailObject = asObject(rawDetail);
    const seed = mapTicketSummary({ ...detailObject, dtsBizNo: id }, this.instanceId) ?? {
      id, title: id, status: '未知', severity: null, currentHandler: null, creator: null, createdAt: null,
      productType: null, productPath: [], remark: null, relatedCount: null, commentCount: null,
      source: { connectorInstanceId: this.instanceId, providerId: 'dts', objectType: 'ticket', externalId: id, url: null },
    };
    const relations = mapRelations(rawRelations, this.instanceId);
    return { ...mapTicketDetail(rawDetail, seed, this.instanceId), relatedCount: relations.length, relations, permissions: mapPermissions(rawPermissions) };
  }

  private async call(path: string, init: RequestInit): Promise<unknown> {
    if (!this.hasSession) throw new ConnectorError('authentication_required', 'DTS 需要登录', 401);
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}`;
    const response = await this.fetchWithRetry(url, init);
    const body = await response.text();
    if (response.headers.get('hw-ajax-redirect') || !body.trim()) throw new ConnectorError('session_expired', 'DTS 会话已失效', 401);
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { throw new ConnectorError('protocol_changed', 'DTS 返回了无法识别的响应'); }
    const envelope = asObject(parsed);
    if ('error' in envelope && envelope.error) throw new ConnectorError('remote_error', safeError(envelope.error));
    if (!('result' in envelope)) throw new ConnectorError('protocol_changed', 'DTS 响应缺少 result 字段');
    return envelope.result;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const cookie = this.jar.header(url);
        const response = await fetch(url, {
          ...init,
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
          headers: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json;charset=UTF-8', ...(cookie ? { cookie } : {}), ...init.headers },
          tls: { ca: tls.getCACertificates('system') },
        } as RequestInit);
        const headers = response.headers as Headers & { getSetCookie?: () => string[] };
        for (const value of headers.getSetCookie?.() ?? []) this.jar.setFromHeader(value, url);
        if (response.status >= 300 && response.status < 400) {
          throw new ConnectorError('session_expired', 'DTS 会话已失效', 401);
        }
        if ([502, 503, 504].includes(response.status) && attempt === 0) continue;
        if (response.status === 429) throw new ConnectorError('rate_limited', 'DTS 请求过于频繁，请稍后重试', 429);
        if (!response.ok) throw new ConnectorError('remote_error', `DTS 请求失败 (${response.status})`, response.status);
        return response;
      } catch (error) {
        last = error;
        if (error instanceof ConnectorError || attempt > 0) break;
      }
    }
    if (last instanceof ConnectorError) throw last;
    if (last instanceof DOMException && last.name === 'TimeoutError') throw new ConnectorError('timeout', 'DTS 请求超时', 504);
    throw new ConnectorError('network_unreachable', '无法连接 DTS，请检查公司网络或 VPN', 503);
  }
}

function validateListInput(input: DtsTicketListInput): void {
  if (!ALLOWED_FILTERS.has(input.filter)) throw new ConnectorError('invalid_input', '不允许的 DTS 筛选器');
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > 1000) throw new ConnectorError('invalid_input', 'page 必须是正整数');
  if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 50) throw new ConnectorError('invalid_input', 'pageSize 必须在 1–50 之间');
  if ((input.keyword?.length ?? 0) > 200) throw new ConnectorError('invalid_input', '搜索关键词过长');
}

function validateTicketId(id: string): void {
  if (!/^DTS[0-9A-Za-z_-]{4,64}$/.test(id)) throw new ConnectorError('invalid_input', 'DTS 工单号格式无效');
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function deepText(value: unknown, keys: string[]): string | null {
  const source = asObject(value);
  for (const key of keys) {
    const item = source[key];
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number') return String(item);
  }
  for (const nested of Object.values(source)) {
    if (nested && typeof nested === 'object') { const found = deepText(nested, keys); if (found) return found; }
  }
  return null;
}

function safeError(value: unknown): string {
  const source = asObject(value);
  return deepText(source, ['message', 'msg', 'errorMessage']) ?? 'DTS 返回业务错误';
}

export type { CookieHandoff };
