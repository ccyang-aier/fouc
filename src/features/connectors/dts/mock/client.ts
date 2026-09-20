import type {
  ConnectorConnectInteraction,
  ConnectorDetailDto,
  ConnectorInstance,
  DtsFilterDefinition,
  DtsFilterId,
  DtsTicketDetail,
  DtsTicketListInput,
  DtsTicketListResult,
} from '@fouc/shared'
import type { DtsConnectorClient } from '../api'
import { DTS_INSTANCE_ID, FILTER_NAMES, FILTER_TICKET_IDS, MOCK_NOW, MOCK_TICKETS } from './fixtures'

const TICKETS_BY_ID = new Map(MOCK_TICKETS.map((ticket) => [ticket.id, ticket]))

let connected = true

function instance(): ConnectorInstance {
  return {
    id: DTS_INSTANCE_ID,
    providerId: 'dts',
    name: 'DTS 个人工作台（Web Mock）',
    ownerType: 'user',
    ownerId: 'web-debugger',
    desiredState: 'enabled',
    authState: connected ? 'valid' : 'unconfigured',
    healthState: connected ? 'healthy' : 'unknown',
    executionState: 'online',
    executionTargetType: 'desktop_sidecar',
    executionTargetId: 'web-mock',
    config: { environment: 'mock', readOnly: true },
    identity: connected ? {
      externalId: 'mock-user-001',
      displayName: 'Web 调试账号',
      account: 'web.mock@example.test',
      tenantId: 'fouc-dev',
      verifiedAt: MOCK_NOW,
    } : null,
    connectedAt: connected ? MOCK_NOW - 86_400_000 : null,
    lastHeartbeatAt: connected ? MOCK_NOW - 32_000 : null,
    lastHeartbeatDurationMs: connected ? 186 : null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: MOCK_NOW - 7 * 86_400_000,
    updatedAt: MOCK_NOW,
  }
}

function detail(): ConnectorDetailDto {
  return {
    provider: {
      id: 'dts',
      name: 'DTS',
      description: '读取 DTS 工单、流程、关联关系与权限信息。',
      version: '1.0.0-mock',
      category: '研发协作',
      authMethods: ['managed_web_session'],
      targetTypes: ['desktop_sidecar'],
      capabilities: [
        { id: 'ticket.list', name: '查询工单', description: '按个人视图查询 DTS 工单', effect: 'read', approval: 'never', idempotent: true, traits: ['paginated'] },
        { id: 'ticket.get', name: '读取工单详情', description: '读取字段、流程和关联信息', effect: 'read', approval: 'never', idempotent: true, traits: [] },
      ],
    },
    instance: instance(),
    heartbeats: connected ? [
      { id: 3, instanceId: DTS_INSTANCE_ID, state: 'healthy', durationMs: 186, errorCode: null, createdAt: MOCK_NOW - 32_000 },
      { id: 2, instanceId: DTS_INSTANCE_ID, state: 'healthy', durationMs: 204, errorCode: null, createdAt: MOCK_NOW - 332_000 },
    ] : [],
    invocations: connected ? [
      { id: 'mock-invocation-1', instanceId: DTS_INSTANCE_ID, providerId: 'dts', capabilityId: 'ticket.list', status: 'succeeded', inputSummary: '待处理，第 1 页', resultSummary: '返回 4 条工单', errorCode: null, startedAt: MOCK_NOW - 28_000, endedAt: MOCK_NOW - 27_814, durationMs: 186 },
    ] : [],
  }
}

function listTickets(input: DtsTicketListInput): DtsTicketListResult {
  const ids = new Set(FILTER_TICKET_IDS[input.filter])
  const keyword = input.keyword?.trim().toLocaleLowerCase('zh-CN') ?? ''
  const matches = MOCK_TICKETS.filter((ticket) => {
    if (!ids.has(ticket.id)) return false
    if (!keyword) return true
    return [ticket.id, ticket.title, ticket.status, ticket.currentHandler, ticket.creator, ticket.remark]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('zh-CN').includes(keyword))
  })
  const start = Math.max(0, input.page - 1) * input.pageSize
  return {
    items: matches.slice(start, start + input.pageSize),
    total: matches.length,
    page: input.page,
    pageSize: input.pageSize,
    filter: input.filter,
  }
}

function getTicket(id: string): DtsTicketDetail {
  const ticket = TICKETS_BY_ID.get(id)
  if (!ticket) throw new Error(`Mock 工单不存在：${id}`)
  return ticket
}

export const dtsMockClient: DtsConnectorClient = {
  async detail(): Promise<ConnectorDetailDto> {
    return detail()
  },
  async connect(): Promise<ConnectorConnectInteraction> {
    connected = true
    return {
      interactionId: `web-mock-${Date.now()}`,
      kind: 'open_managed_web_session',
      url: 'https://dts.example.test/mock-login',
      expiresAt: Date.now() + 5 * 60_000,
    }
  },
  async disconnect(): Promise<ConnectorInstance> {
    connected = false
    return instance()
  },
  async heartbeat(): Promise<ConnectorInstance> {
    if (!connected) throw new Error('DTS Web Mock 尚未连接')
    return instance()
  },
  async filters(): Promise<DtsFilterDefinition[]> {
    return (Object.keys(FILTER_NAMES) as DtsFilterId[]).map((id) => ({ id, name: FILTER_NAMES[id], count: FILTER_TICKET_IDS[id].length }))
  },
  async tickets(input: DtsTicketListInput): Promise<DtsTicketListResult> {
    if (!connected) throw new Error('DTS Web Mock 尚未连接')
    return listTickets(input)
  },
  async ticket(id: string): Promise<DtsTicketDetail> {
    if (!connected) throw new Error('DTS Web Mock 尚未连接')
    return getTicket(id)
  },
}
