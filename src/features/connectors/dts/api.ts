import { backendFetch } from '@/lib/backend';
import { isBrowserMockEnabled } from '@/lib/browser-mocks';
import { createTranslator } from '@/lib/i18n';
import { createRuntimeClient, getTauriInvoke } from '@/lib/runtime-client';
import type {
  ConnectorConnectInteraction,
  ConnectorDetailDto,
  ConnectorInstance,
  DtsFilterDefinition,
  DtsTicketDetail,
  DtsTicketListInput,
  DtsTicketListResult,
} from '@fouc/shared';
import { createUiMessages } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/api';
const { error: uiError } = createUiMessages(unitMessages);

const DTS_INSTANCE_ID = 'dts-personal';

export interface DtsConnectorClient {
  detail(): Promise<ConnectorDetailDto>;
  connect(): Promise<ConnectorConnectInteraction>;
  disconnect(): Promise<ConnectorInstance>;
  heartbeat(): Promise<ConnectorInstance>;
  filters(): Promise<DtsFilterDefinition[]>;
  tickets(input: DtsTicketListInput): Promise<DtsTicketListResult>;
  ticket(id: string): Promise<DtsTicketDetail>;
}

const sidecarClient: DtsConnectorClient = {
  detail: () => backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}`),
  connect: () =>
    backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/connect`, { method: 'POST' }),
  disconnect: () =>
    backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/disconnect`, { method: 'POST' }),
  heartbeat: () =>
    backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/heartbeat`, { method: 'POST' }),
  filters: () => backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/filters`),
  tickets: (input) =>
    backendFetch(`/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  ticket: (id) =>
    backendFetch(
      `/api/connectors/instances/${DTS_INSTANCE_ID}/dts/tickets/${encodeURIComponent(id)}`,
    ),
};

const resolveClient = createRuntimeClient<DtsConnectorClient>({
  primary: sidecarClient,
  isMockEnabled: () => isBrowserMockEnabled('dts'),
  loadMock: async () => (await import('./mock/client')).dtsMockClient,
});

export const dtsConnectorApi: DtsConnectorClient = {
  detail: async () => (await resolveClient()).detail(),
  connect: async () => (await resolveClient()).connect(),
  disconnect: async () => (await resolveClient()).disconnect(),
  heartbeat: async () => (await resolveClient()).heartbeat(),
  filters: async () => (await resolveClient()).filters(),
  tickets: async (input) => (await resolveClient()).tickets(input),
  ticket: async (id) => (await resolveClient()).ticket(id),
};

export function isDtsWebMock(): boolean {
  return isBrowserMockEnabled('dts');
}

export async function openDtsAuthWindow(interaction: ConnectorConnectInteraction): Promise<void> {
  const invoke = getTauriInvoke();
  if (!invoke) {
    if (isDtsWebMock()) return;
    throw uiError('DTS 登录仅支持 Fouc 桌面端');
  }
  await invoke('open_dts_auth', {
    interactionId: interaction.interactionId,
    url: interaction.url,
    title: createTranslator(unitMessages)('登录 DTS'),
  });
}

export async function clearDtsAuthProfile(): Promise<void> {
  const invoke = getTauriInvoke();
  if (invoke) await invoke('clear_dts_auth_profile');
}
