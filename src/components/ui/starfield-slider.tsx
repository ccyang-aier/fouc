"use client"

import { useEffect, useRef, type ComponentProps, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { createStarfieldEffect } from "./starfield-slider-effects"
import styles from "./starfield-slider.module.css"

type StarfieldSliderProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "min" | "max" | "step" | "onChange"
> & {
  value: number
  max: number
  onValueChange: (value: number) => void
}

export function StarfieldSlider({
  value,
  max,
  onValueChange,
  className,
  disabled,
  ...inputProps
}: StarfieldSliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const atMaximum = value === max

  useEffect(() => {
    if (!atMaximum || disabled || !canvasRef.current) return
    return createStarfieldEffect(canvasRef.current)
  }, [atMaximum, disabled])

  return (
    <div
      className={styles.root}
      data-max={atMaximum}
      data-disabled={disabled || undefined}
      style={{ "--starfield-progress": value / max } as CSSProperties}
    >
      <span className={styles.aura} aria-hidden="true" />
      <div className={styles.track} aria-hidden="true">
        <span className={styles.progress} />
        <span className={styles.stops}>
          {Array.from({ length: max + 1 }, (_, index) => <i key={index} />)}
        </span>
        <canvas ref={canvasRef} className={styles.field} />
      </div>
      <input
        {...inputProps}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        className={cn(styles.input, className)}
        onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  )
}
