import 'client-only'

import { getAppRuntime } from './runtime-client'

const CONFIGURED_MOCKS = new Set(
  (process.env.NEXT_PUBLIC_FOUC_MOCKS ?? '')
    .split(',')
    .map((name) => name.trim().toLocaleLowerCase())
    .filter(Boolean),
)

/** Browser mocks are opt-in and never replace clients inside the Tauri shell. */
export function isBrowserMockEnabled(feature: string): boolean {
  if (getAppRuntime() !== 'web') return false
  const normalized = feature.trim().toLocaleLowerCase()
  return CONFIGURED_MOCKS.has('*') || CONFIGURED_MOCKS.has(normalized)
}
