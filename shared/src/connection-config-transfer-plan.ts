import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import {
  validateConnectionConfigBundle,
  type ConnectionConfigBundle,
  type TransferConnection,
} from './connection-config-transfer';
export type ExistingTransferConnection = TransferConnection & {
  id: string;
  updatedAt: number;
};
export type ImportConnectionChoice =
  | {
      mode: 'skip';
    }
  | {
      mode: 'create';
      name: string;
    }
  | {
      mode: 'update';
      targetId: string;
    };
export type ImportConnectionOperation = {
  index: number;
  kind: 'create' | 'update' | 'skip';
  entry: TransferConnection;
  targetId?: string;
};
export type ConnectionImportPlan = {
  operations: ImportConnectionOperation[];
  create: number;
  update: number;
  skip: number;
};
function identity(provider: string, name: string) {
  return JSON.stringify([provider, name.normalize('NFKC').toLowerCase()]);
}
export function matchingTransferConnections(
  entry: TransferConnection,
  existing: readonly ExistingTransferConnection[],
): ExistingTransferConnection[] {
  const name = identity(entry.config.provider, entry.name);
  return existing.filter(
    (candidate) => identity(candidate.config.provider, candidate.name) === name,
  );
}
export function availableTransferName(
  entry: TransferConnection,
  existing: readonly TransferConnection[],
): string {
  const names = new Set(
    existing
      .filter((item) => item.config.provider === entry.config.provider)
      .map((item) => identity(item.config.provider, item.name)),
  );
  if (!names.has(identity(entry.config.provider, entry.name))) return entry.name;
  for (let count = 2; count <= 1000; count++) {
    const suffix = ` (${count})`,
      candidate = `${entry.name.slice(0, 120 - suffix.length)}${suffix}`;
    if (!names.has(identity(entry.config.provider, candidate))) return candidate;
  }
  throw new ValidationError(
    validationIssue(
      'connection-config-transfer-plan.tooManyConnectionsHaveTheSameNameEnter',
      '重名连接过多，请手动填写新的连接名称',
    ),
  );
}
export function defaultConnectionImportChoices(
  bundle: ConnectionConfigBundle,
  existing: readonly ExistingTransferConnection[],
): ImportConnectionChoice[] {
  const reserved: TransferConnection[] = [...existing];
  return bundle.connections.map((entry) => {
    const name = availableTransferName(entry, reserved);
    reserved.push({ ...entry, name });
    return { mode: 'create', name };
  });
}
/** Validate every choice before producing a single write; conflicts never trigger automatic update. */
export function prepareConnectionImport(
  bundle: ConnectionConfigBundle,
  existing: readonly ExistingTransferConnection[],
  choices: readonly ImportConnectionChoice[],
): ConnectionImportPlan {
  const valid = validateConnectionConfigBundle(bundle);
  if (choices.length !== valid.connections.length)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-plan.importSelectionDoesNotMatchTheValidatedConfiguration',
        '导入选择与已校验配置数量不一致',
      ),
    );
  const names = new Set(existing.map((entry) => identity(entry.config.provider, entry.name))),
    updates = new Set<string>();
  const operations = valid.connections.map((entry, index): ImportConnectionOperation => {
    const choice = choices[index];
    if (choice.mode === 'skip') return { index, kind: 'skip', entry };
    if (choice.mode === 'update') {
      const target = existing.find((item) => item.id === choice.targetId);
      if (
        !target ||
        target.config.provider !== entry.config.provider ||
        !matchingTransferConnections(entry, [target]).length
      )
        throw new ValidationError(
          validationIssue(
            'connection-config-transfer-plan.itemHasAnInvalidUpdateTargetOrIts',
            '第 {p0} 项更新目标无效或名称已变化，请重新审查',
            { p0: validationValue(index + 1) },
          ),
        );
      if (updates.has(target.id))
        throw new ValidationError(
          validationIssue(
            'connection-config-transfer-plan.oneExistingConnectionCannotBeUpdatedRepeatedlyIn',
            '同一现有连接不能在一次导入中被重复更新',
          ),
        );
      updates.add(target.id);
      return {
        index,
        kind: 'update',
        entry: { ...entry, name: target.name },
        targetId: target.id,
      };
    }
    if (
      choice.mode !== 'create' ||
      typeof choice.name !== 'string' ||
      !choice.name.trim() ||
      choice.name.trim().length > 120 ||
      /[\r\n\0]/u.test(choice.name)
    )
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer-plan.itemHasAnInvalidImportName',
          '第 {p0} 项导入名称无效',
          { p0: validationValue(index + 1) },
        ),
      );
    const name = choice.name.trim(),
      key = identity(entry.config.provider, name);
    if (names.has(key))
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer-plan.connectionStillHasANameConflictSkipIt',
          '连接「{p0}」名称仍有冲突，请选择跳过、改名或明确更新',
          { p0: validationValue(name) },
        ),
      );
    names.add(key);
    return { index, kind: 'create', entry: { ...entry, name } };
  });
  return {
    operations,
    create: operations.filter((entry) => entry.kind === 'create').length,
    update: operations.filter((entry) => entry.kind === 'update').length,
    skip: operations.filter((entry) => entry.kind === 'skip').length,
  };
}
