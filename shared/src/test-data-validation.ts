import { z } from 'zod';
import type { DatabaseColumnInfo } from './database';
import type { RelationalTableStructure } from './relational-structure';
import { validateTableImportMappings } from './table-import';
import { testDataColumnFamily, testDataColumnLock, testDataNativeUnique } from './test-data-model';
import { testDataDecimalText, testDataScaledDecimal } from './test-data-random';
import { TEST_DATA_LIMITS, type TestDataConfig, type TestDataGenerator, type TestDataValidation } from './test-data-types';

const boundedString = z.string().max(4096);
const generatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: boundedString }).strict(),
  z.object({ kind: z.literal('sequence'), start: boundedString, step: boundedString }).strict(),
  z.object({ kind: z.literal('integer'), min: boundedString, max: boundedString }).strict(),
  z.object({ kind: z.literal('decimal'), min: boundedString, max: boundedString, scale: z.number().int().min(0).max(100) }).strict(),
  ...(['date', 'datetime', 'time'] as const).map(kind => z.object({ kind: z.literal(kind), start: boundedString, end: boundedString }).strict()),
  z.object({ kind: z.literal('uuid') }).strict(),
  z.object({ kind: z.literal('name') }).strict(),
  z.object({ kind: z.literal('email'), domain: z.string().min(1).max(190) }).strict(),
  z.object({ kind: z.literal('text'), length: z.number().int().min(1).max(4096) }).strict(),
  z.object({ kind: z.literal('enum'), values: z.array(boundedString).min(1).max(256) }).strict(),
]);

export const testDataConfigSchema = z.object({
  seed: z.string().min(1).max(200),
  rowCount: z.number().int().min(1).max(TEST_DATA_LIMITS.rows),
  columns: z.array(z.object({
    column: z.string().min(1).max(1024),
    enabled: z.boolean(),
    unique: z.boolean(),
    nullPercent: z.number().int().min(0).max(100),
    generator: generatorSchema,
  }).strict()).min(1).max(256),
}).strict();

export function testDataIntegerBounds(column: DatabaseColumnInfo, structure: RelationalTableStructure): [bigint, bigint] {
  const type = column.dataType.toLowerCase();
  const bits = structure.provider === 'sqlite' ? 64 : /tinyint/.test(type) ? 8 : /smallint|int2|smallserial/.test(type) ? 16 : /mediumint/.test(type) ? 24 : /bigint|int8|bigserial/.test(type) ? 64 : 32;
  const unsigned = /unsigned/i.test(`${type} ${column.extra ?? ''}`);
  return unsigned ? [0n, (1n << BigInt(bits)) - 1n] : [-(1n << BigInt(bits - 1)), (1n << BigInt(bits - 1)) - 1n];
}

