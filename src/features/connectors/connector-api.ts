import type {
  ConnectorConnectInteraction, ConnectorDetailDto, ConnectorInstance, DtsFilterDefinition,
  DtsTicketDetail, DtsTicketListInput, DtsTicketListResult,
} from '@fouc/shared'
import { backendFetch } from '@/lib/backend'

const DTS_INSTANCE_ID = 'dts-personal'

export const connectorApi = {
  detail: () => backendFetch<ConnectorDetailDto>(`/api/connectors/instances/${DTS_INSTANCE_ID}`),
  connect: () => backendFetch<ConnectorConnectInteraction>(`/api/connectors/instances/${DTS_INSTANCE_ID}/connect`, { method: 'POST' }),
  disconnect: () => backendFetch<ConnectorInstance>(`/api/connectors/instances/${DTS_INSTANCE_ID}/disconnect`, { method: 'POST' }),
  heartbeat: () => backendFetch<ConnectorInstance>(`/api/connectors/instances/${DTS_INSTANCE_ID}/heartbeat`, { method: 'POST' }),
  filters: () => backendFetch<DtsFilterDefinition[]>(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/filters`),
  tickets: (input: DtsTicketListInput) => backendFetch<DtsTicketListResult>(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  ticket: (id: string) => backendFetch<DtsTicketDetail>(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets/${encodeURIComponent(id)}`),
}

export async function openDtsAuthWindow(interaction: ConnectorConnectInteraction): Promise<void> {
  const tauri = (window as { __TAURI__?: { core?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__
  if (!tauri?.core?.invoke) throw new Error('DTS 登录仅支持 Fouc 桌面端')
  await tauri.core.invoke('open_dts_auth', { interactionId: interaction.interactionId, url: interaction.url })
}

export async function clearDtsAuthProfile(): Promise<void> {
  const tauri = (window as { __TAURI__?: { core?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__
  if (tauri?.core?.invoke) await tauri.core.invoke('clear_dts_auth_profile')
}
