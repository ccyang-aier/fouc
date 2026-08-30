export type WindowAction = "minimize" | "toggleMaximize" | "close"

export async function performWindowAction(action: WindowAction) {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  const appWindow = getCurrentWindow()
  await appWindow[action]()
}
