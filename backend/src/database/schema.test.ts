import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  aiTaskSchema,
  assetStatusSchema,
  commentThreadSchema,
  memberRoleSchema,
  modelTiers,
  pageKindSchema,
  permissionLevels,
  workspaceKindSchema,
} from '@fouc/shared/knowledge/contracts';
import { generateDatabaseSchemaSql, databaseSchemaSqlPath } from '../../scripts/database-schema';
import {
  aiTaskKind,
  aiTaskStatus,
  allApplicationTables,
  asset,
  assetStatus,
  blockEmbeddingStaging,
  blockIndex,
  commentThreadStatus,
  databaseDefinition,
  docCheckpoint,
  docState,
  knowledgeBusinessTables,
  identityTables,
  memberRole,
  modelTier,
  page,
  pageEffectiveAcl,
  pageKind,
  permissionLevel,
  workspaceKind,
} from './schema';

describe('knowledge current Drizzle schema', () => {
  test('covers all designed business tables and keeps global identity separate', () => {
    const names = knowledgeBusinessTables.map((table) => getTableConfig(table).name);
    for (const name of [
      'workspace', 'member', 'workspace_invitation', 'group', 'group_member', 'teamspace', 'page',
      'database_definition', 'doc_state', 'doc_checkpoint', 'page_acl',
      'page_effective_acl', 'block_index', 'backlink', 'asset', 'comment_thread',
      'comment', 'outbox', 'ai_task', 'ai_usage', 'notification',
      'personal_access_token', 'share_link', 'model_credential', 'block_embedding_staging',
    ]) expect(names).toContain(name);
    expect(identityTables.map((table) => getTableConfig(table).name).sort())
      .toEqual(['account', 'session', 'user', 'verification']);
    expect(new Set(allApplicationTables).size).toBe(allApplicationTables.length);
  });

  test('all business tables carry a non-null workspace key and tenant-safe foreign keys', () => {
    for (const table of knowledgeBusinessTables) {
      const config = getTableConfig(table);
      const scope = config.columns.find((column) => column.name === 'workspace_id');
      expect(scope, `${config.name} tenant key`).toBeDefined();
      expect(scope?.notNull, `${config.name} nullable tenant key`).toBe(true);
      for (const foreignKey of config.foreignKeys) {
        const reference = foreignKey.reference();
        if (getTableConfig(reference.foreignTable).schema !== 'knowledge') continue;
        const localScopeIndex = reference.columns.findIndex((column) => column.name === 'workspace_id');
        expect(localScopeIndex, `${config.name}.${foreignKey.getName()} missing tenant scope`).toBeGreaterThanOrEqual(0);
        expect(reference.foreignColumns[localScopeIndex]?.name).toBe('workspace_id');
      }
    }
  });

  test('every tenant-owned table has a foreign-key path to its workspace root', () => {
    function reachesRoot(table: typeof allApplicationTables[number], visited = new Set<object>()): boolean {
      if (visited.has(table)) return false;
      visited.add(table);
      const config = getTableConfig(table);
      if (config.schema !== 'knowledge') return false;
      return config.name === 'workspace' || config.foreignKeys.some((key) => reachesRoot(key.reference().foreignTable, visited));
    }
    for (const table of knowledgeBusinessTables) {
      expect(reachesRoot(table), `${getTableConfig(table).name} has no workspace root`).toBe(true);
    }
  });

  test('SQL enum values derive from the shared domain contracts', () => {
    expect([...workspaceKind.enumValues]).toEqual(workspaceKindSchema.options);
    expect([...memberRole.enumValues]).toEqual(memberRoleSchema.options);
    expect([...pageKind.enumValues]).toEqual(pageKindSchema.options);
    expect(permissionLevel.enumValues).toEqual([...permissionLevels]);
    expect(modelTier.enumValues).toEqual([...modelTiers]);
    expect([...commentThreadStatus.enumValues]).toEqual(commentThreadSchema.shape.status.options);
    expect([...assetStatus.enumValues]).toEqual(assetStatusSchema.options);
    expect([...aiTaskKind.enumValues]).toEqual(aiTaskSchema.shape.kind.options);
    expect([...aiTaskStatus.enumValues]).toEqual(aiTaskSchema.shape.status.options);
  });

  test('assets are workspace-scoped content-addressed blobs with a lifecycle status', () => {
    const config = getTableConfig(asset);
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(['workspace_id', 'hash']);
    expect(config.checks.map((check) => check.name)).toEqual(expect.arrayContaining(['asset_hash_valid', 'asset_mime_valid']));
    expect(asset.status.notNull).toBe(true);
    expect(asset.status.enumValues).toEqual(['ready', 'revoked']);
  });

  test('database rows reference tenant-local database pages, never arbitrary documents', () => {
    const pageConfig = getTableConfig(page);
    const definitionConfig = getTableConfig(databaseDefinition);
    const databaseFk = pageConfig.foreignKeys.find((key) => key.getName() === 'page_database_fk')?.reference();
    expect(databaseFk?.columns.map((column) => column.name)).toEqual(['workspace_id', 'teamspace_id', 'database_id']);
    expect(databaseFk?.foreignTable).toBe(databaseDefinition);
    const definitionFk = definitionConfig.foreignKeys.find((key) => key.getName() === 'database_definition_page_fk')?.reference();
    expect(definitionFk?.foreignTable).toBe(page);
    expect(definitionFk?.foreignColumns.map((column) => column.name)).toEqual(['workspace_id', 'teamspace_id', 'id', 'kind']);
    expect(pageConfig.checks.map((check) => check.name)).toContain('page_row_database_relation');
    expect(definitionConfig.checks.map((check) => check.name)).toContain('database_definition_database_kind');
  });

  test('page tree uses ltree paths and indexed tenant-local parents', () => {
    const config = getTableConfig(page);
    expect(page.path.getSQLType()).toBe('ltree');
    expect(config.indexes.find((index) => index.config.name === 'page_path_gist_idx')?.config.method).toBe('gist');
    const parent = config.foreignKeys.find((key) => key.getName() === 'page_parent_fk')?.reference();
    expect(parent?.foreignColumns.map((column) => column.name)).toEqual(['workspace_id', 'teamspace_id', 'id']);
    expect(config.checks.map((check) => check.name)).toEqual(expect.arrayContaining(['page_not_own_parent', 'page_path_valid', 'page_root_path_depth']));
  });

  test('Yjs state is binary with node-postgres Buffer mapping, never duplicated text', () => {
    for (const table of [docState, docCheckpoint]) {
      expect(table.state.getSQLType()).toBe('bytea');
      expect(table.stateVector.getSQLType()).toBe('bytea');
      const update = new Uint8Array([0, 255, 128, 4, 0]);
      const encoded = table.state.mapToDriverValue(update);
      expect(Buffer.isBuffer(encoded)).toBe(true);
      expect(table.state.mapFromDriverValue(encoded)).toEqual(update);
      expect(getTableConfig(table).columns.some((column) => ['body', 'content', 'markdown', 'document'].includes(column.name))).toBe(false);
    }
    expect(getTableConfig(page).columns.some((column) => ['body', 'content', 'markdown', 'document'].includes(column.name))).toBe(false);
  });

  test('search key is global and dimensions can vary by embedding model', () => {
    const config = getTableConfig(blockIndex);
    expect(blockIndex.id.getSQLType()).toBe('bigint');
    expect(blockIndex.id.primary).toBe(true);
    expect(blockIndex.id.generatedIdentity?.type).toBe('always');
    expect(config.uniqueConstraints.some((key) => key.columns.map((column) => column.name).join(',') === 'workspace_id,page_id,block_id')).toBe(true);
    expect(blockIndex.embedding.getSQLType()).toBe('vector');
    expect(blockIndex.embedding.mapToDriverValue([1, 2, 3])).toBe('[1,2,3]');
    expect(blockIndex.embedding.mapToDriverValue([1, 2])).toBe('[1,2]');
    expect(() => blockIndex.embedding.mapToDriverValue([NaN])).toThrow();
    expect(config.checks.map((check) => check.name)).toContain('block_index_embedding_metadata');
  });

  test('permission arrays use GIN and materialized ACLs have revision guards', () => {
    const config = getTableConfig(pageEffectiveAcl);
    const gin = config.indexes.filter((index) => index.config.method === 'gin');
    expect(gin).toHaveLength(4);
    expect(config.checks.map((check) => check.name)).toContain('page_effective_acl_level_hierarchy');
    expect(page.aclRevision.notNull).toBe(true);
    expect(pageEffectiveAcl.revision.notNull).toBe(true);
    expect(blockIndex.aclRevision.notNull).toBe(true);
  });

  test('replacement model vectors can be staged without replacing active vectors or copying body text', () => {
    const config = getTableConfig(blockEmbeddingStaging);
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(['workspace_id', 'page_id', 'block_id', 'embed_model', 'embed_dimensions']);
    const blockKey = config.foreignKeys.find((key) => key.getName() === 'block_embedding_staging_block_fk');
    expect(blockKey?.reference().foreignTable).toBe(blockIndex);
    expect(blockKey?.onDelete).toBe('cascade');
    expect(blockEmbeddingStaging.embedding.getSQLType()).toBe('vector');
    expect(blockEmbeddingStaging.contentHash.notNull).toBe(true);
    expect(config.columns.some((column) => ['content_md', 'content', 'body'].includes(column.name))).toBe(false);
  });

  test('every timestamp is timezone-aware', () => {
    for (const table of allApplicationTables) {
      for (const column of getTableConfig(table).columns) {
        if (column.columnType === 'PgTimestamp') expect(column.getSQLType()).toBe('timestamp with time zone');
      }
    }
  });

  test('schema-owned identifiers fit PostgreSQL without silent truncation', () => {
    for (const table of allApplicationTables) {
      const config = getTableConfig(table);
      const names = [config.schema!, config.name, ...config.columns.map((column) => column.name),
        ...config.foreignKeys.map((key) => key.getName()), ...config.checks.map((check) => check.name),
        ...config.primaryKeys.map((key) => key.getName()), ...config.uniqueConstraints.map((key) => key.getName()!),
        ...config.indexes.map((index) => index.config.name!)];
      for (const name of names) expect(Buffer.byteLength(name), name).toBeLessThanOrEqual(63);
    }
  });

  test('generated initialization contains the current schema without DDL drift', async () => {
    const sql = await generateDatabaseSchemaSql();
    const saved = await readFile(databaseSchemaSqlPath, 'utf8');
    expect(saved.replaceAll('\r\n', '\n')).toBe(sql);
    for (const table of allApplicationTables) {
      const config = getTableConfig(table);
      expect(sql).toContain(`CREATE TABLE "${config.schema}"."${config.name}"`);
    }
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS ltree;');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_search;');
    expect(sql).toContain('GENERATED ALWAYS AS IDENTITY');
    for (const enumType of [workspaceKind, memberRole, pageKind, permissionLevel, modelTier, commentThreadStatus, aiTaskKind, aiTaskStatus]) {
      expect(sql).toContain(`"knowledge"."${enumType.enumName}"`);
      expect(sql).not.toMatch(new RegExp(`\\t"[a-z_]+" "${enumType.enumName}"(?: |,)`));
    }
    expect(sql).not.toContain('vector(1536)');
    expect(sql).not.toContain('DROP ');
    expect(sql).not.toContain('__drizzle_migrations');
    expect(sql).not.toMatch(/\$\d+/);
  });
});
