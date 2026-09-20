import type {
  ConnectorConnectInteraction, ConnectorDetailDto, ConnectorInstance, DtsFilterDefinition,
  DtsTicketDetail, DtsTicketListInput, DtsTicketListResult,
} from '@fouc/shared'
import { backendFetch } from '@/lib/backend'

const DTS_INSTANCE_ID = 'dts-personal'

type TauriWindow = Window & { __TAURI__?: { core?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> } } }

function tauriInvoke() {
  if (typeof window === 'undefined') return undefined
  return (window as TauriWindow).__TAURI__?.core?.invoke
}

export function isDtsWebMock(): boolean {
  return typeof window !== 'undefined' && !tauriInvoke()
}

async function loadDtsMockApi() {
  return (await import('./dts-mock-api')).dtsMockApi
}

export const connectorApi = {
  detail: (): Promise<ConnectorDetailDto> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.detail()) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}`),
  connect: (): Promise<ConnectorConnectInteraction> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.connect()) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/connect`, { method: 'POST' }),
  disconnect: (): Promise<ConnectorInstance> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.disconnect()) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/disconnect`, { method: 'POST' }),
  heartbeat: (): Promise<ConnectorInstance> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.heartbeat()) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/heartbeat`, { method: 'POST' }),
  filters: (): Promise<DtsFilterDefinition[]> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.filters()) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/filters`),
  tickets: (input: DtsTicketListInput): Promise<DtsTicketListResult> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.tickets(input)) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  ticket: (id: string): Promise<DtsTicketDetail> => isDtsWebMock() ? loadDtsMockApi().then((api) => api.ticket(id)) : backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets/${encodeURIComponent(id)}`),
}

export async function openDtsAuthWindow(interaction: ConnectorConnectInteraction): Promise<void> {
  const invoke = tauriInvoke()
  if (!invoke) {
    if (isDtsWebMock()) return
    throw new Error('DTS 登录仅支持 Fouc 桌面端')
  }
  await invoke('open_dts_auth', { interactionId: interaction.interactionId, url: interaction.url })
}

export async function clearDtsAuthProfile(): Promise<void> {
  const invoke = tauriInvoke()
  if (invoke) await invoke('clear_dts_auth_profile')
}
