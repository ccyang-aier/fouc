"use client"

import { useEffect, useState } from "react"

type HomeAssistantProps = {
  celebrating?: boolean
}

type ExpressionFrame = "neutral" | "halfBlink" | "blink" | "happy" | "curious" | "focused"

type ExpressionStep = {
  frame: ExpressionFrame
  duration: number
}

const EXPRESSION_ATLAS_ASSET = "/brand/assistant/assistant-expression-atlas.webp"
const EXPRESSION_FRAMES: ExpressionFrame[] = ["neutral", "halfBlink", "blink", "happy", "curious", "focused"]
const AMBIENT_DELAY_MIN = 3800
const AMBIENT_DELAY_RANGE = 2800

const BLINK_SEQUENCE: ExpressionStep[] = [
  { frame: "halfBlink", duration: 70 },
  { frame: "blink", duration: 92 },
  { frame: "halfBlink", duration: 72 },
  { frame: "neutral", duration: 0 },
]

const HAPPY_SEQUENCE: ExpressionStep[] = [
  { frame: "happy", duration: 1350 },
  { frame: "neutral", duration: 0 },
]

const CURIOUS_SEQUENCE: ExpressionStep[] = [
  { frame: "curious", duration: 1150 },
  { frame: "neutral", duration: 0 },
]

const FOCUSED_SEQUENCE: ExpressionStep[] = [
  { frame: "focused", duration: 1250 },
  { frame: "neutral", duration: 0 },
]

function atlasPosition(index: number) {
  return `${(index / (EXPRESSION_FRAMES.length - 1)) * 100}%`
}

function pickAmbientSequence() {
  const roll = Math.random()
  if (roll < 0.64) return BLINK_SEQUENCE
  if (roll < 0.79) return HAPPY_SEQUENCE
  if (roll < 0.91) return CURIOUS_SEQUENCE
  return FOCUSED_SEQUENCE
}

function AssistantVisual({ celebrating = false }: HomeAssistantProps) {
  const [ambientExpression, setAmbientExpression] = useState<ExpressionFrame>("neutral")

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: number | null = null
    let cancelled = false

    function scheduleNextSequence() {
      const delay = AMBIENT_DELAY_MIN + Math.random() * AMBIENT_DELAY_RANGE
      timer = window.setTimeout(() => playSequence(pickAmbientSequence()), delay)
    }

    function playSequence(sequence: ExpressionStep[], index = 0) {
      if (cancelled) return

      const step = sequence[index]
      setAmbientExpression(step.frame)

      if (index === sequence.length - 1) {
        scheduleNextSequence()
        return
      }

      timer = window.setTimeout(() => playSequence(sequence, index + 1), step.duration)
    }

    if (!reducedMotionQuery.matches) scheduleNextSequence()

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [])

  const expression = celebrating ? "happy" : ambientExpression
  const frameIndex = EXPRESSION_FRAMES.indexOf(expression)

  return (
    <div
      aria-hidden="true"
      data-expression={expression}
      className="pointer-events-none absolute -top-[126px] right-2 z-0 h-[142px] w-[142px] select-none drop-shadow-[0_7px_10px_rgba(34,39,45,0.045)] max-[760px]:-top-[96px] max-[760px]:right-0 max-[760px]:h-[112px] max-[760px]:w-[112px]"
    >
      <span
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage: `url(${EXPRESSION_ATLAS_ASSET})`,
          backgroundPosition: `${atlasPosition(frameIndex)} 50%`,
          backgroundSize: `${EXPRESSION_FRAMES.length * 100}% 100%`,
        }}
      />
    </div>
  )
}

export function HomeAssistant(props: HomeAssistantProps) {
  return <AssistantVisual {...props} />
}
