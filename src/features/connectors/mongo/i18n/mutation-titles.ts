import { defineMessages, type Locale } from '@/lib/i18n';
import type { MongoMutationOperation } from '@fouc/shared/mongo-mutation';
import { createUiMessages, uiText } from '../../i18n/ui-message';
const messages = defineMessages({
  新增文档: ['新增文档', 'Add document'],
  替换文档: ['替换文档', 'Replace document'],
  删除文档: ['删除文档', 'Delete document'],
  新建集合: ['新建集合', 'Create collection'],
  删除集合: ['删除集合', 'Delete collection'],
  创建索引: ['创建索引', 'Create index'],
  删除索引: ['删除索引', 'Delete index'],
});
const titles = {
  'insert-document': '新增文档',
  'replace-document': '替换文档',
  'delete-document': '删除文档',
  'create-collection': '新建集合',
  'drop-collection': '删除集合',
  'create-index': '创建索引',
  'drop-index': '删除索引',
} as const satisfies Record<MongoMutationOperation, keyof typeof messages>;
const { message } = createUiMessages(messages);
export function mongoMutationTitle(operation: MongoMutationOperation, locale: Locale): string {
  return uiText(message(titles[operation]), locale);
}
