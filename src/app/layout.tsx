import type { Metadata, Viewport } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Fouc · AI Agent 工作台",
  description: "面向个人与团队的人机协同 AI Agent 超级工作台。",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f3f4f4",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {/* 首帧标记运行时：桌面端且平台支持窗口特效时注入 head 标记（React 不清理外来 head 节点，
            html 属性会被 React 19 水合清除，不可用作载体），需在首绘前完成。
            标记 id 与 sidebar-material.css 保持一致（自 world 原样移植）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(window.__TAURI_INTERNALS__&&/Windows|Macintosh/.test(navigator.userAgent)){var s=document.createElement("style");s.id="world-glass-flag";(document.head||document.documentElement).appendChild(s)}}catch(e){}',
          }}
        />
        {children}
      </body>
    </html>
  )
}
