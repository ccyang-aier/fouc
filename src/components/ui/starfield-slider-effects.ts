import { createStarfieldRenderer } from "./starfield-slider-renderer"

/** The native range owns interaction; this controller only schedules decorative rendering. */
export function createStarfieldEffect(canvas: HTMLCanvasElement) {
  let renderer = createStarfieldRenderer(canvas)
  if (!renderer) return
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let previousTime = 0
  let time = 0
  let ignition = 4
  let progress = 0
  let strength = 0.42
  let targetStrength = strength

  function draw() {
    renderer?.draw(motion.matches ? 1.5 : time, progress, strength, motion.matches ? 4 : ignition, motion.matches)
  }

  function tick(now: number) {
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60
    previousTime = now
    strength += (targetStrength - strength) * (1 - Math.exp(-delta * 16))
    time += delta * (0.65 + progress * 0.35)
    ignition += delta
    draw()
    frame = requestAnimationFrame(tick)
  }

  function refresh() {
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = 0
    if (motion.matches || document.hidden) strength = targetStrength
    draw()
    if (renderer && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick)
  }

  function resize() {
    // Layout dimensions stay stable during the popup's scale animation.
    if (!canvas.clientWidth || !canvas.clientHeight) return
    renderer?.resize(canvas.clientWidth, canvas.clientHeight)
    refresh()
  }

  function contextLost(event: Event) {
    event.preventDefault()
    cancelAnimationFrame(frame)
    renderer?.dispose()
    renderer = undefined
  }

  function contextRestored() {
    renderer = createStarfieldRenderer(canvas)
    resize()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  canvas.addEventListener("webglcontextlost", contextLost)
  canvas.addEventListener("webglcontextrestored", contextRestored)
  document.addEventListener("visibilitychange", refresh)
  motion.addEventListener("change", refresh)
  resize()

  return {
    setStrength(value: number) {
      const wasMaximum = progress === 1
      progress = value
      targetStrength = value === 1 ? 1 : 0.42 + value * 0.32
      if (value === 1 && !wasMaximum) ignition = 0.85
      if (value !== 1 && wasMaximum) ignition = 4
      if (value === 1 || wasMaximum || motion.matches || document.hidden) strength = targetStrength
      draw()
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener("webglcontextlost", contextLost)
      canvas.removeEventListener("webglcontextrestored", contextRestored)
      document.removeEventListener("visibilitychange", refresh)
      motion.removeEventListener("change", refresh)
      renderer?.dispose()
    },
  }
}
