import type { Variants } from "motion/react"

/**
 * 侧栏双面板切换编排（工作台导航 ↔ 项目管理菜单）：
 * 容器带透视 3D 摆动（rotateY）与大位移弹簧推入，回落带轻微回弹；
 * 退场以加速曲线快速让位。内部区块级联上浮带回弹，形成明确可感的纵深节奏。
 * direction：+1 进入项目视图（自右推入），-1 返回工作台。
 */
export const paneContainerVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 64,
    opacity: 0,
    rotateY: direction * -6,
    scale: 0.96,
    filter: "blur(10px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    rotateY: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 26,
      staggerChildren: 0.04,
      delayChildren: 0.06,
    },
  },
  exit: (direction: number) => ({
    x: direction * -56,
    opacity: 0,
    rotateY: direction * 5,
    scale: 0.96,
    filter: "blur(8px)",
    transition: { duration: 0.24, ease: [0.3, 0, 0.8, 0.2] },
  }),
}

export const paneItemVariants: Variants = {
  enter: { opacity: 0, y: 18, scale: 0.98 },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
}
