"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type HomeAssistantProps = {
  celebrating?: boolean
}

type MotionPoint = {
  x: number
  y: number
}

type ExpressionFrame = "blink" | "success"

const ATLAS_ASSET = "/brand/assistant/look-atlas.webp"
const ATLAS_GRID_SIZE = 5
const ATLAS_CENTER_POSITION = "50% 50%"
const SPRING_RESPONSE = 14
const MOTION_EPSILON = 0.001
const POSE_HYSTERESIS = 0.58

const EXPRESSION_ASSETS: Record<ExpressionFrame, string> = {
  blink: "/brand/assistant/blink.png",
  success: "/brand/assistant/success.png",
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function removeDeadZone(value: number, deadZone = 0.055) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadZone) return 0
  return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone))
}

function normalizePointerAxis(delta: number, negativeCapacity: number, positiveCapacity: number) {
  const capacity = delta < 0 ? negativeCapacity : positiveCapacity
  return removeDeadZone(clamp(delta / Math.max(1, capacity), -1, 1))
}

function targetForPointer(element: HTMLDivElement, clientX: number, clientY: number): MotionPoint {
  const bounds = element.getBoundingClientRect()
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height * 0.42

  return {
    x: normalizePointerAxis(clientX - centerX, centerX, window.innerWidth - centerX),
    y: normalizePointerAxis(clientY - centerY, centerY, window.innerHeight - centerY),
  }
}

function atlasPosition(index: number) {
  return `${(index / (ATLAS_GRID_SIZE - 1)) * 100}%`
}

function updateAtlasPose(layer: HTMLSpanElement | null, pose: MotionPoint, motion: MotionPoint) {
  const gridX = ((motion.x + 1) / 2) * (ATLAS_GRID_SIZE - 1)
  const gridY = ((motion.y + 1) / 2) * (ATLAS_GRID_SIZE - 1)
  const nextColumn = Math.abs(gridX - pose.x) >= POSE_HYSTERESIS ? Math.round(gridX) : pose.x
  const nextRow = Math.abs(gridY - pose.y) >= POSE_HYSTERESIS ? Math.round(gridY) : pose.y

  if (nextColumn === pose.x && nextRow === pose.y) return
  pose.x = clamp(nextColumn, 0, ATLAS_GRID_SIZE - 1)
  pose.y = clamp(nextRow, 0, ATLAS_GRID_SIZE - 1)
  if (layer) layer.style.backgroundPosition = `${atlasPosition(pose.x)} ${atlasPosition(pose.y)}`
}

function AssistantVisual({ celebrating }: HomeAssistantProps) {
  const atlasLayerRef = useRef<HTMLSpanElement>(null)
  const atlasPoseRef = useRef<MotionPoint>({ x: 2, y: 2 })
  const visualRef = useRef<HTMLDivElement>(null)
  const targetMotionRef = useRef<MotionPoint>({ x: 0, y: 0 })
  const currentMotionRef = useRef<MotionPoint>({ x: 0, y: 0 })
  const animationFrameRef = useRef<number | null>(null)
  const previousAnimationTimeRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const blinkTimerRef = useRef<number | null>(null)
  const blinkReleaseTimerRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    function renderMotion(motion: MotionPoint) {
      updateAtlasPose(atlasLayerRef.current, atlasPoseRef.current, motion)
      if (!visualRef.current) return
      visualRef.current.style.transform = `translate3d(${(motion.x * 2.4).toFixed(2)}px, ${(motion.y * 1.8).toFixed(2)}px, 0) rotate(${(motion.x * 0.42).toFixed(2)}deg)`
    }

    function animate(timestamp: number) {
      const previousTimestamp = previousAnimationTimeRef.current ?? timestamp
      const deltaSeconds = Math.min(0.05, (timestamp - previousTimestamp) / 1000)
      previousAnimationTimeRef.current = timestamp

      const current = currentMotionRef.current
      const target = targetMotionRef.current
      const interpolation = reducedMotionQuery.matches ? 1 : 1 - Math.exp(-SPRING_RESPONSE * deltaSeconds)
      current.x += (target.x - current.x) * interpolation
      current.y += (target.y - current.y) * interpolation
      renderMotion(current)

      const remainingDistance = Math.hypot(target.x - current.x, target.y - current.y)
      if (remainingDistance > MOTION_EPSILON) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      current.x = target.x
      current.y = target.y
      renderMotion(current)
      animationFrameRef.current = null
      previousAnimationTimeRef.current = null
    }

    function ensureAnimation() {
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
      }
    }

    function updateFromPointer(event: PointerEvent) {
      if (!rootRef.current) return
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      targetMotionRef.current = targetForPointer(rootRef.current, event.clientX, event.clientY)
      ensureAnimation()
    }

    function stopTracking() {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = window.setTimeout(() => {
        targetMotionRef.current = { x: 0, y: 0 }
        ensureAnimation()
      }, 260)
    }

    window.addEventListener("pointermove", updateFromPointer, { passive: true })
    document.documentElement.addEventListener("mouseleave", stopTracking)
    window.addEventListener("blur", stopTracking)

    return () => {
      window.removeEventListener("pointermove", updateFromPointer)
      document.documentElement.removeEventListener("mouseleave", stopTracking)
      window.removeEventListener("blur", stopTracking)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  useEffect(() => {
    function scheduleBlink() {
      blinkTimerRef.current = window.setTimeout(() => {
        const motion = currentMotionRef.current
        const isNearNeutral = Math.hypot(motion.x, motion.y) < 0.12

        if (!celebrating && isNearNeutral) {
          setIsBlinking(true)
          blinkReleaseTimerRef.current = window.setTimeout(() => setIsBlinking(false), 135)
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

  const activeExpression: ExpressionFrame | null = celebrating ? "success" : isBlinking ? "blink" : null

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute -top-[126px] right-2 z-0 h-[142px] w-[142px] select-none drop-shadow-[0_7px_10px_rgba(34,39,45,0.045)] max-[760px]:-top-[96px] max-[760px]:right-0 max-[760px]:h-[112px] max-[760px]:w-[112px]"
    >
      <div ref={visualRef} className="absolute inset-0 will-change-transform">
        <div className="absolute inset-0 scale-[1.04] transform-gpu origin-bottom">
          <span
            ref={atlasLayerRef}
            className="absolute inset-0 bg-no-repeat will-change-[background-position]"
            style={{
              backgroundImage: `url(${ATLAS_ASSET})`,
              backgroundPosition: ATLAS_CENTER_POSITION,
              backgroundSize: `${ATLAS_GRID_SIZE * 100}% ${ATLAS_GRID_SIZE * 100}%`,
            }}
          />
        </div>

        {(Object.keys(EXPRESSION_ASSETS) as ExpressionFrame[]).map((frame) => (
          <Image
            key={frame}
            src={EXPRESSION_ASSETS[frame]}
            alt=""
            fill
            loading="eager"
            draggable={false}
            sizes="(max-width: 760px) 112px, 142px"
            className={cn(
              "object-contain object-bottom transition-opacity duration-75 ease-out",
              activeExpression === frame ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function HomeAssistant({ celebrating = false }: HomeAssistantProps) {
  return <AssistantVisual celebrating={celebrating} />
}
