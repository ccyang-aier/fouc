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

const BODY_ASSET = "/brand/assistant/assistant-body.webp"
const HEAD_ATLAS_ASSET = "/brand/assistant/head-atlas.webp"
const HEAD_ATLAS_COLUMNS = 9
const HEAD_ATLAS_ROWS = 5
const ATLAS_CENTER_POSITION = "50% 50%"
const YAW_STEP_DEGREES = 8
const PITCH_STEP_DEGREES = 7
const SPRING_RESPONSE = 18
const MOTION_EPSILON = 0.001
const POSE_HYSTERESIS = 0.54
const MAX_RESIDUAL_ROTATION = 0.72

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

function atlasPosition(index: number, frameCount: number) {
  return `${(index / (frameCount - 1)) * 100}%`
}

function stepPoseIndex(current: number, target: number) {
  if (target > current + POSE_HYSTERESIS) return current + 1
  if (target < current - POSE_HYSTERESIS) return current - 1
  return current
}

function updateHeadPose(layer: HTMLSpanElement | null, pose: MotionPoint, motion: MotionPoint) {
  const gridX = ((motion.x + 1) / 2) * (HEAD_ATLAS_COLUMNS - 1)
  const gridY = ((motion.y + 1) / 2) * (HEAD_ATLAS_ROWS - 1)
  const nextColumn = stepPoseIndex(pose.x, gridX)
  const nextRow = stepPoseIndex(pose.y, gridY)

  if (nextColumn !== pose.x || nextRow !== pose.y) {
    pose.x = clamp(nextColumn, 0, HEAD_ATLAS_COLUMNS - 1)
    pose.y = clamp(nextRow, 0, HEAD_ATLAS_ROWS - 1)
    if (layer) {
      layer.style.backgroundPosition = `${atlasPosition(pose.x, HEAD_ATLAS_COLUMNS)} ${atlasPosition(pose.y, HEAD_ATLAS_ROWS)}`
    }
  }

  return { x: gridX - pose.x, y: gridY - pose.y }
}

function AssistantVisual({ celebrating }: HomeAssistantProps) {
  const headLayerRef = useRef<HTMLSpanElement>(null)
  const headPoseRef = useRef<MotionPoint>({ x: 4, y: 2 })
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
      const residual = updateHeadPose(headLayerRef.current, headPoseRef.current, motion)
      if (!headLayerRef.current) return residual
      const residualYaw = clamp(residual.x, -MAX_RESIDUAL_ROTATION, MAX_RESIDUAL_ROTATION) * YAW_STEP_DEGREES
      const residualPitch = clamp(residual.y, -MAX_RESIDUAL_ROTATION, MAX_RESIDUAL_ROTATION) * PITCH_STEP_DEGREES
      headLayerRef.current.style.transform = `perspective(320px) rotateY(${residualYaw.toFixed(2)}deg) rotateX(${(-residualPitch).toFixed(2)}deg)`
      return residual
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
      const poseResidual = renderMotion(current)

      const remainingDistance = Math.hypot(target.x - current.x, target.y - current.y)
      const poseNeedsFrame =
        Math.abs(poseResidual.x) > POSE_HYSTERESIS || Math.abs(poseResidual.y) > POSE_HYSTERESIS
      if (remainingDistance > MOTION_EPSILON || poseNeedsFrame) {
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
      <div className="absolute inset-0">
        <div className="absolute inset-0 scale-[1.04] origin-bottom">
          <span
            ref={headLayerRef}
            className="absolute inset-y-0 left-1/2 w-[95.52%] -translate-x-1/2 bg-no-repeat transform-gpu will-change-[transform,background-position]"
            style={{
              backgroundImage: `url(${HEAD_ATLAS_ASSET})`,
              backgroundPosition: ATLAS_CENTER_POSITION,
              backgroundSize: `${HEAD_ATLAS_COLUMNS * 100}% ${HEAD_ATLAS_ROWS * 100}%`,
              transformOrigin: "50% 70%",
            }}
          />
          <div className="absolute inset-y-0 left-1/2 w-[95.52%] -translate-x-1/2">
            <Image
              src={BODY_ASSET}
              alt=""
              fill
              priority
              draggable={false}
              sizes="(max-width: 760px) 107px, 136px"
              className="object-fill"
            />
          </div>
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
