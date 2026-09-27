import { forwardRef, type ReactElement } from 'react';
import { IconBase, type IconProps, type IconWeight } from '@phosphor-icons/react';

const glyph = <>
  <rect x="48" y="32" width="160" height="192" rx="36" fill="currentColor" opacity="0.12" />
  <rect x="48" y="32" width="160" height="192" rx="36" fill="none" stroke="currentColor" strokeWidth="16" />
  <path d="M88 104h80M88 152h48" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
</>;
const weights = new Map<IconWeight, ReactElement>([
  ['thin', glyph], ['light', glyph], ['regular', glyph],
  ['bold', glyph], ['fill', glyph], ['duotone', glyph],
]);

/** Rounded note with an unfinished line; no sharp pen tip or folded corner. */
export const DraftIcon = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <IconBase ref={ref} {...props} weights={weights} />
));
DraftIcon.displayName = 'DraftIcon';
