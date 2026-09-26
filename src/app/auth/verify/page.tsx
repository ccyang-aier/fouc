import { Suspense } from "react"
import type { Metadata } from "next"

import { VerifyEmailScene } from "@/features/knowledge/auth"

export const metadata: Metadata = {
  title: "邮箱验证 · Fouc",
}

function VerifyEmailFallback() {
  return (
    <main aria-label="邮箱验证" className="relative h-full overflow-y-auto bg-[var(--shell)]">
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="overlay-surface w-full max-w-[420px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-[12.5px] text-[var(--muted-strong)]">正在打开验证结果…</p>
        </div>
      </div>
    </main>
  )
}

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailScene />
    </Suspense>
  )
}
