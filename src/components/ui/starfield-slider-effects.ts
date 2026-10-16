/** A small, decorative canvas; the range input owns every interaction. */
export function createStarfieldEffect(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")
  if (!context) return

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let width = 0
  let height = 0
  let previousTime = 0
  const startedAt = performance.now()

  function draw(time: number) {
    if (!context || !width || !height) return
    context.clearRect(0, 0, width, height)

    const halo = context.createLinearGradient(0, 0, width, 0)
    halo.addColorStop(0, "rgba(118, 66, 195, 0)")
    halo.addColorStop(0.5, "rgba(129, 74, 197, 0.1)")
    halo.addColorStop(1, "rgba(210, 174, 255, 0.3)")
    context.fillStyle = halo
    context.fillRect(0, 0, width, height)

    const spacing = 3.7
    const rows = 7
    const columns = Math.ceil(width / spacing)
    const top = (height - (rows - 1) * spacing) / 2
    for (let column = 0; column < columns; column++) {
      const position = column / (columns - 1)
      const envelope = Math.pow(position, 1.45)
      for (let row = 0; row < rows; row++) {
        const seed = ((column * 29 + row * 43 + column * row * 7) % 103) / 103
        const wave = Math.sin(column * 0.3 - time * 1.3 + row * 0.65)
        const shimmer = Math.sin(time * (1 + seed) + seed * 24)
        const brightness = envelope * (0.88 + wave * 0.16 + shimmer * 0.14)
        const centerWeight = 1 - Math.abs(row - 3) * 0.08
        const opacity = Math.min(0.98, (0.05 + brightness) * centerWeight)
        const lightness = Math.min(94, 69 + position * 24 + shimmer * 4)
        const size = 1.8 + seed * 0.85
        const x = column * spacing
        const y = top + row * spacing
        context.fillStyle = `hsla(${269 + seed * 12}, 85%, ${lightness}%, ${opacity})`
        context.fillRect(x - size / 2, y - size / 2, size, size)

        if (seed > 0.95 && brightness > 0.42) {
          context.fillStyle = `rgba(247, 232, 255, ${opacity * 0.55})`
          context.fillRect(x - 2.4, y - 0.4, 4.8, 0.8)
          context.fillRect(x - 0.4, y - 2.4, 0.8, 4.8)
        }
      }
    }
  }

  function tick(now: number) {
    // Thirty frames per second keeps the glimmer soft without repainting React.
    if (now - previousTime >= 1000 / 30) {
      draw((now - startedAt) / 1000)
      previousTime = now
    }
    frame = requestAnimationFrame(tick)
  }

  function refresh() {
    cancelAnimationFrame(frame)
    frame = 0
    draw(motion.matches ? 1.5 : (performance.now() - startedAt) / 1000)
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
    refresh()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  document.addEventListener("visibilitychange", refresh)
  motion.addEventListener("change", refresh)
  resize()

  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    document.removeEventListener("visibilitychange", refresh)
    motion.removeEventListener("change", refresh)
  }
}
