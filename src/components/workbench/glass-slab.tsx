"use client"

/**
 * 液态玻璃底板：liquid-glass-react（官方包）原样渲染。
 * - 包面向中心锚定的悬浮药丸（根节点恒带 translate(-50%,-50%)），
 *   底板以 absolute + top/left 50% + width/height 100% 精确填满材质容器
 * - 包仅在 window resize 时重测玻璃尺寸；侧栏拖宽 / 收起动画期间由
 *   ResizeObserver 派发 resize 事件喂给包重测
 * - 包无 "use client" 指令且渲染期读取 navigator，静态导出预渲染会崩，
 *   因此经 next/dynamic ssr:false 挂载
 */
import dynamic from "next/dynamic"
import { useEffect, useRef } from "react"

const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false })

export function GlassSlab() {
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = anchor.current?.parentElement
    if (!host || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      window.dispatchEvent(new Event("resize"))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={anchor} className="contents">
      <LiquidGlass
        className="liquid-glass-slab"
        mode="shader"
        elasticity={0}
        cornerRadius={0}
        padding="0"
        style={{ position: "absolute", top: "50%", left: "50%", width: "100%", height: "100%" }}
      >
        <></>
      </LiquidGlass>
    </div>
  )
}
