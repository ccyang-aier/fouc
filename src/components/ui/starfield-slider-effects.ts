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
  let strength = 0
  let targetStrength = 0
  let stars: { x: number; y: number; position: number; seed: number; row: number }[] = []

  function draw() {
    if (!context || !width || !height) return
    context.clearRect(0, 0, width, height)
    const time = motion.matches ? 1.5 : phase

    const halo = context.createLinearGradient(0, 0, width, 0)
    halo.addColorStop(0, `rgba(118, 66, 195, ${0.01 + strength * 0.03})`)
    halo.addColorStop(0.5, `rgba(154, 82, 235, ${0.03 + strength * 0.17})`)
    halo.addColorStop(1, `rgba(211, 174, 255, ${0.07 + strength * 0.34})`)
    context.fillStyle = halo
    context.fillRect(0, 0, width, height)

    const density = 0.28 + strength * 0.84
    for (const { x, y, position, seed, row } of stars) {
      // Fade new cells in rather than popping them on at discrete model levels.
      const reveal = Math.min(1, Math.max(0, (density - seed) / 0.12))
      if (!reveal) continue
      const wave = 0.5 + Math.sin(position * 15 - time * 4 + row * 0.7) * 0.5
      const shimmer = 0.5 + Math.sin(time * (2 + seed * 2) + seed * 24) * 0.5
      const flare = Math.pow(shimmer, 9)
      const envelope = 0.22 + Math.pow(position, 0.8) * 0.78
      const energy = (0.24 + strength * 0.84) * envelope * (0.45 + wave * 0.55 + flare * 0.65)
      const opacity = Math.min(0.98, reveal * energy * (1 - Math.abs(row - 3) * 0.07))
      const lightness = Math.min(97, 58 + strength * 14 + energy * 23)
      const size = 1.25 + seed * 0.5 + strength * 0.65

      // Bounded translucent halos keep the grid luminous without per-star blur filters.
      context.fillStyle = `rgba(182, 112, 255, ${opacity * (0.12 + strength * 0.2)})`
      context.fillRect(x - size, y - size, size * 2, size * 2)
      context.fillStyle = `hsla(${269 + seed * 12}, 90%, ${lightness}%, ${opacity})`
      context.fillRect(x - size / 2, y - size / 2, size, size)

      if (flare > 0.6 && seed > 0.65 - strength * 0.3) {
        const radius = 1.5 + strength * 1.8
        context.fillStyle = `rgba(255, 241, 255, ${opacity * flare * (0.45 + strength * 0.5)})`
        context.fillRect(x - radius, y - 0.4, radius * 2, 0.8)
        context.fillRect(x - 0.4, y - radius, 0.8, radius * 2)
      }
    }
  }

  function tick(now: number) {
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60
    previousTime = now
    // Preserve phase across level changes; density, light and flow ease together.
    strength += (targetStrength - strength) * (1 - Math.exp(-delta * 16))
    phase += delta * (0.3 + strength * 1.7)
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
    const columns = Math.ceil(width / 3.2)
    stars = Array.from({ length: columns * 7 }, (_, index) => {
      const column = Math.floor(index / 7)
      const row = index % 7
      return {
        x: column * 3.2 + 1.6,
        y: height / 2 + (row - 3) * 3.7,
        position: column / Math.max(1, columns - 1),
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
      targetStrength = value
      if (motion.matches || document.hidden) {
        strength = value
        draw()
      }
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", refresh)
      motion.removeEventListener("change", refresh)
    },
  }
}
