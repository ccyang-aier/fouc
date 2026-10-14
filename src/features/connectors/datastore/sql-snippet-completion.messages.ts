import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectAll: ['查询全部字段', 'select *'],
  insert: ['插入记录', 'insert into'],
  update: ['更新字段', 'update set'],
  cte: ['公共表表达式', 'common table expression'],
  join: ['关联查询', 'join'],
  caseWhen: ['条件表达式', 'case when'],
  createTable: ['创建表', 'create table'],
  exists: ['存在判断', 'exists'],
  notExists: ['不存在判断', 'not exists'],
  alterTable: ['新增表字段', 'alter table add column'],
  createIndex: ['创建索引', 'create index'],
  sqlSnippet: ['{p0} · SQL 片段', '{p0} · SQL snippet'],
});
