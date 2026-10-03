import type { DatabaseColumnInfo } from './database';
import type { RelationalTableStructure } from './relational-structure';
import { parseTableImport, type TableImportCell } from './table-import';
import { testDataColumnFamily } from './test-data-model';
import { TestDataRandom, testDataDecimalText, testDataScaledDecimal } from './test-data-random';
import { testDataConfigSchema, testDataTemporalBound, validateTestDataConfig } from './test-data-validation';
import { TEST_DATA_LIMITS, type TestDataColumnConfig, type TestDataConfig, type TestDataControl, type TestDataImport, type TestDataPreview } from './test-data-types';

const TEXT_ALPHABET = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
const FAMILY_NAMES = [...'赵钱孙李周吴郑王冯陈蒋沈韩杨朱秦许何吕张孔曹严华金魏陶姜'];
const GIVEN_NAMES = [...'安宁明宇思远晨曦子涵嘉欣文轩雨桐浩然若云诗雅泽林清和'];
const encoder = new TextEncoder();

function scalarCell(column: DatabaseColumnInfo, value: string): TableImportCell {
  const family = testDataColumnFamily(column);
  if (family === 'integer') return { kind: 'number', value: testDataScaledDecimal(value, 0).toString() };
  if (family === 'decimal') {
    const scale = column.numericScale ?? (value.split('.')[1]?.length ?? 0);
    return { kind: 'number', value: testDataDecimalText(testDataScaledDecimal(value, scale), scale) };
  }
  if (family === 'boolean') return { kind: 'boolean', value: ['true', '1'].includes(value) ? 'true' : 'false' };
  return { kind: 'text', value };
}

