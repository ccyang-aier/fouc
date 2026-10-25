import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { memberRoleSchema } from '@fouc/shared/resources';
import { taskTableNames } from './resources/task-rls';
import { chatTableNames } from './resources/chat-rls';
import { generateDatabaseSchemaSql, databaseSchemaSqlPath } from '../../../scripts/database-schema';
import { allApplicationTables, resourceTables, identityTables, memberRole, project, projectMember, chatChannel, chatChannelMember, chatMessage, catalogModel, modelCatalogTables } from './schema';

describe('current Drizzle schema', () => {
  test('covers only project resources and keeps identity separate', () => {
    const names = resourceTables.map(table => getTableConfig(table).name).sort();
    expect(names).toEqual(['project', 'project_member', ...taskTableNames, ...chatTableNames].sort());
    expect(identityTables.map(table => getTableConfig(table).name).sort()).toEqual(['account', 'session', 'user', 'verification']);
    expect(new Set(allApplicationTables).size).toBe(allApplicationTables.length);
    expect(getTableConfig(projectMember).foreignKeys.some(key => key.reference().foreignTable === project)).toBe(true);
    expect([...memberRole.enumValues]).toEqual(memberRoleSchema.options);
  });
  test('public model metadata has an independently owned catalog without product resource scope', () => {
    const config = getTableConfig(catalogModel);
    expect(config.schema).toBe('catalog');
    expect(modelCatalogTables).toEqual([catalogModel]);
    expect(config.foreignKeys).toEqual([]);
    for (const name of ['project_id', 'user_id', 'api_key']) {
      expect(config.columns.some((column) => column.name === name)).toBe(false);
    }
  });
  test('chat channels own project-scoped messages and participants', () => {
    for (const table of [chatChannel, chatChannelMember, chatMessage]) {
      const config = getTableConfig(table);
      expect(config.columns.find(column => column.name === 'project_id')?.notNull).toBe(true);
      expect(config.primaryKeys[0].columns[0].name).toBe('project_id');
    }
    for (const table of [chatChannelMember, chatMessage]) {
      const relation = getTableConfig(table).foreignKeys.find(key => key.reference().foreignTable === chatChannel);
      expect(relation?.reference().columns.map(column => column.name)).toEqual(['project_id', 'channel_id']);
      expect(relation?.onDelete).toBe('cascade');
    }
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
    for (const enumType of [memberRole]) {
      expect(sql).toContain(`"resources"."${enumType.enumName}"`);
      expect(sql).not.toMatch(new RegExp(`\\t"[a-z_]+" "${enumType.enumName}"(?: |,)`));
    }
    expect(sql).not.toContain('DROP ');
    expect(sql).not.toContain('__drizzle_migrations');
    expect(sql).not.toMatch(/\$\d+/);
  });
});
