'use client';

import { useRef, useState } from 'react';
import { BookOpen, Check, X } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KnowledgeQueryProvider } from '@/features/knowledge/data/provider';
import { useProjectKnowledgeDirectory } from '@/features/knowledge/data/use-project-knowledge-directory';
import { defineMessages, useTranslation } from '@/lib/i18n';
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from './chat-picker';
import { ChatContextChip } from './chat-context-chip';
import type { ChatContext } from './chat-types';
import type { ChatText } from './chat-messages';
import picker from './chat-picker.module.css';

const messages = defineMessages({
  empty: ['当前项目还没有可用知识库', 'No knowledge bases available in this project'],
  loading: ['正在加载知识库…', 'Loading knowledge bases…'],
  error: ['知识库加载失败', 'Could not load knowledge bases'],
  retry: ['重试', 'Retry'],
});
type Props = { context: ChatContext; onChange: (change: Partial<ChatContext>) => void; t: ChatText };

export function ChatKnowledgeSelector(props: Props) {
  return <KnowledgeQueryProvider><ProjectKnowledgePicker {...props} /></KnowledgeQueryProvider>;
}
function ProjectKnowledgePicker({ context, onChange, t }: Props) {
  const { t: text } = useTranslation(messages);
  const { knowledgeBases, status, basesQuery } = useProjectKnowledgeDirectory();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { notify } = useAppAlert();
  const selected = knowledgeBases.find(base => base.id === context.knowledgeBaseId);
  const filtered = knowledgeBases.filter(base => base.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function clearKnowledge() {
    onChange({ knowledgeBaseId: null, knowledgeBaseName: null });
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    notify('info', t('knowledgeCleared'));
  }
  return <DropdownMenu open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }}>
    <ChatContextChip selected={Boolean(selected)} triggerRef={trigger} icon={<BookOpen size={16} weight="duotone" />} label={selected?.name ?? t('selectKnowledge')} accessibleLabel={t('knowledgeContext')} clearLabel={t('clearKnowledge')} onClear={clearKnowledge} />
    <ChatPickerContent>
      <div className={picker.header}><ChatPickerSearch value={query} aria-label={t('searchKnowledge')} placeholder={t('searchKnowledge')} onChange={e => setQuery(e.target.value)} /></div>
      <ScrollArea className={picker.list} style={{ height: filtered.length ? Math.min(filtered.length * 32, 192) : 48 }}>
        {filtered.map(base => <ChatPickerItem key={base.id} role="menuitemradio" aria-checked={selected?.id === base.id} data-selected={selected?.id === base.id} textValue={base.name} onSelect={() => { onChange({ knowledgeBaseId: base.id, knowledgeBaseName: base.name }); setOpen(false); }}>
          <BookOpen weight="duotone" /><span className={picker.name}>{base.name}</span>{selected?.id === base.id && <Check className={picker.check} />}
        </ChatPickerItem>)}
        {!filtered.length && <p className={picker.empty} role="status">{status === 'loading' ? text('loading') : status === 'error' ? text('error') : query ? t('noKnowledgeResults') : text('empty')}</p>}
      </ScrollArea>
      {status === 'error' && <ChatPickerItem onSelect={e => { e.preventDefault(); void basesQuery.refetch(); }}>{text('retry')}</ChatPickerItem>}
      <DropdownMenuSeparator className={picker.separator} />
      <ChatPickerItem role="menuitemradio" aria-checked={!selected} data-selected={!selected} onSelect={clearKnowledge}><X /><span className={picker.name}>{t('withoutKnowledge')}</span>{!selected && <Check className={picker.check} />}</ChatPickerItem>
    </ChatPickerContent>
  </DropdownMenu>;
}
