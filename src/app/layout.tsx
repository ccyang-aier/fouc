import type { Metadata, Viewport } from "next"

import "./globals.css"
import { IdentityProvider } from "@/features/identity/identity-provider"

export const metadata: Metadata = {
  title: "Fouc · AI Agent 工作台",
  icons: { icon: "/brand/fouc-mark.png" },
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

/* 首帧运行时脚本：从 localStorage 恢复外观偏好（主题 / 字体族 / 字号），
   避免深色闪白。与 lib/appearance.ts 的键名与应用逻辑保持同步。 */
const BOOT_SCRIPT = `
try{var p=JSON.parse(localStorage.getItem("fouc.appearance")||"null")||{};var h=document.documentElement;var r=p.theme==="dark"||p.theme==="light"?p.theme:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");h.dataset.theme=r;h.dataset.accent=p.accent||"mineral";if(p.accent==="custom"&&p.accentCustom)h.style.setProperty("--accent-custom",p.accentCustom);h.style.colorScheme=r;if(p.uiFont)h.dataset.uiFont=p.uiFont;if(p.codeFont)h.dataset.codeFont=p.codeFont;if(p.chatFont)h.dataset.chatFont=p.chatFont;if(p.uiFontSize)h.style.setProperty("--ui-size",p.uiFontSize+"px");if(p.codeFontSize)h.style.setProperty("--code-size",p.codeFontSize+"px");if(p.chatFontSize)h.style.setProperty("--chat-size",p.chatFontSize+"px")}catch(e){}
`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  )
}
