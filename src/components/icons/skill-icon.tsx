import type { SVGProps } from 'react';

export function SkillIcon({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z" />
    <path d="m3 8 9 5 9-5M3 12.5l9 5 9-5M12 13v9" />
  </svg>;
}
