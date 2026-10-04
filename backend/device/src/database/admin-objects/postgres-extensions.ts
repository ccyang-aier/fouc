import {
  DATABASE_ADMIN_OBJECT_LIMITS as limits, databaseAdminObjectKey,
  type DatabaseAdminObjectList, type DatabaseAdminObjectRows, type PostgresExtensionDetails, type PostgresExtensionVersion,
  type PostgresExtensionMember, type PostgresExtensionDependency,
} from '@fouc/shared/database-admin-objects';
import { DatabaseInputError } from '../input-error';
import { adminObjectSearch } from './input';
import { boundedRows, catalogBoolean, catalogText, errorMessage, optionalSection, quoteAdminObject, sourceText, unavailableRows, type AdminObjectAdapter } from './common';

const EXTENSION_SUMMARY = `SELECT COALESCE(e.extname,a.name) AS name, e.oid::text AS oid,
  e.extversion AS installed_version, n.nspname AS schema_name, pg_catalog.pg_get_userbyid(e.extowner) AS owner,
  e.extrelocatable AS relocatable, a.default_version, a.name IS NOT NULL AS available,
  COALESCE(pg_catalog.obj_description(e.oid,'pg_extension'),a.comment) AS comment
  FROM pg_catalog.pg_extension e FULL JOIN pg_catalog.pg_available_extensions a ON a.name=e.extname
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace`;

export async function listPostgresExtensions(adapter: AdminObjectAdapter, input: { search: string; offset: number; limit: number; filter: 'all' | 'installed' | 'available' }, signal?: AbortSignal): Promise<DatabaseAdminObjectList> {
  const filter = input.filter === 'installed' ? 'AND e.oid IS NOT NULL' : input.filter === 'available' ? 'AND e.oid IS NULL AND a.name IS NOT NULL' : '';
  const rows = await adapter.query(`${EXTENSION_SUMMARY} WHERE (COALESCE(e.extname,a.name) ILIKE $1 ESCAPE '=' OR COALESCE(a.comment,'') ILIKE $1 ESCAPE '=') ${filter}
    ORDER BY COALESCE(e.extname,a.name) LIMIT ${input.limit + 1} OFFSET ${input.offset}`, [adminObjectSearch(input.search)], input.limit + 1, signal);
  return {
    provider: 'postgres', database: adapter.database, offset: input.offset, limit: input.limit, hasMore: rows.length > input.limit,
    coverage: 'database-catalog', warnings: ['扩展名称在当前数据库内唯一；Schema 表示扩展导出对象所在位置。可安装目录仅代表服务器存在控制文件，不代表当前角色有安装权限。'],
    items: rows.slice(0, input.limit).map(row => ({
      id: databaseAdminObjectKey('extension', String(row.name), null), kind: 'extension', name: String(row.name), schema: catalogText(row.schema_name),
      comment: catalogText(row.comment), installedVersion: catalogText(row.installed_version), defaultVersion: catalogText(row.default_version),
      available: catalogBoolean(row.available), status: row.oid == null ? 'AVAILABLE' : 'INSTALLED', schedule: null, timeZone: null,
    })),
  };
}

