import { defineMessages } from '@/lib/i18n';

export const knowledgeMessages = defineMessages({
  newKnowledgeBase: ['新建知识库', 'New knowledge base'],
  cancel: ['取消', 'Cancel'],
  creating: ['创建中…', 'Creating…'],
  createKnowledgeBase: ['创建知识库', 'Create knowledge base'],
  knowledgeBaseName: ['知识库名称', 'Knowledge base name'],
  enterKnowledgeBaseName: ['输入知识库名称', 'Enter knowledge base name'],
  storageLocation: ['保存位置', 'Storage location'],
  local: ['本机', 'Local'],
  server: ['服务端', 'Server'],
  unableToSaveLocallyCheckBrowserStorageSpace: [
    '本机保存失败，请检查浏览器存储空间。',
    'Unable to save locally. Check browser storage space.',
  ],
});
