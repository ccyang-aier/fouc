import { Suspense } from "react"
import type { Metadata } from "next"

import { OAuthCallbackScene } from "@/features/identity"

export const metadata: Metadata = {
  title: "企业登录 · Fouc",
}

function OAuthCallbackFallback() {
  return (
    <main aria-label="企业登录" className="relative h-full overflow-y-auto bg-[var(--shell)]">
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="overlay-surface w-full max-w-[420px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-[12.5px] text-[var(--muted-strong)]">正在接收登录回跳…</p>
        </div>
      </div>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<OAuthCallbackFallback />}>
      <OAuthCallbackScene />
    </Suspense>
  )
}