function member(row: Record<string, unknown>): PostgresExtensionMember {
  return { catalog: String(row.catalog), oid: String(row.oid), subId: Number(row.sub_id), objectType: catalogText(row.object_type), schema: catalogText(row.schema_name), name: catalogText(row.name), identity: catalogText(row.identity) };
}
async function extensionVersions(adapter: AdminObjectAdapter, name: string, signal?: AbortSignal) {
  const catalog = await adapter.query(`SELECT a.attname AS name FROM pg_catalog.pg_attribute a
    WHERE a.attrelid='pg_catalog.pg_available_extension_versions'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [], 30, signal);
  const columns = new Set(catalog.map(row => String(row.name)));
  const flags = ['installed', 'superuser', 'trusted', 'relocatable'].map(name => `${columns.has(name) ? `v.${name}` : 'NULL::boolean'} AS ${name}`);
  const sql = `SELECT v.version, ${flags.join(', ')}, ${columns.has('schema') ? 'v.schema' : 'NULL::name'} AS required_schema,
    ${columns.has('requires') ? 'v.requires' : 'NULL::name[]'} AS requires, ${columns.has('comment') ? 'v.comment' : 'NULL::text'} AS comment
    FROM pg_catalog.pg_available_extension_versions v WHERE v.name=$1 ORDER BY v.version LIMIT ${limits.versions + 1}`;
  const rows = await adapter.query(sql, [name], limits.versions + 1, signal);
  const versions: PostgresExtensionVersion[] = rows.map(row => ({
    version: String(row.version), installed: catalogBoolean(row.installed), superuser: catalogBoolean(row.superuser), trusted: catalogBoolean(row.trusted),
    relocatable: catalogBoolean(row.relocatable), requiredSchema: catalogText(row.required_schema),
    requires: columns.has('requires') ? row.requires == null ? [] : Array.isArray(row.requires) ? row.requires.map(String) : null : null,
    comment: catalogText(row.comment),
  }));
  return { columns: [...columns], rows: boundedRows(versions, limits.versions) };
}
async function extensionMembers(adapter: AdminObjectAdapter, oid: string, signal?: AbortSignal) {
  const rows = await adapter.query(`SELECT d.classid::regclass::text AS catalog, d.objid::text AS oid, d.objsubid AS sub_id,
    identity.type AS object_type, identity.schema AS schema_name, identity.name, identity.identity
    FROM pg_catalog.pg_depend d CROSS JOIN LATERAL pg_catalog.pg_identify_object(d.classid,d.objid,d.objsubid) identity
    WHERE d.refclassid='pg_catalog.pg_extension'::regclass AND d.refobjid=$1::oid AND d.deptype='e'
    ORDER BY d.classid,d.objid,d.objsubid LIMIT ${limits.members + 1}`, [oid], limits.members + 1, signal);
  return boundedRows(rows.map(member), limits.members);
}
async function extensionDependencies(adapter: AdminObjectAdapter, oid: string, signal?: AbortSignal) {
  const rows = await adapter.query(`SELECT objects.direction,objects.dependency_type,objects.catalog::regclass::text AS catalog,
    objects.oid::text AS oid,objects.sub_id,identity.type AS object_type,identity.schema AS schema_name,identity.name,identity.identity
    FROM (
      SELECT 'requires'::text AS direction,d.deptype::text AS dependency_type,d.refclassid AS catalog,d.refobjid AS oid,d.refobjsubid AS sub_id
      FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_extension'::regclass AND d.objid=$1::oid
      UNION ALL
      SELECT 'dependent'::text,d.deptype::text,d.classid,d.objid,d.objsubid
      FROM pg_catalog.pg_depend d WHERE d.refclassid='pg_catalog.pg_extension'::regclass AND d.refobjid=$1::oid AND d.deptype<>'e'
    ) objects CROSS JOIN LATERAL pg_catalog.pg_identify_object(objects.catalog,objects.oid,objects.sub_id) identity
    ORDER BY objects.direction,objects.catalog,objects.oid,objects.sub_id LIMIT ${limits.dependencies + 1}`, [oid], limits.dependencies + 1, signal);
  return boundedRows(rows.map(row => ({ ...member(row), direction: row.direction === 'requires' ? 'requires' as const : 'dependent' as const, dependencyType: String(row.dependency_type) })), limits.dependencies);
}

export async function describePostgresExtension(adapter: AdminObjectAdapter, name: string, signal?: AbortSignal): Promise<PostgresExtensionDetails> {
  const rows = await adapter.query(`${EXTENSION_SUMMARY} WHERE COALESCE(e.extname,a.name)=$1 LIMIT 1`, [name], 1, signal);
  if (!rows.length) throw new DatabaseInputError('当前数据库没有此已安装或可安装扩展。');
  const row = rows[0], oid = catalogText(row.oid);
  const installed: PostgresExtensionDetails['installed'] = oid === null ? null : { oid, version: String(row.installed_version), schema: catalogText(row.schema_name), owner: catalogText(row.owner), relocatable: catalogBoolean(row.relocatable) };
  const [versionCatalog, members, dependencies, permissions] = await Promise.all([
    optionalSection<{ columns: string[]; rows: DatabaseAdminObjectRows<PostgresExtensionVersion> }>(() => extensionVersions(adapter, name, signal), reason => ({ columns: [], rows: unavailableRows<PostgresExtensionVersion>(limits.versions, reason) }), signal),
    oid === null ? Promise.resolve(boundedRows<PostgresExtensionMember>([], limits.members)) : optionalSection(() => extensionMembers(adapter, oid, signal), reason => unavailableRows<PostgresExtensionMember>(limits.members, reason), signal),
    oid === null ? Promise.resolve(boundedRows<PostgresExtensionDependency>([], limits.dependencies)) : optionalSection(() => extensionDependencies(adapter, oid, signal), reason => unavailableRows<PostgresExtensionDependency>(limits.dependencies, reason), signal),
    optionalSection<PostgresExtensionDetails['permissions']>(async () => {
      const permission = (await adapter.query(`SELECT current_user AS current_user, r.rolsuper AS superuser,
        pg_catalog.has_database_privilege(current_user,current_database(),'CREATE') AS database_create
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`, [], 1, signal))[0];
      return { currentUser: catalogText(permission?.current_user), superuser: catalogBoolean(permission?.superuser), databaseCreate: catalogBoolean(permission?.database_create), error: null };
    }, reason => ({ currentUser: null, superuser: null, databaseCreate: null, error: errorMessage(reason) }), signal),
  ]);
  const literal = (value: string) => "E'" + value.replaceAll('\\', '\\\\').replaceAll("'", "''") + "'";
  const source = installed ? sourceText(`-- 根据当前数据库扩展目录重建的安装声明；并非完整扩展脚本。\nCREATE EXTENSION ${quoteAdminObject('postgres', name)}${installed.schema ? ` WITH SCHEMA ${quoteAdminObject('postgres', installed.schema)}` : ''} VERSION ${literal(installed.version)};`, 'reconstructed') : sourceText(null);
  return {
    kind: 'extension', name: String(row.name), comment: catalogText(row.comment), defaultVersion: catalogText(row.default_version), installed,
    permissions, versionColumns: versionCatalog.columns, versions: versionCatalog.rows, members, dependencies, source,
    warnings: [
      '目录提供已安装状态与服务器控制文件元数据，不提供完整安装 / 升级 SQL 脚本；安装声明仅为元数据重建。',
      `版本最多 ${limits.versions} 项、成员与依赖各 ${limits.members} 项；超过上限或权限错误会明确标记不完整。`,
      'trusted / superuser 标记是扩展版本要求，数据库 CREATE 权限仅是一项前提；此界面不安装、升级或删除扩展。',
      ...(versionCatalog.columns.length && !versionCatalog.columns.includes('trusted') ? ['当前原生目录没有 trusted 列，信任状态保持未知。'] : []),
      '成员根据当前扩展的原生 OID 与 pg_depend 的 extension membership 读取；不推测同 Schema 对象属于此扩展。',
    ],
  };
}
