import type { Pool } from 'pg';
import { KnowledgeDatabaseError } from './initialize-config';

export type KnowledgeSqlConnection = Pick<Pool, 'query'>;
export interface KnowledgeApplicationRole {
  name: string;
  database: string;
  address: string | null;
  port: number | null;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  ownsDatabase: boolean;
  privilegedMembership: boolean;
}

export async function readKnowledgeApplicationRole(connection: KnowledgeSqlConnection): Promise<KnowledgeApplicationRole> {
  const result = await connection.query<KnowledgeApplicationRole>(`
    SELECT current_user AS name, current_database() AS database,
      inet_server_addr()::text AS address, inet_server_port() AS port,
      r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
      d.datdba = r.oid AS "ownsDatabase",
      EXISTS (
        SELECT 1 FROM pg_roles elevated
        WHERE elevated.oid <> r.oid AND pg_has_role(r.oid, elevated.oid, 'MEMBER')
          AND (elevated.rolsuper OR elevated.rolbypassrls OR elevated.rolcreatedb OR elevated.rolcreaterole OR elevated.rolreplication OR elevated.oid = d.datdba)
      ) AS "privilegedMembership"
    FROM pg_roles r JOIN pg_database d ON d.datname = current_database()
    WHERE r.rolname = current_user
  `);
  const role = result.rows[0];
  if (!role) throw new KnowledgeDatabaseError('unsafe_role', 'The application database role could not be verified.');
  return role;
}

export function isKnowledgeApplicationRoleSafe(role: KnowledgeApplicationRole): boolean {
  return !role.rolsuper && !role.rolbypassrls && !role.rolcreatedb && !role.rolcreaterole && !role.rolreplication && !role.ownsDatabase && !role.privilegedMembership;
}

export async function assertKnowledgeApplicationRole(admin: KnowledgeSqlConnection, application: KnowledgeSqlConnection) {
  const role = await readKnowledgeApplicationRole(application);
  if (!isKnowledgeApplicationRoleSafe(role)) {
    throw new KnowledgeDatabaseError('unsafe_role', 'The application role must not own the database, hold administrative privileges, or be a member of a privileged role.');
  }
  const target = await admin.query<{ database: string; address: string | null; port: number | null }>(
    'SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port',
  );
  if (target.rows[0]?.database !== role.database || target.rows[0]?.address !== role.address || target.rows[0]?.port !== role.port) {
    throw new KnowledgeDatabaseError('database_mismatch', 'Administrator and application connections must use the same PostgreSQL database.');
  }
  return role;
}
