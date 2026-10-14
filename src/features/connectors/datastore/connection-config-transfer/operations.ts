import { uiText } from '../../i18n/ui-message';

import { createTranslator, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './operations.messages';
import type {
  ConnectionConfigBundle,
  TransferConnectionConfig,
} from '@fouc/shared/connection-config-transfer';
import {
  prepareConnectionImport,
  type ExistingTransferConnection,
  type ImportConnectionChoice,
} from '@fouc/shared/connection-config-transfer-plan';
export type ConnectionImportOutcome = {
  index: number;
  name: string;
  provider: TransferConnectionConfig['provider'];
  status: 'pending' | 'saved' | 'failed' | 'skipped' | 'cancelled';
  error?: string;
};
export type ConnectionImportPort = {
  list: () => Promise<readonly ExistingTransferConnection[]>;
  save: (
    entry: {
      name: string;
      config: TransferConnectionConfig;
    },
    targetId?: string,
  ) => Promise<unknown>;
};
/** Cancellation stops subsequent mutations, while an in-flight CRUD request finishes and is reported. */
export async function runConnectionImport(
  {
    bundle,
    choices,
    port,
    signal,
    onProgress,
  }: {
    bundle: ConnectionConfigBundle;
    choices: readonly ImportConnectionChoice[];
    port: ConnectionImportPort;
    signal?: AbortSignal;
    onProgress?: (outcomes: readonly ConnectionImportOutcome[]) => void;
  },
  locale?: Locale,
): Promise<ConnectionImportOutcome[]> {
  const tConnector = createTranslator(connectorMessages, locale);
  signal?.throwIfAborted();
  const existing = await port.list();
  signal?.throwIfAborted();
  // Fresh complete validation happens before the first write, even after a successful preview.
  const plan = prepareConnectionImport(bundle, existing, choices);
  const outcomes: ConnectionImportOutcome[] = plan.operations.map((operation) => ({
    index: operation.index,
    name: operation.entry.name,
    provider: operation.entry.config.provider,
    status: operation.kind === 'skip' ? 'skipped' : 'pending',
  }));
  const publish = () => onProgress?.(outcomes.map((outcome) => ({ ...outcome })));
  publish();
  for (const operation of plan.operations) {
    if (operation.kind === 'skip') continue;
    const outcome = outcomes[operation.index];
    if (signal?.aborted) {
      outcome.status = 'cancelled';
      publish();
      continue;
    }
    try {
      await port.save(operation.entry, operation.targetId);
      outcome.status = 'saved';
    } catch (error) {
      outcome.status = 'failed';
      outcome.error =
        error instanceof Error
          ? uiText(error, locale ?? getLocale())
          : tConnector('couldNotSaveTheConnectionConfiguration');
    }
    publish();
  }
  return outcomes;
}
