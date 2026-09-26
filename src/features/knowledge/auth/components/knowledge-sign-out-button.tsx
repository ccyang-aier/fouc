'use client';

/**
 * Sign-out affordance (A04) for the app shell to mount (user menu, account
 * row). Clicking revokes the Fouc session server-side (`POST
 * /api/auth/sign-out`), clears local auth artifacts, and returns to the
 * sign-in entry with a notice — a full navigation, so every in-memory cache
 * dies with the document. Failures surface a non-fatal message instead of
 * silently leaving a live session.
 */

import { useState, type ComponentProps } from 'react';
import { CircleNotch, SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor } from '../auth-errors';
import { signOutAndReturnToSignIn } from '../session';

export function KnowledgeSignOutButton({ label = '退出登录', ...buttonProps }: ComponentProps<typeof Button> & { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await signOutAndReturnToSignIn();
    if (!result.ok) {
      setBusy(false);
      setFailure(authErrorCopyFor(result.cause).description);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={busy}
      aria-busy={busy}
      title={failure ?? undefined}
      onClick={() => void signOut()}
      {...buttonProps}
    >
      {busy ? <CircleNotch className="size-4 animate-spin" aria-hidden /> : <SignOut className="size-4" aria-hidden />}
      {failure ? '退出失败,请重试' : label}
      {failure ? <span role="alert" className="sr-only">{failure}</span> : null}
    </Button>
  );
}
