import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyDatabaseDocsAnnotations, buildDatabaseDocsSnapshot, databaseDocsTableKey, editDatabaseDocsAnnotations, emptyDatabaseDocsAnnotations, exportDatabaseDocsDbml, exportDatabaseDocsMarkdown, validateDatabaseDocsAnnotations, type RelationalTableStructure } from '@fouc/shared';
import { collectDatabaseDocs, DatabaseDocsRepository } from './database-docs';
import { connectSqlite } from './drivers/sqlite';

function temporaryDirectory() { return mkdtempSync(path.join(os.tmpdir(),'fouc-docs-p0-')); }
function cleanup(directory:string) {
  Bun.gc(true);
  for (const name of readdirSync(directory)) { const file=path.resolve(directory,name); if (!file.startsWith(path.resolve(directory)+path.sep)) throw new Error('Unexpected temporary cleanup target'); unlinkSync(file); }
  rmdirSync(directory);
}
function table(schema:string,name:string):RelationalTableStructure {
  return { connectionId:'connection',provider:'postgres',schema,table:name,kind:'table',columns:[{name:'id',dataType:'bigint',isNullable:false,columnDefault:null,isPrimaryKey:true,isUnique:false,extra:null,comment:'Native ID',numericPrecision:64,numericScale:0,characterMaximumLength:null}],indexes:[],constraints:[],foreignKeys:[],triggers:[],properties:{comment:'Original database comment'},definition:{sql:`CREATE TABLE "${schema}"."${name}" (id bigint);`,origin:'native',warnings:[]} };
}

test('native SQLite documentation collects real composite foreign keys, both directions and full source without writes',async()=>{
  const directory=temporaryDirectory(), file=path.join(directory,'source.sqlite');
  const writer=new DatabaseSync(file);
  writer.exec(`CREATE TABLE parents(a INTEGER,b INTEGER,PRIMARY KEY(a,b));
    CREATE TABLE children(a INTEGER,b INTEGER,description TEXT DEFAULT 'a|b',PRIMARY KEY(a,b),FOREIGN KEY(a,b) REFERENCES parents(a,b) ON DELETE CASCADE);
    CREATE INDEX partial_description ON children(description) WHERE description IS NOT NULL;
    CREATE VIEW child_view AS SELECT a,b FROM children;
    CREATE TRIGGER trigger_note AFTER INSERT ON children BEGIN SELECT 'not executed'; END;`); writer.close();
  const driver=await connectSqlite({provider:'sqlite',path:file});
  try {
    const raw=await collectDatabaseDocs({provider:'sqlite',database:file,listTables:async schema=>(await driver.tables(schema)).map(object=>({...object,connectionId:'connection',database:file})),structure:async(schema,name)=>{const columns=await driver.columns(schema,name);return {...await driver.structure(schema,name,columns),provider:'sqlite',connectionId:'connection',columns};}},{schemas:['main']});
    expect(raw.tables).toHaveLength(3);expect(raw.relationships).toHaveLength(1);
    expect(raw.relationships[0]).toMatchObject({cardinality:'one-to-one',resolved:true,from:{table:'children',columns:['a','b']},to:{table:'parents',columns:['a','b']},onDelete:'CASCADE'});
    expect(raw.tables.some(table=>table.structure.kind==='trigger')).toBe(false);
    const markdown=exportDatabaseDocsMarkdown(raw).text;
    expect(markdown).toContain('→');expect(markdown).toContain('←');expect(markdown).toContain('CREATE TRIGGER trigger_note');expect(markdown).toContain('a\\|b');
    const dbml=exportDatabaseDocsDbml(raw);expect(dbml.text).toContain('("a", "b") [pk]');expect(dbml.text).toContain('.("a", "b") - ');
    expect(dbml.warnings.some(warning=>warning.item==='partial_description'&&warning.kind==='dbml-omitted')).toBe(true);
    expect(raw.warnings.some(warning=>warning.kind==='comments-unsupported')).toBe(true);
    expect((await driver.read('SELECT count(*) AS total FROM children','main',1)).rows[0][0]).toBe(0);
    const abort=new AbortController();abort.abort();await expect(collectDatabaseDocs({provider:'sqlite',database:file,listTables:async()=>[],structure:async()=>{throw new Error('not reached');}},{schemas:['main']},abort.signal)).rejects.toThrow();
  } finally {await driver.close();cleanup(directory);}
});

