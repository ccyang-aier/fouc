import type { Metadata, Viewport } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Fouc · AI Agent 工作台",
  description: "面向个人与团队的人机协同 AI Agent 超级工作台。",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f4" },
    { media: "(prefers-color-scheme: dark)", color: "#101214" },
  ],
}

/* 首帧运行时脚本：
   1) 桌面端且平台支持窗口特效时注入 head 标记（React 不清理外来 head 节点，
      html 属性会被 React 19 水合清除，不可用作载体），需在首绘前完成；
      标记 id 与 sidebar-material.css 保持一致。
   2) 从 localStorage 恢复外观偏好（主题 / 字体族 / 字号 / 动效），避免深色闪白。
      与 lib/appearance.ts 的键名与应用逻辑保持同步。 */
const BOOT_SCRIPT = `
try{if(window.__TAURI_INTERNALS__&&/Windows|Macintosh/.test(navigator.userAgent)){var s=document.createElement("style");s.id="world-glass-flag";(document.head||document.documentElement).appendChild(s)}}catch(e){}
try{var p=JSON.parse(localStorage.getItem("fouc.appearance")||"null")||{};var h=document.documentElement;var r=p.theme==="dark"||p.theme==="light"?p.theme:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");h.dataset.theme=r;h.dataset.accent=p.accent||"mineral";h.style.colorScheme=r;if(p.uiFont)h.dataset.uiFont=p.uiFont;if(p.codeFont)h.dataset.codeFont=p.codeFont;if(p.chatFont)h.dataset.chatFont=p.chatFont;if(p.uiFontSize)h.style.setProperty("--ui-size",p.uiFontSize+"px");if(p.codeFontSize)h.style.setProperty("--code-size",p.codeFontSize+"px");if(p.chatFontSize)h.style.setProperty("--chat-size",p.chatFontSize+"px");if(p.reducedMotion)h.dataset.reducedMotion=""}catch(e){}
`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
