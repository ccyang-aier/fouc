import 'client-only'

export type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

type TauriWindow = Window & {
  __TAURI__?: { core?: { invoke?: TauriInvoke } }
}

export type AppRuntime = 'server' | 'web' | 'tauri'

export function getAppRuntime(): AppRuntime {
  if (typeof window === 'undefined') return 'server'
  return (window as TauriWindow).__TAURI__?.core?.invoke ? 'tauri' : 'web'
}

export function getTauriInvoke(): TauriInvoke | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as TauriWindow).__TAURI__?.core?.invoke
}

/** Selects a feature client without coupling runtime type to data source. */
export function createRuntimeClient<T>(options: {
  primary: T
  isMockEnabled: () => boolean
  loadMock: () => Promise<T>
}): () => Promise<T> {
  let mockClient: Promise<T> | null = null

  return () => {
    const runtime = getAppRuntime()
    if (runtime === 'server') throw new Error('Runtime clients are only available in Client Components')
    if (!options.isMockEnabled()) return Promise.resolve(options.primary)
    mockClient ??= options.loadMock()
    return mockClient
  }
}
