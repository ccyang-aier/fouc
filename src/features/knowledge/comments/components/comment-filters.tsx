'use client';

import { ArrowsDownUp, CaretDown, SlidersHorizontal } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { defaultCommentFilters, type CommentFilters } from '../comments-view-model';
import styles from './comments.module.css';

const kinds = [['all', '全部评论'], ['comment', '普通评论'], ['issue', '全部问题'], ['open', '未解决问题'], ['resolved', '已解决问题']] as const;
const likes = [['all', '不限点赞'], ['mine', '我赞过的'], ['popular', '最多点赞']] as const;
const times = [['all', '不限时间'], ['week', '近 7 天'], ['month', '近 30 天']] as const;
const sorts = [['all', '按正文位置'], ['newest', '最新发表'], ['oldest', '最早发表']] as const;

export function CommentFilterControls({ value, onChange }: { value: CommentFilters; onChange: (next: CommentFilters) => void }) {
  const filtered = value.likes !== 'all' || value.time !== 'all';
  return <div className={styles.filters} role="group" aria-label="评论筛选">
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild><button type="button" className={styles.scopeButton} data-filtered={value.kind !== 'all'} aria-label="评论类型"><span>{kinds.find(option => option[0] === value.kind)?.[1]}</span><CaretDown size={13} aria-hidden /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="start"><DropdownMenuRadioGroup value={value.kind} onValueChange={kind => onChange({ ...value, kind: kind as CommentFilters['kind'] })}>{kinds.map(([id, label]) => <DropdownMenuRadioItem key={id} value={id}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild><button type="button" className={styles.filterButton} data-filtered={filtered} aria-label="筛选评论"><SlidersHorizontal size={16} aria-hidden />筛选{filtered && <span className={styles.filterDot} />}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>点赞筛选</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value.likes} onValueChange={next => onChange({ ...value, likes: next as CommentFilters['likes'] })}>{likes.map(([id, label]) => <DropdownMenuRadioItem key={id} value={id}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
        <DropdownMenuSeparator /><DropdownMenuLabel>时间范围</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value.time} onValueChange={next => onChange({ ...value, time: next as CommentFilters['time'] })}>{times.map(([id, label]) => <DropdownMenuRadioItem key={id} value={id}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
        <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onChange(defaultCommentFilters)}>清除筛选</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild><button type="button" className={styles.sortButton} data-filtered={value.sort !== 'all'} aria-label="评论排序" title="评论排序"><ArrowsDownUp size={16} aria-hidden /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuRadioGroup value={value.sort} onValueChange={next => onChange({ ...value, sort: next as CommentFilters['sort'] })}>{sorts.map(([id, label]) => <DropdownMenuRadioItem key={id} value={id}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
