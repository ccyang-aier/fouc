"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type AssistantFrame = "neutral" | "left" | "right" | "up" | "down" | "blink" | "success"

type HomeAssistantProps = {
  celebrating?: boolean
}

const FRAME_ASSETS: Record<AssistantFrame, string> = {
  neutral: "/brand/fouc-assistant.png",
  // ImageGen 的左右以机器人自身视角命名，因此这里按屏幕视觉方向对调。
  left: "/brand/assistant/look-right.png",
  right: "/brand/assistant/look-left.png",
  up: "/brand/assistant/look-up.png",
  down: "/brand/assistant/look-down.png",
  blink: "/brand/assistant/blink.png",
  success: "/brand/assistant/success.png",
}

const FRAME_TRANSFORMS: Record<AssistantFrame, string> = {
  neutral: "translate3d(0, 0, 0) rotate(0deg)",
  left: "translate3d(-3px, 0, 0) rotate(-0.8deg)",
  right: "translate3d(3px, 0, 0) rotate(0.8deg)",
  up: "translate3d(0, -3px, 0)",
  down: "translate3d(0, 2px, 0)",
  blink: "translate3d(0, 0, 0)",
  success: "translate3d(0, -2px, 0) scale(1.015)",
}

const FRAMES = Object.keys(FRAME_ASSETS) as AssistantFrame[]

function frameForPointer(element: HTMLDivElement, clientX: number, clientY: number): AssistantFrame {
  const bounds = element.getBoundingClientRect()
  const dx = clientX - (bounds.left + bounds.width / 2)
  const dy = clientY - (bounds.top + bounds.height * 0.42)

  if (Math.hypot(dx, dy) < 26) return "neutral"
  if (Math.abs(dx) > Math.abs(dy) * 0.82) return dx < 0 ? "left" : "right"
  return dy < 0 ? "up" : "down"
}

function AssistantFrames({ activeFrame }: { activeFrame: AssistantFrame }) {
  return (
    <div className="absolute inset-0">
      {FRAMES.map((frame) => (
        <Image
          key={frame}
          src={FRAME_ASSETS[frame]}
          alt=""
          fill
          priority={frame === "neutral"}
          loading={frame === "neutral" ? undefined : "eager"}
          draggable={false}
          sizes="(max-width: 760px) 112px, 142px"
          className={cn(
            "object-contain object-bottom transition-[opacity,transform] duration-150 ease-out will-change-[opacity,transform]",
            frame === activeFrame ? "opacity-100" : "opacity-0",
          )}
          style={{ transform: FRAME_TRANSFORMS[activeFrame] }}
        />
      ))}
    </div>
  )
}

export function HomeAssistant({ celebrating = false }: HomeAssistantProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const blinkTimerRef = useRef<number | null>(null)
  const blinkReleaseTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const pointerFrameRequestRef = useRef<number | null>(null)
  const latestPointerRef = useRef({ x: 0, y: 0 })
  const [pointerFrame, setPointerFrame] = useState<AssistantFrame>("neutral")
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    function updateFromPointer(event: PointerEvent) {
      latestPointerRef.current = { x: event.clientX, y: event.clientY }
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      setIsBlinking(false)

      if (pointerFrameRequestRef.current !== null) return
      pointerFrameRequestRef.current = window.requestAnimationFrame(() => {
        pointerFrameRequestRef.current = null
        if (!rootRef.current) return
        const { x, y } = latestPointerRef.current
        const nextFrame = frameForPointer(rootRef.current, x, y)
        setPointerFrame((current) => (current === nextFrame ? current : nextFrame))
      })
    }

    function stopTracking() {
      settleTimerRef.current = window.setTimeout(() => setPointerFrame("neutral"), 360)
    }

    window.addEventListener("pointermove", updateFromPointer, { passive: true })
    document.documentElement.addEventListener("mouseleave", stopTracking)
    window.addEventListener("blur", stopTracking)

    return () => {
      window.removeEventListener("pointermove", updateFromPointer)
      document.documentElement.removeEventListener("mouseleave", stopTracking)
      window.removeEventListener("blur", stopTracking)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      if (pointerFrameRequestRef.current !== null) window.cancelAnimationFrame(pointerFrameRequestRef.current)
    }
  }, [])

  useEffect(() => {
    function scheduleBlink() {
      blinkTimerRef.current = window.setTimeout(() => {
        if (!celebrating) {
          setIsBlinking(true)
          blinkReleaseTimerRef.current = window.setTimeout(() => setIsBlinking(false), 150)
        }
        scheduleBlink()
      }, 3800 + Math.random() * 2400)
    }

    scheduleBlink()
    return () => {
      if (blinkTimerRef.current !== null) window.clearTimeout(blinkTimerRef.current)
      if (blinkReleaseTimerRef.current !== null) window.clearTimeout(blinkReleaseTimerRef.current)
    }
  }, [celebrating])

  const activeFrame = celebrating ? "success" : isBlinking ? "blink" : pointerFrame

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute -top-[134px] right-2 z-0 h-[142px] w-[142px] select-none drop-shadow-[0_7px_10px_rgba(34,39,45,0.045)] max-[760px]:-top-[104px] max-[760px]:right-0 max-[760px]:h-[112px] max-[760px]:w-[112px]"
    >
      <AssistantFrames activeFrame={activeFrame} />
    </div>
  )
}
