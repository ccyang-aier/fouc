import { splitSqlExecutionRanges, type RelationalProvider, type RelationalTableStructure } from '@fouc/shared';
import { isBinaryCell, jsonCell, jsonString, quoteExportIdentifier, sqlCell, textCell, textPieces, type DatabaseExportRow } from '@fouc/shared/database-export';
import { databaseExportGenerated, databaseExportMysqlGeometry } from './database-export-plan';

export function* databaseExportCsvHeader(structure: RelationalTableStructure): Generator<string> {
  for (let index = 0; index < structure.columns.length; index++) {
    if (index) yield ',';
    yield '"';
    for (const piece of textPieces(structure.columns[index].name)) yield piece.replaceAll('"', '""');
    yield '"';
  }
  yield '\r\n';
}

export function* databaseExportCsvRow(row: DatabaseExportRow, provider: RelationalProvider): Generator<string> {
  for (let index = 0; index < row.values.length; index++) {
    if (index) yield ',';
    const value = row.values[index];
    if (value === null) yield '\\N';
    else {
      // Quote every non-null value, including empty text and literal NULL sentinel.
      yield '"';
      for (const piece of textCell(value, provider, 'base64')) yield piece.replaceAll('"', '""');
      yield '"';
    }
  }
  yield '\r\n';
}

export function* databaseExportJsonRow(row: DatabaseExportRow, structure: RelationalTableStructure): Generator<string> {
  yield '{';
  for (let index = 0; index < row.values.length; index++) {
    if (index) yield ',';
    yield* jsonString(structure.columns[index].name);
    yield ':';
    yield* jsonCell(row.values[index], structure.provider, row.types[index]);
  }
  yield '}';
}

export function* databaseExportInsert(rows: DatabaseExportRow[], structure: RelationalTableStructure): Generator<string> {
  const provider = structure.provider;
  const quote = (name: string) => quoteExportIdentifier(name, provider);
  const columns = structure.columns.map((column, index) => ({ column, index })).filter(({ column }) => !databaseExportGenerated(column));
  if (!columns.length) {
    // An all-generated table still has row cardinality; native defaults recreate it.
    for (let index = 0; index < rows.length; index++) yield provider === 'mysql'
      ? `INSERT INTO ${quote(structure.schema)}.${quote(structure.table)} () VALUES ();\n`
      : `INSERT INTO ${quote(structure.schema)}.${quote(structure.table)} DEFAULT VALUES;\n`;
    return;
  }
  const overriding = provider === 'postgres' && columns.some(({ column }) => /\bidentity\b/i.test(column.extra ?? '')) ? ' OVERRIDING SYSTEM VALUE' : '';
  yield `INSERT INTO ${quote(structure.schema)}.${quote(structure.table)} (${columns.map(({ column }) => quote(column.name)).join(', ')})${overriding} VALUES\n`;
  for (let index = 0; index < rows.length; index++) {
    if (index) yield ',\n';
    yield '(';
    for (let field = 0; field < columns.length; field++) {
      if (field) yield ', ';
      const position = columns[field].index;
      const type = rows[index].types[position];
      const value = rows[index].values[position];
      if (provider === 'mysql' && databaseExportMysqlGeometry(type) && value !== null) {
        if (typeof value !== 'object' || Array.isArray(value) || value.type !== 'geometry' || typeof value.srid !== 'number' || !Number.isInteger(value.srid) || value.srid < 0 || value.srid > 0xffffffff || !isBinaryCell(value.wkb)) throw new Error('几何单元格缺少原生 WKB / SRID。');
        yield 'ST_GeomFromWKB(';
        yield* sqlCell(value.wkb, provider);
        yield `, ${value.srid})`;
        continue;
      }
      // REAL storage must remain REAL even in SQLite BLOB / untyped columns.
      if (provider === 'sqlite' && type === 'real') yield 'CAST(';
      yield* sqlCell(value, provider, type);
      if (provider === 'sqlite' && type === 'real') yield ' AS REAL)';
    }
    yield ')';
  }
  yield ';\n';
}

export function databaseExportDdl(structure: RelationalTableStructure): { before: string; after: string[]; } {
  if (!structure.definition.sql.trim()) throw new Error(`原生目录未提供 ${structure.schema}.${structure.table} 的结构定义，无法生成完整结构脚本。`);
  let before = structure.definition.sql.trim();
  const after: string[] = [];
  const postponed = new Set<string>();
  for (const trigger of structure.triggers) {
    const definition = trigger.definition.trim().replace(/;+\s*$/, '');
    if (!definition) throw new Error('原生触发器定义缺失，结构导出未继续。');
    // Delay actual trigger statements until after rows, never remove matching text
    // from a column comment or literal in native source.
    if (structure.provider === 'postgres') {
      const mode = trigger.enabled === 'DISABLED' ? 'DISABLE' : trigger.enabled === 'REPLICA' ? 'ENABLE REPLICA' : trigger.enabled === 'ALWAYS' ? 'ENABLE ALWAYS' : null;
      const alter = mode ? `ALTER TABLE ${quoteExportIdentifier(structure.schema, 'postgres')}.${quoteExportIdentifier(structure.table, 'postgres')} ${mode} TRIGGER ${quoteExportIdentifier(trigger.name, 'postgres')};` : '';
      postponed.add(definition);
      if (alter) postponed.add(alter.slice(0, -1));
      after.push(`${definition};\n${alter ? alter + '\n' : ''}`);
    } else if (structure.provider === 'mysql') {
      let delimiter = '$FOUC$';
      while (definition.includes(delimiter)) delimiter += '$';
      after.push(`USE ${quoteExportIdentifier(structure.schema, 'mysql')};\nDELIMITER ${delimiter}\n${definition}${delimiter}\nDELIMITER ;\n`);
    } else after.push(`${definition};\n`);
  }
  if (structure.provider === 'sqlite') {
    for (const index of structure.indexes) {
      if (index.definition) after.push(index.definition.trim().replace(/;+\s*$/, '') + ';\n');
    }
  }
  if (structure.provider === 'postgres' && postponed.size) before = splitSqlExecutionRanges(before, 'postgres')
    .filter(statement => !postponed.has(statement.sql.trim()))
    .map(statement => statement.sql.trim() + ';').join('\n\n');
  const context = structure.provider === 'mysql' ? `USE ${quoteExportIdentifier(structure.schema, 'mysql')};\n` : '';
  return { before: context + before.trim().replace(/;+\s*$/, '') + ';\n', after };
}