test('local prose preserves native comments, exact quoted identities and orphaned notes across scope changes',()=>{
  const one=table('a.b','Case'),other=table('a','b.Case'),lower=table('a.b','case');
  let annotations=emptyDatabaseDocsAnnotations();
  annotations=editDatabaseDocsAnnotations(annotations,{kind:'table-note',schema:'a.b',table:'Case',note:"# Local note\n\nhe said '''"});
  annotations=editDatabaseDocsAnnotations(annotations,{kind:'column-note',schema:'a.b',table:'Case',column:'deleted_column',note:'Preserve this prose'});
  const raw=buildDatabaseDocsSnapshot({provider:'postgres',database:'lab',structures:[one,other,lower]});
  const merged=applyDatabaseDocsAnnotations(raw,annotations);
  const target=merged.tables.find(table=>table.key===databaseDocsTableKey('a.b','Case'))!;
  expect(target.note.database).toBe('Original database comment');expect(target.note.local).toContain('Local note');expect(target.note.source).toBe('local');
  expect(merged.tables.filter(table=>table.note.local!==null)).toHaveLength(1);expect(merged.orphans[0].column).toBe('deleted_column');
  expect(raw.tables.every(table=>table.note.local===null)).toBe(true);
  const omitted=buildDatabaseDocsSnapshot({provider:'postgres',database:'lab',structures:[other]},annotations);
  expect(omitted.orphans[0]).toMatchObject({schema:'a.b',table:'Case',reason:'table-not-in-snapshot'});
  expect(annotations.tables[0].columns.deleted_column).toBe('Preserve this prose');
  const restored=applyDatabaseDocsAnnotations(raw,editDatabaseDocsAnnotations(annotations,{kind:'table-note',schema:'a.b',table:'Case',note:''}));
  expect(restored.tables.find(table=>table.key===target.key)!.note.effective).toBe('Original database comment');
  const dbml=exportDatabaseDocsDbml(merged).text;expect(dbml).toContain("he said \\'\\'\\'");
  expect(exportDatabaseDocsMarkdown(merged).text).toContain('**数据库原生注释**');expect(exportDatabaseDocsMarkdown(merged).text).toContain('**设备本地 Markdown 笔记**');
});

test('explicit external FK schema never resolves to a same-named table in another schema',()=>{
  const source=table('sales','orders'),wrong=table('sales','customers');
  source.foreignKeys=[{name:'customer_fk',nameSource:'catalog',columns:['id'],referencedSchema:'archive',referencedTable:'customers',referencedColumns:['id'],onUpdate:'NO ACTION',onDelete:'NO ACTION',match:'SIMPLE',deferrable:null,initiallyDeferred:null,validated:null,definition:null}];
  const snapshot=buildDatabaseDocsSnapshot({provider:'postgres',database:'lab',structures:[source,wrong]});
  expect(snapshot.relationships[0].resolved).toBe(false);expect(snapshot.relationships[0].to.schema).toBe('archive');
  expect(snapshot.warnings.some(warning=>warning.kind==='unresolved-reference')).toBe(true);expect(exportDatabaseDocsDbml(snapshot).text).not.toContain('Ref ');
  const resolved=buildDatabaseDocsSnapshot({provider:'postgres',database:'lab',structures:[source,table('archive','customers')]});
  resolved.relationships[0].onUpdate='UNKNOWN FROM CATALOG';
  const exported=exportDatabaseDocsDbml(resolved);
  expect(exported.text).not.toContain('update: unknown');expect(exported.text).toContain('delete: no action');
  expect(exported.warnings.some(warning=>warning.kind==='dbml-omitted'&&warning.item==='customer_fk')).toBe(true);
});

test('device notes persist with workspace/connection/database isolation, CAS, rejected payloads and connection cleanup',()=>{
  const directory=temporaryDirectory();let repo=new DatabaseDocsRepository(directory);
  try {
    const annotations=editDatabaseDocsAnnotations(emptyDatabaseDocsAnnotations(),{kind:'table-note',schema:'public',table:'records',note:'Persistent prose'});
    const state=repo.save('workspace-a','connection-a','lab',{version:null,annotations});expect(state.persistent).toBe(true);
    for (const [workspace,connection,database] of [['workspace-b','connection-a','lab'],['workspace-a','connection-b','lab'],['workspace-a','connection-a','other']]) expect(repo.get(workspace,connection,database).version).toBeNull();
    expect(()=>repo.save('workspace-a','connection-a','lab',{version:null,annotations})).toThrow('其他窗口');
    expect(()=>repo.save('workspace-a','connection-a','lab',{version:state.version,annotations:{...annotations,groups:[{id:'g',name:'Group',hue:360,note:null}]}})).toThrow();
    expect(repo.get('workspace-a','connection-a','lab').version).toBe(state.version);
    repo.close();repo=new DatabaseDocsRepository(directory);expect(repo.get('workspace-a','connection-a','lab').annotations.tables[0].note).toBe('Persistent prose');
    const next=repo.save('workspace-a','connection-a','lab',{version:state.version,annotations});expect(next.version).not.toBe(state.version);
    repo.deleteConnection('workspace-a','connection-a');expect(repo.get('workspace-a','connection-a','lab').version).toBeNull();
    expect(()=>validateDatabaseDocsAnnotations({...annotations,groups:[{id:'missing',name:'G',hue:22,note:null},{id:'missing',name:'Duplicate',hue:30,note:null}]})).toThrow();
    expect(()=>validateDatabaseDocsAnnotations({...annotations,tables:[{...annotations.tables[0],note:'界'.repeat(22000)}]})).toThrow('64 KiB');
  } finally {repo.close();cleanup(directory);}
});

test('catalog collection records denied objects and limits concurrent native structure work to four',async()=>{
  let running=0,peak=0;
  const snapshot=await collectDatabaseDocs({provider:'postgres',database:'lab',listTables:async schema=>Array.from({length:7},(_,i)=>({connectionId:'connection',database:'lab',schema,name:`table_${i}`,kind:'table' as const,comment:null})),structure:async(schema,name)=>{running++;peak=Math.max(peak,running);await new Promise(resolve=>setTimeout(resolve,1));running--;if(name==='table_2')throw new Error('permission denied');return table(schema,name);}},{schemas:['public']});
  expect(peak).toBeLessThanOrEqual(4);expect(snapshot.tables).toHaveLength(6);expect(snapshot.warnings).toContainEqual(expect.objectContaining({kind:'table-skipped',table:'public.table_2',message:'结构不可用：permission denied'}));
});
