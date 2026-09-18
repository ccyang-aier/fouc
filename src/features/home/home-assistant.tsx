"use client"

import { useEffect, useRef } from "react"

type HomeAssistantProps = {
  celebrating?: boolean
}

type MotionPoint = {
  x: number
  y: number
}

const MOTION_ATLAS_ASSET = "/brand/assistant/assistant-motion-atlas.webp"
const MOTION_ATLAS_COLUMNS = 24
const MOTION_ATLAS_ROWS = 5
const INITIAL_POSE: MotionPoint = { x: 12, y: 2 }
const SPRING_RESPONSE = 14
const MOTION_EPSILON = 0.001
const POSE_HYSTERESIS = 0.52

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

function updateAssistantPose(layer: HTMLSpanElement | null, pose: MotionPoint, motion: MotionPoint) {
  const gridX = ((motion.x + 1) / 2) * (MOTION_ATLAS_COLUMNS - 1)
  const gridY = ((motion.y + 1) / 2) * (MOTION_ATLAS_ROWS - 1)
  const nextColumn = stepPoseIndex(pose.x, gridX)
  const nextRow = stepPoseIndex(pose.y, gridY)

  if (nextColumn !== pose.x || nextRow !== pose.y) {
    pose.x = clamp(nextColumn, 0, MOTION_ATLAS_COLUMNS - 1)
    pose.y = clamp(nextRow, 0, MOTION_ATLAS_ROWS - 1)
    if (layer) {
      layer.style.backgroundPosition = `${atlasPosition(pose.x, MOTION_ATLAS_COLUMNS)} ${atlasPosition(pose.y, MOTION_ATLAS_ROWS)}`
    }
  }

  return { x: gridX - pose.x, y: gridY - pose.y }
}

function AssistantVisual({ celebrating = false }: HomeAssistantProps) {
  const assistantLayerRef = useRef<HTMLSpanElement>(null)
  const poseRef = useRef<MotionPoint>({ ...INITIAL_POSE })
  const targetMotionRef = useRef<MotionPoint>({ x: 0, y: 0 })
  const currentMotionRef = useRef<MotionPoint>({ x: 0, y: 0 })
  const animationFrameRef = useRef<number | null>(null)
  const previousAnimationTimeRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    function renderMotion(motion: MotionPoint) {
      return updateAssistantPose(assistantLayerRef.current, poseRef.current, motion)
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

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute -top-[126px] right-2 z-0 h-[142px] w-[142px] select-none drop-shadow-[0_7px_10px_rgba(34,39,45,0.045)] max-[760px]:-top-[96px] max-[760px]:right-0 max-[760px]:h-[112px] max-[760px]:w-[112px]"
    >
      <span
        ref={assistantLayerRef}
        className="absolute inset-0 bg-no-repeat will-change-[background-position]"
        style={{
          backgroundImage: `url(${MOTION_ATLAS_ASSET})`,
          backgroundPosition: `${atlasPosition(INITIAL_POSE.x, MOTION_ATLAS_COLUMNS)} ${atlasPosition(INITIAL_POSE.y, MOTION_ATLAS_ROWS)}`,
          backgroundSize: `${MOTION_ATLAS_COLUMNS * 100}% ${MOTION_ATLAS_ROWS * 100}%`,
          filter: celebrating ? "brightness(1.035) saturate(1.08)" : undefined,
          transition: "filter 180ms ease-out",
        }}
      />
    </div>
  )
}

export function HomeAssistant(props: HomeAssistantProps) {
  return <AssistantVisual {...props} />
}
