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
      <body>{children}</body>
    </html>
  )
}
