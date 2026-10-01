'use client';

import { CaretDown, Clock, FunnelSimple, ThumbsUp } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { defaultCommentFilters, type CommentFilters } from '../comments-view-model';
import styles from './comments.module.css';

const options = {
  kind: [['all', '全部评论'], ['comment', '普通评论'], ['issue', '全部问题'], ['open', '未解决问题'], ['resolved', '已解决问题']],
  likes: [['all', '全部点赞'], ['mine', '我赞过的'], ['popular', '最多点赞']],
  time: [['all', '全部时间'], ['week', '近 7 天'], ['month', '近 30 天'], ['newest', '最新发表'], ['oldest', '最早发表']],
} as const;
const names = { kind: '评论类型', likes: '点赞筛选', time: '时间筛选' };
const icons = { kind: FunnelSimple, likes: ThumbsUp, time: Clock };

export function CommentFilterControls({ value, onChange }: { value: CommentFilters; onChange: (next: CommentFilters) => void }) {
  return <div className={styles.filters} role="group" aria-label="评论筛选">
    {(['kind', 'likes', 'time'] as const).map(key => {
      const Icon = icons[key];
      return <DropdownMenu key={key}>
        <DropdownMenuTrigger asChild><button type="button" className={styles.filterButton} data-filtered={value[key] !== defaultCommentFilters[key]} aria-label={names[key]}><Icon size={13} aria-hidden /><span>{options[key].find(option => option[0] === value[key])?.[1]}</span><CaretDown size={10} aria-hidden /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          <DropdownMenuRadioGroup value={value[key]} onValueChange={next => onChange({ ...value, [key]: next })}>
            {options[key].map(([id, label]) => <DropdownMenuRadioItem key={id} value={id}>{label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>;
    })}
  </div>;
}
