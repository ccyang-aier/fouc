import type { Variants } from "motion/react"

/** 共享元素形变标记：工作台行的图标与项目身份徽章以此 layoutId 互相 morph */
export const IDENTITY_CHIP_LAYOUT_ID = "project-identity-chip"

/**
 * 侧栏双面板转场编排（工作台导航 ↔ 项目管理菜单）：
 * 进场采用 Material「容器变换」——菜单以圆角矩形从身份卡区域 clip-path 展开，
 * 配合共享元素形变（点击行的图标 morph 为 F1 徽章）建立两个视图的空间连续性；
 * 区块以铰链式 3D 翻牌级联落位。退场快速让位，不与进场争夺注意力。
 * direction：+1 进入项目视图，-1 返回工作台。
 */
export const paneContainerVariants: Variants = {
  enter: {
    clipPath: "inset(42% 30% 46% 30% round 20px)",
    opacity: 0,
  },
  center: {
    clipPath: "inset(0% 0% 0% 0% round 0px)",
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 210,
      damping: 27,
      staggerChildren: 0.045,
      delayChildren: 0.1,
    },
  },
  exit: (direction: number) => ({
    x: direction * -36,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  }),
}

/** 铰链式翻牌：区块绕自身上缘外翻落位，级联时呈翻牌板节奏 */
export const paneItemVariants: Variants = {
  enter: { opacity: 0, y: 16, rotateX: -38, transformOrigin: "50% -14px" },
  center: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transformOrigin: "50% -14px",
    transition: { type: "spring", stiffness: 300, damping: 22 },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.13 } },
}

/** 身份卡专用：只做位移淡入，避免级联翻转变换与共享元素 layout 投影互相干扰 */
export const paneIdentityVariants: Variants = {
  enter: { opacity: 0, y: 12 },
  center: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 30 },
  },
  exit: { opacity: 0, transition: { duration: 0.13 } },
}
