import type { DatabaseColumnInfo } from '@fouc/shared';
import { defaultTestDataGenerator, type TestDataGenerator } from '@fouc/shared/test-data';
import styles from './test-data.module.css';

export const TEST_DATA_GENERATOR_LABELS: Record<TestDataGenerator['kind'], string> = {
  constant: '固定值', sequence: '精确序列', integer: '随机整数', decimal: '精确小数',
  date: '日期', datetime: '日期时间', time: '时间', uuid: 'UUID v4', name: '中文姓名',
  email: '邮箱', text: '随机文本', enum: '枚举候选值',
};

export function initialGenerator(kind: TestDataGenerator['kind'], column: DatabaseColumnInfo): TestDataGenerator {
  const native = defaultTestDataGenerator(column);
  if (native.kind === kind) return native;
  switch (kind) {
    case 'constant': return { kind, value: column.enumValues?.[0] ?? '' };
    case 'sequence': return { kind, start: '1', step: '1' };
    case 'integer': return { kind, min: '1', max: '1000' };
    case 'decimal': return { kind, min: '0', max: '100', scale: column.numericScale ?? 2 };
    case 'date': case 'datetime': return { kind, start: '2025-01-01', end: '2025-12-31' };
    case 'time': return { kind, start: '09:00:00', end: '18:00:00' };
    case 'email': return { kind, domain: 'example.test' };
    case 'text': return { kind, length: Math.min(column.characterMaximumLength ?? 24, 24) };
    case 'enum': return { kind, values: column.enumValues?.length ? [...column.enumValues] : ['选项 A', '选项 B'] };
    default: return { kind };
  }
}

export function GeneratorOptions({ generator, onChange }: { generator: TestDataGenerator; onChange: (value: TestDataGenerator) => void }) {
  const kind = generator.kind;
  return <div className={styles.parameters}>
    {kind === 'constant' && <label>固定内容<textarea aria-label="生成固定内容" value={generator.value} maxLength={4096} onChange={event => onChange({ ...generator, value: event.target.value })}/><small>空内容代表空字符串；NULL 使用字段的 NULL 比例配置。</small></label>}
    {kind === 'sequence' && <>
      <label>起始值<input aria-label="序列起始值" value={generator.start} onChange={event => onChange({ ...generator, start: event.target.value })}/></label>
      <label>步长<input aria-label="序列步长" value={generator.step} onChange={event => onChange({ ...generator, step: event.target.value })}/></label>
      <small>按完整行索引递增，使用整数缩放运算，保留 BIGINT / DECIMAL 精度。</small>
    </>}
    {(kind === 'integer' || kind === 'decimal') && <>
      <label>最小值<input aria-label="生成最小值" value={generator.min} onChange={event => onChange({ ...generator, min: event.target.value })}/></label>
      <label>最大值<input aria-label="生成最大值" value={generator.max} onChange={event => onChange({ ...generator, max: event.target.value })}/></label>
      {kind === 'decimal' && <label>小数位数<input aria-label="生成小数位数" type="number" min={0} max={100} value={generator.scale} onChange={event => onChange({ ...generator, scale: Number(event.target.value) })}/></label>}
      <small>范围包含两端；数字使用原始十进制文本，超出字段范围会阻止生成。</small>
    </>}
    {(kind === 'date' || kind === 'datetime' || kind === 'time') && <>
      <label>开始<input aria-label="生成开始时间" value={generator.start} onChange={event => onChange({ ...generator, start: event.target.value })}/></label>
      <label>结束<input aria-label="生成结束时间" value={generator.end} onChange={event => onChange({ ...generator, end: event.target.value })}/></label>
      <small>{kind === 'time' ? 'HH:mm:ss 或 HH:mm:ss.SSS，范围为一天内的 UTC 时间。' : 'YYYY-MM-DD；日期时间也可填写 YYYY-MM-DDTHH:mm:ss.SSSZ。日期形式的结束值包含当天。'}</small>
    </>}
    {kind === 'text' && <label>字符数<input aria-label="生成文本字符数" type="number" min={1} max={4096} value={generator.length} onChange={event => onChange({ ...generator, length: Number(event.target.value) })}/><small>使用英文字母和数字；不自动截断超出字段长度的值。</small></label>}
    {kind === 'email' && <label>邮箱域名<input aria-label="生成邮箱域名" value={generator.domain} onChange={event => onChange({ ...generator, domain: event.target.value })}/><small>默认 example.test，用于测试数据。</small></label>}
    {kind === 'enum' && <label>候选值，每行一个<textarea aria-label="生成枚举候选值" value={generator.values.join('\n')} maxLength={65536} onChange={event => onChange({ ...generator, values: event.target.value.split('\n') })}/><small>原生 ENUM 只接受真实候选值；空行保留为空字符串。</small></label>}
    {kind === 'uuid' && <p>根据种子生成 RFC 4122 UUID v4。版本位和变体位固定，样本与整批前段一致。</p>}
    {kind === 'name' && <p>生成三字中文姓名。候选集有界；需要大量唯一姓名时请使用其他字段承载唯一键。</p>}
  </div>;
}