function uuid(random: TestDataRandom): string {
  const bytes = Array.from({ length: 16 }, () => Number(random.integer(0n, 255n)));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generateCell(structure: RelationalTableStructure, column: DatabaseColumnInfo, config: TestDataColumnConfig, random: TestDataRandom, index: number): TableImportCell {
  if (config.nullPercent && random.integer(0n, 99n) < BigInt(config.nullPercent)) return { kind: 'null' };
  const generator = config.generator;
  if (generator.kind === 'constant') return scalarCell(column, generator.value);
  if (generator.kind === 'enum') return scalarCell(column, random.pick(generator.values));
  if (generator.kind === 'sequence') {
    const scale = testDataColumnFamily(column) === 'integer' ? 0 : column.numericScale ?? Math.max(generator.start.split('.')[1]?.length ?? 0, generator.step.split('.')[1]?.length ?? 0);
    const value = testDataScaledDecimal(generator.start, scale) + BigInt(index) * testDataScaledDecimal(generator.step, scale);
    return { kind: 'number', value: testDataDecimalText(value, scale) };
  }
  if (generator.kind === 'integer' || generator.kind === 'decimal') {
    const scale = generator.kind === 'integer' ? 0 : generator.scale;
    return { kind: 'number', value: testDataDecimalText(random.integer(testDataScaledDecimal(generator.min, scale), testDataScaledDecimal(generator.max, scale)), scale) };
  }
  if (generator.kind === 'date' || generator.kind === 'datetime' || generator.kind === 'time') {
    const min = testDataTemporalBound(generator.start, generator.kind);
    const max = testDataTemporalBound(generator.end, generator.kind, true);
    const unit = generator.kind === 'date' ? 86_400_000 : 1;
    const value = min + Number(random.integer(0n, BigInt(Math.floor((max - min) / unit)))) * unit;
    const iso = new Date(value).toISOString();
    let text = generator.kind === 'date' ? iso.slice(0, 10) : generator.kind === 'time' ? iso.slice(11, 23) : iso;
    if (generator.kind === 'datetime' && (structure.provider === 'mysql' || (structure.provider === 'postgres' && !/with time zone|timestamptz/i.test(column.dataType)))) text = iso.slice(0, 23).replace('T', ' ');
    return { kind: 'text', value: text };
  }
  if (generator.kind === 'uuid') return { kind: 'text', value: uuid(random) };
  if (generator.kind === 'name') return { kind: 'text', value: random.pick(FAMILY_NAMES) + random.pick(GIVEN_NAMES) + random.pick(GIVEN_NAMES) };
  if (generator.kind === 'email') return { kind: 'text', value: `u${random.uint32().toString(36)}${index.toString(36)}@${generator.domain}` };
  return { kind: 'text', value: Array.from({ length: generator.length }, () => random.pick(TEXT_ALPHABET)).join('') };
}

function identity(column: DatabaseColumnInfo, cell: TableImportCell): string | null {
  if (cell.kind === 'null' || cell.kind === 'missing') return null;
  if (testDataColumnFamily(column) === 'uuid') return cell.value.toLowerCase();
  if (cell.kind === 'number') {
    const scale = column.numericScale ?? (cell.value.split('.')[1]?.length ?? 0);
    let canonical = testDataDecimalText(testDataScaledDecimal(cell.value, scale), scale);
    if (canonical.includes('.')) canonical = canonical.replace(/0+$/, '').replace(/\.$/, '');
    return `number:${canonical}`;
  }
  return `${cell.kind}:${cell.value}`;
}

function encodeCell(cell: TableImportCell): string {
  if (cell.kind === 'null' || cell.kind === 'missing') return 'null';
  return cell.kind === 'number' || cell.kind === 'boolean' || cell.kind === 'json' ? cell.value : JSON.stringify(cell.value);
}

/** DBX's chunk state and bounded uniqueness retry, with native metadata and exact cells. */
class GenerationState {
  readonly columns: DatabaseColumnInfo[];
  private readonly configs: TestDataColumnConfig[];
  private readonly randoms: TestDataRandom[];
  private readonly uniqueSets: Array<Set<string> | null>;
  private readonly tupleKeys: Array<{ positions: number[]; seen: Set<string>; name: string }>;
  bytes = 0;
  nextIndex = 0;

  constructor(private readonly structure: RelationalTableStructure, config: TestDataConfig) {
    const byName = new Map(config.columns.map(item => [item.column, item]));
    this.columns = structure.columns.filter(column => byName.get(column.name)?.enabled);
    this.configs = this.columns.map(column => byName.get(column.name)!);
    this.randoms = this.columns.map(column => new TestDataRandom(JSON.stringify([config.seed, structure.schema, structure.table, column.name])));
    this.uniqueSets = this.configs.map(item => item.unique ? new Set<string>() : null);
    const groups = structure.indexes.filter(index => index.unique && !index.predicate && index.parts.every(part => part.role !== 'key' || (part.column && part.prefixLength === null))).map(index => ({ name: index.name, columns: index.parts.filter(part => part.role === 'key').map(part => part.column!) }));
    for (const constraint of structure.constraints) if (constraint.kind === 'unique' || constraint.kind === 'primary') groups.push({ name: constraint.name, columns: constraint.columns });
    const primary = structure.columns.filter(column => column.isPrimaryKey).map(column => column.name);
    if (primary.length) groups.push({ name: 'PRIMARY', columns: primary });
    const used = new Set<string>();
    this.tupleKeys = groups.filter(group => group.columns.length > 1 && group.columns.every(name => this.columns.some(column => column.name === name))).flatMap(group => {
      const positions = group.columns.map(name => this.columns.findIndex(column => column.name === name));
      const key = JSON.stringify([...positions].sort((a, b) => a - b));
      if (used.has(key)) return [];
      used.add(key);
      return [{ positions, seen: new Set<string>(), name: group.name }];
    });
  }

  next(): string {
    for (let attempt = 0; attempt < TEST_DATA_LIMITS.attempts; attempt++) {
      const row = this.columns.map((column, index) => generateCell(this.structure, column, this.configs[index], this.randoms[index], this.nextIndex));
      const identities = row.map((cell, index) => identity(this.columns[index], cell));
      const tuples = this.tupleKeys.map(key => key.positions.some(position => identities[position] === null) ? null : JSON.stringify(key.positions.map(position => identities[position])));
      const duplicateColumn = identities.findIndex((value, index) => value !== null && this.uniqueSets[index]?.has(value));
      const duplicateTuple = tuples.findIndex((value, index) => value !== null && this.tupleKeys[index].seen.has(value));
      if (duplicateColumn >= 0 || duplicateTuple >= 0) continue;
      for (let index = 0; index < identities.length; index++) if (identities[index] !== null) this.uniqueSets[index]?.add(identities[index]!);
      for (let index = 0; index < tuples.length; index++) if (tuples[index] !== null) this.tupleKeys[index].seen.add(tuples[index]!);
      const line = '{' + row.map((cell, index) => JSON.stringify(this.columns[index].name) + ':' + encodeCell(cell)).join(',') + '}\n';
      this.bytes += encoder.encode(line).length;
      if (this.bytes > TEST_DATA_LIMITS.bytes) throw new Error('生成数据超过 5 MiB；请减少行数或文字长度。当前没有写入数据库。');
      this.nextIndex++;
      return line;
    }
    throw new Error(`第 ${this.nextIndex + 1} 行在 100 次尝试后仍无法满足本批唯一约束。请扩大范围、使用序列或减少行数；当前没有写入数据库。`);
  }
}

function prepare(structure: RelationalTableStructure, value: unknown): { config: TestDataConfig; state: GenerationState; warnings: string[] } {
  const validation = validateTestDataConfig(structure, value);
  if (!validation.valid) throw new Error(validation.errors.map(issue => `${issue.column ? issue.column + '：' : ''}${issue.message}`).join('\n'));
  const config: TestDataConfig = testDataConfigSchema.parse(value);
  return { config, state: new GenerationState(structure, config), warnings: validation.warnings };
}

export function generateTestDataPreview(structure: RelationalTableStructure, value: unknown): TestDataPreview {
  const { config, state, warnings } = prepare(structure, value);
  const sampleRows = Math.min(config.rowCount, TEST_DATA_LIMITS.sampleRows);
  const lines = Array.from({ length: sampleRows }, () => state.next());
  const parsed = parseTableImport(lines.join(''), { format: 'ndjson', jsonShape: 'objects', trimValues: false });
  parsed.totalRows = config.rowCount;
  return { parsed, warnings, sampleRows, targetRows: config.rowCount };
}

export async function buildTestDataImport(structure: RelationalTableStructure, value: unknown, control: TestDataControl = {}): Promise<TestDataImport> {
  const { config, state, warnings } = prepare(structure, value);
  const lines: string[] = [];
  for (let index = 0; index < config.rowCount; index++) {
    if (control.signal?.aborted) throw new DOMException('已取消本地生成，没有准备提交。', 'AbortError');
    lines.push(state.next());
    if ((index + 1) % 100 === 0 || index + 1 === config.rowCount) {
      control.onProgress?.(index + 1, config.rowCount);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
  if (control.signal?.aborted) throw new DOMException('已取消本地生成，没有准备提交。', 'AbortError');
  return {
    input: {
      schema: structure.schema,
      table: structure.table,
      text: lines.join(''),
      options: { format: 'ndjson', jsonShape: 'objects', trimValues: false, emptyStringAsNull: false },
      mappings: state.columns.map(column => ({ sourceColumn: column.name, targetColumn: column.name })),
    },
    warnings,
    rows: config.rowCount,
    bytes: state.bytes,
  };
}
