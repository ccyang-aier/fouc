export const MYSQL_SECURITY_IDENTITY = 'SELECT CURRENT_USER() AS authenticated, USER() AS `session_user`, CURRENT_USER() AS `current_user`, CURRENT_ROLE() AS active_roles';
export const MYSQL_SECURITY_PRINCIPALS = `SELECT User AS name, Host AS host, plugin AS authentication,
  account_locked AS locked, password_expired AS password_expired FROM mysql.user ORDER BY User, Host`;
export const MYSQL_SECURITY_MEMBERSHIPS = `SELECT FROM_USER AS role_name, FROM_HOST AS role_host,
  TO_USER AS member_name, TO_HOST AS member_host, WITH_ADMIN_OPTION AS admin FROM mysql.role_edges
  ORDER BY TO_USER, TO_HOST, FROM_USER, FROM_HOST`;
export const POSTGRES_SECURITY_IDENTITY = 'SELECT session_user::text AS authenticated, session_user::text AS session_user, current_user::text AS current_user, current_user::text AS active_roles';
export const POSTGRES_SECURITY_PRINCIPALS = `SELECT oid::text AS id, rolname AS name,
  rolcanlogin AS login, rolsuper AS superuser, rolcreatedb AS create_database,
  rolcreaterole AS create_role, rolinherit AS inherit, rolreplication AS replication,
  rolbypassrls AS bypass_rls, rolconnlimit::text AS connection_limit, rolvaliduntil::text AS valid_until
  FROM pg_catalog.pg_roles ORDER BY rolname`;
export const POSTGRES_MEMBERSHIP_FIELDS = `SELECT attname FROM pg_catalog.pg_attribute
  WHERE attrelid = 'pg_catalog.pg_auth_members'::regclass AND attnum > 0 AND NOT attisdropped`;
export function postgresSecurityMemberships(fields: ReadonlySet<string>) {
  return `SELECT member::text AS member_id, roleid::text AS role_id, admin_option AS admin,
    ${fields.has('inherit_option') ? 'inherit_option' : 'NULL::boolean'} AS inherit,
    ${fields.has('set_option') ? 'set_option' : 'NULL::boolean'} AS set_role,
    grantor::text AS grantor FROM pg_catalog.pg_auth_members ORDER BY member, roleid`;
}

// Native QUOTE produces the same account representation used by GRANTEE; values stay parameters.
const mysqlTarget = "GRANTEE = CONCAT(QUOTE(?), '@', QUOTE(?))";
export const MYSQL_SECURITY_PRIVILEGES = [
  `SELECT 'instance' AS scope, NULL AS schema_name, NULL AS object_name, NULL AS column_name,
    PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.USER_PRIVILEGES WHERE ${mysqlTarget}`,
  `SELECT 'schema' AS scope, TABLE_SCHEMA AS schema_name, NULL AS object_name, NULL AS column_name,
    PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.SCHEMA_PRIVILEGES WHERE ${mysqlTarget} AND TABLE_SCHEMA = ?`,
  `SELECT 'table' AS scope, TABLE_SCHEMA AS schema_name, TABLE_NAME AS object_name, NULL AS column_name,
    PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.TABLE_PRIVILEGES WHERE ${mysqlTarget} AND TABLE_SCHEMA = ?`,
  `SELECT 'column' AS scope, TABLE_SCHEMA AS schema_name, TABLE_NAME AS object_name, COLUMN_NAME AS column_name,
    PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.COLUMN_PRIVILEGES WHERE ${mysqlTarget} AND TABLE_SCHEMA = ?`,
] as const;
export const POSTGRES_SECURITY_DATABASE_PRIVILEGES = `SELECT 'database' AS scope, NULL::text AS schema_name,
  d.datname AS object_name, NULL::text AS column_name, p.privilege, NULL::boolean AS grantable
  FROM pg_catalog.pg_database d CROSS JOIN (VALUES ('CONNECT'), ('CREATE'), ('TEMPORARY')) p(privilege)
  WHERE has_database_privilege($1::text, d.oid, p.privilege) ORDER BY d.datname, p.privilege`;
export const POSTGRES_SECURITY_SCHEMA_PRIVILEGES = `SELECT 'schema' AS scope, n.nspname AS schema_name,
  NULL::text AS object_name, NULL::text AS column_name, p.privilege, NULL::boolean AS grantable
  FROM pg_catalog.pg_namespace n CROSS JOIN (VALUES ('USAGE'), ('CREATE')) p(privilege)
  WHERE n.nspname = $2 AND has_schema_privilege($1::text, n.oid, p.privilege) ORDER BY p.privilege`;
export const POSTGRES_SECURITY_TABLE_PRIVILEGES = `SELECT 'table' AS scope, n.nspname AS schema_name,
  c.relname AS object_name, NULL::text AS column_name, p.privilege, NULL::boolean AS grantable
  FROM (SELECT c.oid, c.relname, c.relnamespace FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $2 AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname LIMIT 334) c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
  WHERE has_table_privilege($1::text, c.oid, p.privilege) ORDER BY c.relname, p.privilege`;
