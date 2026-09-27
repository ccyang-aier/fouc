import { Suspense } from "react"
import type { Metadata } from "next"

import { AuthEntryScene } from "@/features/identity"

export const metadata: Metadata = {
  title: "登录 · Fouc",
}

/** Pre-render fallback: the static stage without client-only search params. */
function AuthEntryFallback() {
  return (
    <main aria-label="Fouc 登录" className="relative h-full overflow-y-auto bg-[var(--shell)]">
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="overlay-surface w-full max-w-[400px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-[12.5px] text-[var(--muted-strong)]">正在加载登录…</p>
        </div>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthEntryFallback />}>
      <AuthEntryScene />
    </Suspense>
  )
}
