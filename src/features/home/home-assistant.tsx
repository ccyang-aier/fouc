"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type DirectionalFrame =
  | "neutral"
  | "left-soft"
  | "left"
  | "right-soft"
  | "right"
  | "up-soft"
  | "up"
  | "down-soft"
  | "down"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right"

type AssistantFrame = DirectionalFrame | "blink" | "success"

type HomeAssistantProps = {
  celebrating?: boolean
}

const FRAME_ASSETS: Record<AssistantFrame, string> = {
  neutral: "/brand/fouc-assistant.png",
  "left-soft": "/brand/assistant/look-left-soft.png",
  // 旧版极限左右帧以机器人自身视角命名，因此这里按屏幕视觉方向对调。
  left: "/brand/assistant/look-right.png",
  "right-soft": "/brand/assistant/look-right-soft.png",
  right: "/brand/assistant/look-left.png",
  "up-soft": "/brand/assistant/look-up-soft.png",
  up: "/brand/assistant/look-up.png",
  "down-soft": "/brand/assistant/look-down-soft.png",
  down: "/brand/assistant/look-down.png",
  "up-left": "/brand/assistant/look-up-left.png",
  "up-right": "/brand/assistant/look-up-right.png",
  "down-left": "/brand/assistant/look-down-left.png",
  "down-right": "/brand/assistant/look-down-right.png",
  blink: "/brand/assistant/blink.png",
  success: "/brand/assistant/success.png",
}

const FRAME_TRANSFORMS: Record<AssistantFrame, string> = {
  neutral: "translate3d(0, 0, 0) rotate(0deg)",
  "left-soft": "translate3d(-1px, 0, 0) rotate(-0.25deg)",
  left: "translate3d(-2px, 0, 0) rotate(-0.55deg)",
  "right-soft": "translate3d(1px, 0, 0) rotate(0.25deg)",
  right: "translate3d(2px, 0, 0) rotate(0.55deg)",
  "up-soft": "translate3d(0, -1px, 0)",
  up: "translate3d(0, -2px, 0)",
  "down-soft": "translate3d(0, 1px, 0)",
  down: "translate3d(0, 2px, 0)",
  "up-left": "translate3d(-1px, -1px, 0) rotate(-0.3deg)",
  "up-right": "translate3d(1px, -1px, 0) rotate(0.3deg)",
  "down-left": "translate3d(-1px, 1px, 0) rotate(-0.3deg)",
  "down-right": "translate3d(1px, 1px, 0) rotate(0.3deg)",
  blink: "translate3d(0, 0, 0)",
  success: "translate3d(0, -2px, 0) scale(1.015)",
}

const FRAMES = Object.keys(FRAME_ASSETS) as AssistantFrame[]

const FRAME_COORDINATES: Record<DirectionalFrame, readonly [number, number]> = {
  neutral: [0, 0],
  "left-soft": [-1, 0],
  left: [-2, 0],
  "right-soft": [1, 0],
  right: [2, 0],
  "up-soft": [0, -1],
  up: [0, -2],
  "down-soft": [0, 1],
  down: [0, 2],
  "up-left": [-1, -1],
  "up-right": [1, -1],
  "down-left": [-1, 1],
  "down-right": [1, 1],
}

const FRAME_BY_COORDINATE = new Map(
  Object.entries(FRAME_COORDINATES).map(([frame, [x, y]]) => [`${x},${y}`, frame as DirectionalFrame]),
)

function frameForPointer(element: HTMLDivElement, clientX: number, clientY: number): DirectionalFrame {
  const bounds = element.getBoundingClientRect()
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height * 0.42
  const dx = clientX - centerX
  const dy = clientY - centerY
  const distance = Math.hypot(dx, dy)

  if (distance < 34) return "neutral"

  const horizontal = Math.abs(dx)
  const vertical = Math.abs(dy)
  const horizontalCapacity = dx < 0 ? centerX : window.innerWidth - centerX
  const verticalCapacity = dy < 0 ? centerY : window.innerHeight - centerY
  const horizontalLimit = horizontal > 0 ? (horizontalCapacity * distance) / horizontal : Number.POSITIVE_INFINITY
  const verticalLimit = vertical > 0 ? (verticalCapacity * distance) / vertical : Number.POSITIVE_INFINITY
  const availableDistance = Math.max(1, Math.min(horizontalLimit, verticalLimit))
  const isFar = distance / availableDistance > 0.56

  if (horizontal > vertical * 1.55) {
    if (dx < 0) return isFar ? "left" : "left-soft"
    return isFar ? "right" : "right-soft"
  }

  if (vertical > horizontal * 1.55) {
    if (dy < 0) return isFar ? "up" : "up-soft"
    return isFar ? "down" : "down-soft"
  }

  if (dy < 0) return dx < 0 ? "up-left" : "up-right"
  return dx < 0 ? "down-left" : "down-right"
}

function nextFrameToward(current: DirectionalFrame, target: DirectionalFrame): DirectionalFrame {
  if (current === target) return current

  const [currentX, currentY] = FRAME_COORDINATES[current]
  const [targetX, targetY] = FRAME_COORDINATES[target]
  const nextX = currentX + Math.sign(targetX - currentX)
  const nextY = currentY + Math.sign(targetY - currentY)

  return FRAME_BY_COORDINATE.get(`${nextX},${nextY}`) ?? target
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
            "object-contain object-bottom transition-[opacity,transform] duration-100 ease-out will-change-[opacity,transform]",
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
  const frameStepTimerRef = useRef<number | null>(null)
  const latestPointerRef = useRef({ x: 0, y: 0 })
  const currentFrameRef = useRef<DirectionalFrame>("neutral")
  const targetFrameRef = useRef<DirectionalFrame>("neutral")
  const [pointerFrame, setPointerFrame] = useState<DirectionalFrame>("neutral")
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    function stepTowardTarget() {
      const nextFrame = nextFrameToward(currentFrameRef.current, targetFrameRef.current)
      currentFrameRef.current = nextFrame
      setPointerFrame(nextFrame)

      if (nextFrame === targetFrameRef.current) {
        frameStepTimerRef.current = null
        return
      }

      frameStepTimerRef.current = window.setTimeout(stepTowardTarget, 55)
    }

    function setTargetFrame(frame: DirectionalFrame) {
      targetFrameRef.current = frame
      if (frameStepTimerRef.current === null) stepTowardTarget()
    }

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
        setTargetFrame(nextFrame)
      })
    }

    function stopTracking() {
      settleTimerRef.current = window.setTimeout(() => setTargetFrame("neutral"), 360)
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
      if (frameStepTimerRef.current !== null) window.clearTimeout(frameStepTimerRef.current)
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
      className="pointer-events-none absolute -top-[126px] right-2 z-0 h-[142px] w-[142px] select-none drop-shadow-[0_7px_10px_rgba(34,39,45,0.045)] max-[760px]:-top-[96px] max-[760px]:right-0 max-[760px]:h-[112px] max-[760px]:w-[112px]"
    >
      <AssistantFrames activeFrame={activeFrame} />
    </div>
  )
}
