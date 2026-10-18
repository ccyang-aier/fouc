import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  comments: ['评论', 'Comments'],
  loading: ['正在加载评论', 'Loading comments'],
  empty: ['还没有评论', 'No comments yet'],
  emptyHint: ['在这里讨论进展、记录反馈。', 'Discuss progress and share feedback here.'],
  placeholder: ['写下评论…', 'Write a comment…'],
  publish: ['发布评论', 'Post comment'],
  shortcut: ['⌘ / Ctrl + Enter 发布', '⌘ / Ctrl + Enter to post'],
  loadFailed: ['评论加载失败', 'Could not load comments'],
  retry: ['重试', 'Retry'],
  postFailed: ['评论发布失败，请重试。', 'Could not post your comment. Please try again.'],
  removeFailed: ['评论删除失败，请重试。', 'Could not delete the comment. Please try again.'],
  delete: ['删除评论', 'Delete comment'],
  deleteConfirm: ['删除这条评论？', 'Delete this comment?'],
  confirmDelete: ['确认删除', 'Delete'],
  cancel: ['取消', 'Cancel'],
  clear: ['清空草稿', 'Clear draft'],
});
