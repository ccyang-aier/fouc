'use client';

import { ConnectorBackButton } from './connector-back-button';

export function ConnectorDetailHeader({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-3 px-3 py-4">
      <ConnectorBackButton onBack={onBack} />
      <h1 className="min-w-0 truncate text-[23px] leading-8 font-semibold tracking-[-0.025em] text-[var(--ink)]">
        {name}
      </h1>
    </header>
  );
}