export function testDataTemporalBound(value: string, kind: 'date' | 'datetime' | 'time', end = false): number {
  if (kind === 'time') {
    const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3]) > 59) throw new Error('时间必须为 00:00:00–23:59:59.999。');
    return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number((match[4] ?? '').padEnd(3, '0'));
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) {
    const date = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    if (Number(day[1]) < 1000 || new Date(date).toISOString().slice(0, 10) !== value) throw new Error('日期必须是真实的 1000–9999 年日历日期。');
    return date + (kind === 'datetime' && end ? 86_399_999 : 0);
  }
  if (kind !== 'datetime' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error('使用 YYYY-MM-DD 日期，或包含 Z 的 UTC 时间。');
  const date = Date.parse(value);
  if (!Number.isFinite(date) || value.slice(0, 4) < '1000' || new Date(date).toISOString() !== value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')) throw new Error('UTC 时间超出有效范围。');
  return date;
}

function numericLimits(column: DatabaseColumnInfo, structure: RelationalTableStructure, values: string[], scale: number): void {
  const family = testDataColumnFamily(column);
  for (const value of values) {
    const scaled = testDataScaledDecimal(value, scale);
    if (family === 'integer') {
      const integer = testDataScaledDecimal(value, 0);
      const [min, max] = testDataIntegerBounds(column, structure);
      if (integer < min || integer > max) throw new Error(`数值 ${value} 超出 ${column.dataType} 范围。`);
    }
    if (family === 'decimal') {
      if (column.numericScale !== null && scale > column.numericScale) throw new Error(`小数位超过字段的 ${column.numericScale} 位。`);
      if (column.numericPrecision !== null) {
        const allowedScale = column.numericScale ?? scale;
        const limit = 10n ** BigInt(column.numericPrecision);
        const nativeScaled = testDataScaledDecimal(value, allowedScale);
        if (nativeScaled <= -limit || nativeScaled >= limit) throw new Error(`数值 ${value} 超出字段 DECIMAL 精度。`);
      }
      if (/real|float|double/i.test(column.dataType) && !Number.isFinite(Number(value))) throw new Error('浮点数必须有限。');
    }
    if (scaled.toString().replace('-', '').length > 100) throw new Error('生成数值最多 100 位。');
  }
}

function validateGenerator(column: DatabaseColumnInfo, structure: RelationalTableStructure, generator: TestDataGenerator, count: number, unique: boolean): void {
  const family = testDataColumnFamily(column);
  const numeric = family === 'integer' || family === 'decimal';
  if (generator.kind === 'decimal' && family === 'integer' && generator.scale !== 0) throw new Error('整数列的小数位数必须为零。');
  if (['sequence', 'integer', 'decimal'].includes(generator.kind) && !numeric) throw new Error('数值生成器仅适用于数值字段。');
  if (['uuid', 'name', 'email', 'text'].includes(generator.kind) && !['text', 'uuid'].includes(family)) throw new Error('文字生成器仅适用于文字 / UUID 字段。');
  if (family === 'uuid' && !['uuid', 'constant', 'enum'].includes(generator.kind)) throw new Error('UUID 字段请选择 UUID 或有效的固定值。');
  if (['date', 'datetime', 'time'].includes(generator.kind) && generator.kind !== family) throw new Error('时间生成器须与字段的日期 / 时间类型一致。');

  if (generator.kind === 'sequence') {
    const scale = family === 'integer' ? 0 : column.numericScale ?? Math.max(generator.start.split('.')[1]?.length ?? 0, generator.step.split('.')[1]?.length ?? 0);
    const start = testDataScaledDecimal(generator.start, scale);
    const step = testDataScaledDecimal(generator.step, scale);
    if (unique && count > 1 && step === 0n) throw new Error('唯一字段的序列步长不能为零。');
    const last = start + BigInt(count - 1) * step;
    numericLimits(column, structure, [generator.start, testDataDecimalText(last, scale)], scale);
  } else if (generator.kind === 'integer' || generator.kind === 'decimal') {
    const scale = generator.kind === 'decimal' ? generator.scale : 0;
    const min = testDataScaledDecimal(generator.min, scale), max = testDataScaledDecimal(generator.max, scale);
    if (min > max) throw new Error('最小值不能大于最大值。');
    if (unique && max - min + 1n < BigInt(count)) throw new Error('数值范围容纳不了整批唯一值，请扩大范围或减少行数。');
    numericLimits(column, structure, [generator.min, generator.max], scale);
  } else if (generator.kind === 'date' || generator.kind === 'datetime' || generator.kind === 'time') {
    const min = testDataTemporalBound(generator.start, generator.kind), max = testDataTemporalBound(generator.end, generator.kind, true);
    if (min > max) throw new Error('开始时间不能晚于结束时间。');
    const capacity = generator.kind === 'date' ? Math.floor((max - min) / 86_400_000) + 1 : max - min + 1;
    if (unique && capacity < count) throw new Error('日期 / 时间范围容纳不了整批唯一值。');
    if (structure.provider === 'mysql' && /^timestamp/i.test(column.dataType) && (min < Date.parse('1970-01-01T00:00:01Z') || max > Date.parse('2038-01-19T03:14:07Z'))) throw new Error('MySQL TIMESTAMP 使用 1970–2038 的可移植范围。');
  } else if (generator.kind === 'email') {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(generator.domain)) throw new Error('请输入有效的邮箱域名，例如 example.test。');
  } else if (generator.kind === 'constant' || generator.kind === 'enum') {
    const values = generator.kind === 'enum' ? generator.values : [generator.value];
    if (unique && new Set(values).size < count) throw new Error('固定值 / 枚举的候选值数量不足以生成整批唯一值。');
    if (numeric) numericLimits(column, structure, values, family === 'integer' ? 0 : column.numericScale ?? 10);
    if (family === 'boolean' && values.some(value => !['true', 'false', '1', '0'].includes(value))) throw new Error('布尔候选值只能为 true / false / 1 / 0。');
    if (family === 'uuid' && values.some(value => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) throw new Error('请输入有效 UUID。');
    if (['date', 'datetime', 'time'].includes(family)) for (const value of values) testDataTemporalBound(value, family as 'date' | 'datetime' | 'time');
    if (column.enumValues?.length && values.some(value => !column.enumValues!.includes(value))) throw new Error('候选值不属于数据库原生 ENUM。');
    if (column.characterMaximumLength !== null && values.some(value => [...value].length > column.characterMaximumLength!)) throw new Error('固定值 / 枚举超过字段字符长度。');
  }
  const maxLength = column.characterMaximumLength;
  if (maxLength !== null) {
    const length = generator.kind === 'text' ? generator.length : generator.kind === 'uuid' ? 36 : generator.kind === 'name' ? 3 : generator.kind === 'email' ? 15 + generator.domain.length : 0;
    if (length > maxLength) throw new Error(`生成值超过字段最大 ${maxLength} 个字符。`);
  }
}

export function validateTestDataConfig(structure: RelationalTableStructure, value: unknown): TestDataValidation {
  const parsed = testDataConfigSchema.safeParse(value);
  const errors: TestDataValidation['errors'] = [];
  const warnings = ['仅检查本批生成数据的唯一性；已有行、排序规则、CHECK 与触发器由原生事务审查，冲突会拒绝整批。'];
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map(issue => ({ message: `${issue.path.join('.')}: ${issue.message}` })), warnings };
  const config: TestDataConfig = parsed.data;
  if (structure.kind !== 'table') errors.push({ message: '当前阶段仅支持真实表的追加生成。' });
  if (config.columns.length !== structure.columns.length) errors.push({ message: '字段配置必须与当前真实结构一一对应。' });
  const names = new Set<string>();
  for (const item of config.columns) {
    const column = structure.columns.find(target => target.name === item.column);
    if (!column || names.has(item.column)) { errors.push({ column: item.column, message: '字段不存在或重复。' }); continue; }
    names.add(item.column);
    if (!item.enabled) continue;
    const lock = testDataColumnLock(structure, column);
    if (lock) errors.push({ column: item.column, message: lock });
    if (item.nullPercent && !column.isNullable) errors.push({ column: item.column, message: '非空字段不能生成 NULL。' });
    if (!item.unique && testDataNativeUnique(structure, item.column)) errors.push({ column: item.column, message: '原生唯一字段必须保留唯一检查。' });
    try { validateGenerator(column, structure, item.generator, config.rowCount, item.unique); }
    catch (reason) { errors.push({ column: item.column, message: reason instanceof Error ? reason.message : String(reason) }); }
  }
  const active = config.columns.filter(item => item.enabled);
  if (active.length * config.rowCount > TEST_DATA_LIMITS.cells) errors.push({ message: '整批最多 100,000 个生成单元格，请减少行数或字段。' });
  const mapping = validateTableImportMappings(active.map(item => item.column), active.map(item => ({ sourceColumn: item.column, targetColumn: item.column })), structure.columns, structure.provider);
  errors.push(...mapping.errors.map(issue => ({ column: issue.targetColumn, message: issue.message })));
  if (structure.foreignKeys.length) warnings.push('外键字段不生成随机引用：允许省略的字段使用原生默认值；必填外键需先通过普通导入提供真实引用。');
  if (structure.triggers.length) warnings.push('表包含原生触发器，提交可能产生数据库定义的附加影响。');
  if (active.some(item => item.unique && item.nullPercent)) warnings.push('唯一字段的 NULL 语义由原生约束决定，NULLS NOT DISTINCT 等约束可能拒绝重复 NULL。');
  if (active.some(item => ['date', 'datetime', 'time'].includes(item.generator.kind))) warnings.push('时间按 UTC 生成；无时区列保存 UTC 墙上时间，数据库会话的时区规则仍适用。');
  if (active.some(item => /real|float|double/i.test(structure.columns.find(column => column.name === item.column)?.dataType ?? ''))) warnings.push('原生浮点字段会按数据库浮点精度存储，精确十进制文本不代表浮点结果精确。');
  if (structure.provider === 'sqlite' && active.some(item => testDataColumnFamily(structure.columns.find(column => column.name === item.column)!) === 'decimal')) warnings.push('SQLite 的 NUMERIC / REAL 亲和性可能转换并舍入小数；需要完全保留十进制词法时，请使用 TEXT 字段。');
  return { valid: errors.length === 0, errors, warnings };
}
