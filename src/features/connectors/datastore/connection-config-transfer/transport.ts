import type { ExistingTransferConnection } from '@fouc/shared/connection-config-transfer-plan';
import type { TransferConnectionConfig } from '@fouc/shared/connection-config-transfer';
import { backendFetch } from '@/lib/backend';

function directory(
  workspaceId: string,
  provider: TransferConnectionConfig['provider'],
) {
  const family =
    provider === 'redis'
      ? 'redis'
      : provider === 'mongodb'
        ? 'mongo'
        : 'relational';
  return `/api/database/workspaces/${encodeURIComponent(workspaceId)}/${family}/connections`;
}
export async function readWorkspaceTransferConnections(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<ExistingTransferConnection[]> {
  const groups = await Promise.all(
    (['postgres', 'redis', 'mongodb'] as const).map((provider) =>
      backendFetch<ExistingTransferConnection[]>(
        directory(workspaceId, provider),
        { signal },
      ),
    ),
  );
  return groups.flat();
}
export async function saveTransferredConnection(
  workspaceId: string,
  entry: { name: string; config: TransferConnectionConfig },
  targetId?: string,
) {
  const base = directory(workspaceId, entry.config.provider);
  // No request abort: a completed atomic CRUD write must remain visible in the outcome summary.
  return backendFetch<ExistingTransferConnection>(
    `${base}${targetId ? `/${encodeURIComponent(targetId)}` : ''}`,
    { method: targetId ? 'PUT' : 'POST', body: JSON.stringify(entry) },
  );
}
