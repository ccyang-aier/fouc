import type { Variants } from "motion/react"

/**
 * 侧栏双面板切换编排（工作台导航 ↔ 项目管理菜单）：
 * 容器做方向感知的推挤滑移（位移 + 淡入 + 轻缩放 + 模糊景深），
 * 内部区块以短弹簧级联浮现，形成有层次的进场节奏。
 * direction：+1 进入项目视图（内容自右向左推入），-1 返回工作台。
 */
export const paneContainerVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 36,
    opacity: 0,
    scale: 0.988,
    filter: "blur(8px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 320,
      damping: 32,
      staggerChildren: 0.032,
      delayChildren: 0.05,
    },
  },
  exit: (direction: number) => ({
    x: direction * -36,
    opacity: 0,
    scale: 0.988,
    filter: "blur(8px)",
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  }),
}

export const paneItemVariants: Variants = {
  enter: { opacity: 0, y: 10 },
  center: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 34 },
  },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}
