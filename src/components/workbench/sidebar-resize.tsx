"use client"

/**
 * 侧栏宽度拖拽（工作台侧栏与设置侧栏共用）：
 * 拖拽期间由全局 pointermove 更新宽度并夹在上下限内，松手后恢复宽度过渡。
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { cn } from "@/lib/utils"

const MIN_WIDTH = 200
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 240

export function useSidebarWidth() {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null)

  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => {
      const start = dragStart.current
      if (!start) return
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start.width + event.clientX - start.pointerX)))
    }
    const stop = () => {
      dragStart.current = null
      setDragging(false)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop, { once: true })
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
  }, [dragging])

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    dragStart.current = { pointerX: event.clientX, width }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  return { width, dragging, startResize }
}

/** 侧栏右缘拖拽手柄：hover 显现 1px 分隔线，拖拽中加粗。 */
export function SidebarResizeHandle({
  dragging,
  onPointerDown,
}: {
  dragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      aria-label="拖拽调整侧栏宽度"
      title="拖拽调整侧栏宽度"
      onPointerDown={onPointerDown}
      /* globals.css 的 button { cursor: default } 会压过 cursor-col-resize 工具类，内联保住手柄光标 */
      style={{ cursor: "col-resize" }}
      className={cn(
        /* 分割线顶部下移 16px：与主内容区 rounded-tl-[16px] 圆角等高，加粗线不顶着圆角曲线 */
        "absolute inset-y-0 right-[-4px] z-30 w-[9px] cursor-col-resize touch-none outline-none before:absolute before:top-[16px] before:bottom-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-ink before:opacity-0 before:transition-[opacity,width] before:duration-150 hover:before:opacity-90 focus-visible:before:opacity-90",
        dragging && "before:w-[2px] before:opacity-100",
      )}
    />
  )
}
