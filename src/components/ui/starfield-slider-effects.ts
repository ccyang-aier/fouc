/** A small, decorative canvas; the range input owns every interaction. */
export function createStarfieldEffect(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")
  if (!context) return

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let width = 0
  let height = 0
  let previousTime = 0
  let phase = 0
  let progress = 0
  let strength = 0
  let targetStrength = 0
  let stars: { x: number; y: number; column: number; seed: number; row: number }[] = []

  function draw() {
    if (!context || !width || !height) return
    context.clearRect(0, 0, width, height)
    const time = motion.matches ? 1.5 : phase

    // Match the native 26px thumb's center; the unselected region stays transparent.
    const edge = 13 + (width - 26) * progress
    const halo = context.createLinearGradient(0, 0, edge, 0)
    halo.addColorStop(0, "rgba(118, 66, 195, 0)")
    halo.addColorStop(0.5, `rgba(129, 74, 197, ${strength * 0.1})`)
    halo.addColorStop(1, `rgba(210, 174, 255, ${strength * 0.3})`)
    context.fillStyle = halo
    context.fillRect(0, 0, width, height)

    const density = 0.36 + strength * 0.78
    for (const { x, y, column, seed, row } of stars) {
      if (x > edge + 3) continue
      const reveal = Math.min(1, Math.max(0, (density - seed) / 0.12))
      if (!reveal) continue
      const position = x / (edge + 13)
      const wave = Math.sin(column * 0.3 - time * 1.3 + row * 0.65)
      const shimmer = Math.sin(time * (1 + seed) + seed * 24)
      const brightness = Math.pow(position, 1.45) * (0.88 + wave * 0.16 + shimmer * 0.14)
      const opacity = Math.min(0.98, (0.05 + brightness) * (1 - Math.abs(row - 3) * 0.08)) * strength * reveal
      const lightness = Math.min(94, 69 + position * 24 + shimmer * 4)
      const size = 1.8 + seed * 0.85

      context.fillStyle = `hsla(${269 + seed * 12}, 85%, ${lightness}%, ${opacity})`
      context.fillRect(x - size / 2, y - size / 2, size, size)

      if (seed > 0.7 && brightness > 0.42) {
        const twinkle = Math.pow(0.5 + Math.sin(time * (3 + seed * 2) + seed * 24) * 0.5, 2)
        context.fillStyle = `rgba(247, 232, 255, ${opacity * 0.55 * twinkle})`
        context.fillRect(x - 2.4, y - 0.4, 4.8, 0.8)
        context.fillRect(x - 0.4, y - 2.4, 0.8, 4.8)
      }
    }

    const mask = context.createLinearGradient(Math.max(0, edge - 28), 0, edge, 0)
    mask.addColorStop(0, "#000")
    mask.addColorStop(1, "transparent")
    context.globalCompositeOperation = "destination-in"
    context.fillStyle = mask
    context.fillRect(0, 0, width, height)
    context.globalCompositeOperation = "source-over"
  }

  function tick(now: number) {
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60
    previousTime = now
    // Keep the subdued lower levels smooth without restarting their flow.
    strength += (targetStrength - strength) * (1 - Math.exp(-delta * 16))
    phase += delta * (0.35 + strength * 0.65)
    draw()
    frame = requestAnimationFrame(tick)
  }

  function refresh() {
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = 0
    if (motion.matches || document.hidden) strength = targetStrength
    draw()
    if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick)
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect()
    width = bounds.width
    height = bounds.height
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context?.setTransform(ratio, 0, 0, ratio, 0, 0)
    const columns = Math.ceil(width / 3.7)
    stars = Array.from({ length: columns * 7 }, (_, index) => {
      const column = Math.floor(index / 7)
      const row = index % 7
      return {
        x: column * 3.7,
        y: height / 2 + (row - 3) * 3.7,
        column,
        seed: ((column * 29 + row * 43 + column * row * 7) % 103) / 103,
        row,
      }
    })
    refresh()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  document.addEventListener("visibilitychange", refresh)
  motion.addEventListener("change", refresh)
  resize()

  return {
    setStrength(value: number) {
      const wasMaximum = progress === 1
      progress = value
      targetStrength = value === 1 ? 1 : 0.1 + value * 0.2
      // The final stop ignites at once; leaving it immediately restores the quiet levels.
      if (value === 1 || wasMaximum || motion.matches || document.hidden) strength = targetStrength
      draw()
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", refresh)
      motion.removeEventListener("change", refresh)
    },
  }
}
