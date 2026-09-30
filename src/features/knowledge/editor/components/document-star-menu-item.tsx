'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DocumentStarIcon, useDocumentStarFeedback } from './document-star-icon';

export function DocumentStarMenuItem({ starred, onToggleStar, className }: {
  starred: boolean;
  onToggleStar: () => void;
  className?: string;
}) {
  const feedback = useDocumentStarFeedback(starred, onToggleStar);
  return <DropdownMenuItem className={className} onSelect={(event) => { event.preventDefault(); feedback.toggle(); }}>
    <DocumentStarIcon starred={starred} celebrating={feedback.celebrating} onAnimationEnd={feedback.finish} size={16} />
    {starred ? '取消收藏' : '收藏'}
  </DropdownMenuItem>;
}
