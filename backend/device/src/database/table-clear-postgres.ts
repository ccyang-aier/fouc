import { createHash } from 'node:crypto';
import type { TableClearInput } from '@fouc/shared/table-clear';
import type { DriverResult, SqlParameter } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

export type TableClearCatalogReader = (sql: string, parameters: SqlParameter[]) => Promise<DriverResult>;

/** A fixed catalog probe can run on the locked transaction without re-entering another pool. */
export async function tableClearPostgresFingerprint(read: TableClearCatalogReader, input: TableClearInput): Promise<string> {
  const result = await read(`SELECT /* fouc_table_clear_catalog */ jsonb_build_object(
    'relation',jsonb_build_object('oid',c.oid,'kind',c.relkind,'owner',c.relowner,
      'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'partition',c.relispartition,'persistence',c.relpersistence),
    'permissions',jsonb_build_array(pg_catalog.has_table_privilege(c.oid,'SELECT'),pg_catalog.has_table_privilege(c.oid,'TRUNCATE')),
    'columns',(SELECT jsonb_agg(jsonb_build_object('number',a.attnum,'name',a.attname,'type',a.atttypid,'modifier',a.atttypmod,
      'nullable',NOT a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'dropped',a.attisdropped,'collation',a.attcollation) ORDER BY a.attnum)
      FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0),
    'defaults',(SELECT jsonb_agg(jsonb_build_array(d.adnum,d.adbin::text) ORDER BY d.adnum) FROM pg_catalog.pg_attrdef d WHERE d.adrelid=c.oid),
    'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid) FROM pg_catalog.pg_index i WHERE i.indrelid=c.oid),
    'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid OR k.confrelid=c.oid),
    'inheritance',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.inhrelid,i.inhparent) FROM pg_catalog.pg_inherits i WHERE i.inhparent=c.oid OR i.inhrelid=c.oid),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
    'trigger_functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'source',p.prosrc,'binary',p.probin,'configuration',p.proconfig,
      'security_definer',p.prosecdef,'owner',p.proowner,'language',p.prolang) ORDER BY p.oid)
      FROM pg_catalog.pg_proc p WHERE p.oid IN (SELECT t.tgfoid FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)))::text AS catalog
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind IN ('r','p') LIMIT 1`, [input.schema, input.table]);
  const raw = result.rows[0]?.[0];
  if (result.rows.length !== 1 || typeof raw !== 'string') throw new DatabaseInputError('PostgreSQL 普通表原生目录标识已变化或不可读取。');
  return createHash('sha256').update(raw).digest('hex');
}
