"use client"

import { useMemo, useState } from "react"
import { Check, Desktop, SpeakerHigh } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

type ThemeId = "paper" | "ink" | "warm" | "sage" | "system"
type SidebarSurface = "standard" | "soft"

const THEMES: Array<{
  id: ThemeId
  label: string
  surface: string
  panel: string
  ink: string
  muted: string
}> = [
  { id: "paper", label: "纸感", surface: "#fafaf8", panel: "#ffffff", ink: "#242725", muted: "#d7d9d4" },
  { id: "ink", label: "油墨", surface: "#202326", panel: "#282c30", ink: "#f2f3f1", muted: "#3a3f44" },
  { id: "warm", label: "羊皮纸", surface: "#f5efe1", panel: "#fbf7ed", ink: "#3e392e", muted: "#d8ceb4" },
  { id: "sage", label: "护眼绿", surface: "#eaf0e7", panel: "#f3f6f0", ink: "#263a2f", muted: "#c5d2bf" },
  { id: "system", label: "跟随系统", surface: "#f7f7f7", panel: "#ffffff", ink: "#232527", muted: "#d8dad8" },
]

export function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemeId>("paper")
  const [sidebarSurface, setSidebarSurface] = useState<SidebarSurface>("soft")
  const [followSystem, setFollowSystem] = useState(true)
  const [volume, setVolume] = useState(40)

  const selectedTheme = useMemo(
    () => THEMES.find((item) => item.id === theme) ?? THEMES[0],
    [theme],
  )

  return (
    <div className="mx-auto w-full max-w-[800px] px-8 pb-14 pt-10 max-[980px]:px-6 max-[760px]:pt-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a7aaa5]">Appearance</p>
        <h1 className="mt-2 text-[25px] font-medium tracking-[-0.035em] text-[#282b29]">外观</h1>
        <p className="mt-2 text-[12px] leading-6 text-[#8d918d]">
          为长时间协作调校安静、稳定的视觉环境，修改会立即作用于设置预览。
        </p>
      </header>

      <div className="mt-7 grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6 max-[980px]:grid-cols-1">
        <div className="min-w-0">
          <fieldset>
            <legend className="mb-3 text-[12px] font-medium text-[#464a47]">主题</legend>
            <div className="grid grid-cols-5 gap-2.5 max-[1000px]:grid-cols-3 max-[720px]:grid-cols-2">
              {THEMES.map((item) => {
                const selected = item.id === theme
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(item.id)}
                    className={cn(
                      "relative rounded-[9px] border bg-white p-2 text-left outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[#6c91b2]/25",
                      selected
                        ? "border-[#5f84a4] shadow-[0_0_0_1px_#5f84a4]"
                        : "border-[#e5e6e3] hover:border-[#cfd3d1]",
                    )}
                  >
                    <span
                      className="relative block h-[78px] overflow-hidden rounded-[7px] border border-black/[0.07] p-3"
                      style={{ backgroundColor: item.surface }}
                      aria-hidden
                    >
                      <span className="block h-[5px] w-9 rounded-full" style={{ backgroundColor: item.ink }} />
                      <span className="mt-3 block h-[4px] w-12 rounded-full" style={{ backgroundColor: item.muted }} />
                      <span className="mt-2 block h-[4px] w-8 rounded-full" style={{ backgroundColor: item.muted }} />
                      {selected ? (
                        <span className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-[#5e84a5] text-white">
                          <Check className="size-3" weight="bold" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block px-0.5 text-[11px] text-[#5f6461]">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="my-7 h-px bg-[#ececea]" />

          <fieldset>
            <legend className="mb-3 text-[12px] font-medium text-[#464a47]">侧边栏材质</legend>
            <div className="grid grid-cols-2 gap-3">
              <SurfaceChoice
                id="standard"
                label="标准"
                selected={sidebarSurface === "standard"}
                onSelect={() => setSidebarSurface("standard")}
              />
              <SurfaceChoice
                id="soft"
                label="柔和层次"
                selected={sidebarSurface === "soft"}
                onSelect={() => setSidebarSurface("soft")}
              />
            </div>
          </fieldset>

          <section className="mt-8 overflow-hidden rounded-[10px] border border-[#e7e8e5] bg-white">
            <SettingRow
              title="跟随系统"
              description="自动响应操作系统的深浅色变化"
              control={
                <button
                  type="button"
                  role="switch"
                  aria-checked={followSystem}
                  onClick={() => setFollowSystem((current) => !current)}
                  className={cn(
                    "relative h-[22px] w-[38px] rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#6c91b2]/25",
                    followSystem ? "bg-[#5e84a5]" : "bg-[#d8dbd8]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[left]",
                      followSystem ? "left-[19px]" : "left-[3px]",
                    )}
                  />
                </button>
              }
            />
            <SettingRow
              title="界面声效"
              description="任务反馈、提醒与操作提示音量"
              last
              control={
                <div className="flex w-[220px] items-center gap-3 max-[720px]:w-[170px]">
                  <SpeakerHigh className="size-4 shrink-0 text-[#929793]" aria-hidden />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    aria-label="界面声效音量"
                    className="appearance-range min-w-0 flex-1"
                    style={{ "--range-progress": `${volume}%` } as React.CSSProperties}
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-[#777c78]">{volume}%</span>
                </div>
              }
            />
          </section>
        </div>

        <LivePreview theme={selectedTheme} softSidebar={sidebarSurface === "soft"} />
      </div>
    </div>
  )
}

function SurfaceChoice({
  id,
  label,
  selected,
  onSelect,
}: {
  id: SidebarSurface
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-[9px] border bg-white p-2 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#6c91b2]/25",
        selected
          ? "border-[#5f84a4] shadow-[0_0_0_1px_#5f84a4]"
          : "border-[#e5e6e3] hover:border-[#cfd3d1]",
      )}
    >
      <span
        className={cn(
          "block h-[47px] rounded-[7px] border border-black/[0.045]",
          id === "standard" ? "bg-[#f0f1f0]" : "bg-white/65 shadow-[inset_0_1px_0_white] backdrop-blur-xl",
        )}
      />
      <span className={cn("mt-2 block px-0.5 text-[11px]", selected ? "text-[#54708a]" : "text-[#646966]")}>{label}</span>
    </button>
  )
}

function SettingRow({
  title,
  description,
  control,
  last = false,
}: {
  title: string
  description: string
  control: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={cn("flex min-h-[76px] items-center justify-between gap-6 px-5", !last && "border-b border-[#eeeeec]")}>
      <div>
        <h2 className="text-[12px] font-medium text-[#3c403d]">{title}</h2>
        <p className="mt-1 text-[10.5px] text-[#a0a49f]">{description}</p>
      </div>
      {control}
    </div>
  )
}

function LivePreview({
  theme,
  softSidebar,
}: {
  theme: (typeof THEMES)[number]
  softSidebar: boolean
}) {
  return (
    <aside
      className={cn(
        "rounded-[14px] border border-black/[0.035] p-5",
        softSidebar && "shadow-[0_14px_40px_rgba(34,39,36,0.06)]",
      )}
      style={{ backgroundColor: theme.muted }}
      aria-label="实时预览"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#9da19d]">Live Preview</p>
        <Desktop className="size-4 text-[#a4a9a5]" aria-hidden />
      </div>
      <div
        className="mt-5 min-h-[290px] rounded-[10px] border border-black/[0.055] px-7 py-8 shadow-[0_8px_24px_rgba(34,39,36,0.045)]"
        style={{ backgroundColor: theme.panel, color: theme.ink }}
      >
        <p className="text-[10px] opacity-45">今日任务 · Fouc 协作空间</p>
        <h2 className="mt-8 text-[23px] font-medium tracking-[-0.03em]">让复杂工作清晰推进</h2>
        <p className="mt-7 text-[12px] leading-7 opacity-70">
          从一个清晰目标开始，Agent 会在同一条工作流中协作、反馈并持续推进。
        </p>
        <div className="mt-8 h-px opacity-70" style={{ backgroundColor: theme.muted }} />
        <p className="mt-6 text-[11px] leading-6 opacity-48">
          视觉偏好会即时同步到整个工作台。
        </p>
      </div>
    </aside>
  )
}
