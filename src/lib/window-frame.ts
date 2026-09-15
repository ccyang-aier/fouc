"use client"

/**
 * 桌面端窗口自绘外框状态：
 * - html[data-desktop-frame]：启用透明边距 + CSS 阴影。系统 DWM 阴影在 Win10
 *   无装饰窗口上会画出发黑的 1px 描边且观感与 Win11 不一致，故关闭系统阴影
 *   （shadow:false + transparent:true），由应用层绘制，两端像素级一致。
 * - html[data-window-flat]：窗口贴住显示器任一边缘（最大化 / 贴边分屏）时
 *   收起边距与阴影，避免内容内缩出透明缝隙。
 * 返回清理函数，供壳层卸载时解除监听与标记。
 */
export async function manageWindowFrame(): Promise<() => void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return () => {}
  }

  const html = document.documentElement
  html.dataset.desktopFrame = ""

  const { getCurrentWindow, currentMonitor } = await import("@tauri-apps/api/window")
  const win = getCurrentWindow()
  let disposed = false

  // Win11 最大化的窗口会向显示器外溢出约 7px 隐藏 resize 边，需容差判定
  const EDGE_TOLERANCE = 8

  const flushWithMonitorEdge = async (): Promise<boolean> => {
    const monitor = await currentMonitor()
    if (!monitor) return false
    const position = await win.outerPosition()
    const size = await win.outerSize()
    const left = position.x
    const top = position.y
    const right = left + size.width
    const bottom = top + size.height
    const monitorLeft = monitor.position.x
    const monitorTop = monitor.position.y
    const monitorRight = monitorLeft + monitor.size.width
    const monitorBottom = monitorTop + monitor.size.height
    return (
      left <= monitorLeft + EDGE_TOLERANCE ||
      top <= monitorTop + EDGE_TOLERANCE ||
      right >= monitorRight - EDGE_TOLERANCE ||
      bottom >= monitorBottom - EDGE_TOLERANCE
    )
  }

  const sync = async () => {
    try {
      const flat = (await win.isMaximized()) || (await flushWithMonitorEdge())
      if (disposed) return
      if (flat) html.dataset.windowFlat = ""
      else delete html.dataset.windowFlat
    } catch {
      // 窗口几何查询失败时保持当前状态
    }
  }

  const unlistenResized = await win.onResized(() => void sync())
  const unlistenMoved = await win.onMoved(() => void sync())
  void sync()

  return () => {
    disposed = true
    unlistenResized()
    unlistenMoved()
    delete html.dataset.desktopFrame
    delete html.dataset.windowFlat
  }
}
