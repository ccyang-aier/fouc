"use client"

import { useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import {
  Archive,
  Bell,
  BookOpenText,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Desktop,
  DotsThree,
  DotsThreeCircle,
  FolderOpen,
  Folders,
  Funnel,
  GearSix,
  Lightning,
  PencilSimple,
  Plus,
  PlusCircle,
  PlugsConnected,
  Star,
  UsersThree,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { ProjectManagementPanelId } from "./project/project-management-model"
import { paneContainerVariants, paneItemVariants } from "./sidebar-pane-motion"
import { ProjectSidebarPane } from "./sidebar-project-pane"
import { SidebarNavList, type SidebarNavItem } from "./sidebar-nav"
import { SidebarResizeHandle, useSidebarWidth } from "./sidebar-resize"

export type WorkbenchView = "home" | "settings" | "projects" | "agent-hub" | "automation" | "knowledge" | "more"

const navigation: Array<SidebarNavItem<WorkbenchView>> = [
  { id: "home", label: "助理", icon: ChatCircleDots },
  { id: "projects", label: "项目", icon: FolderOpen },
  { id: "agent-hub", label: "Agent · 技能 · 连接器", icon: PlugsConnected },
  { id: "automation", label: "自动化", icon: Lightning },
  { id: "knowledge", label: "知识库", icon: BookOpenText },
  { id: "more", label: "更多", icon: DotsThreeCircle },
]

const SIDEBAR_VERSION = "v0.1.0"

type SpaceItem = { id: string; label: string; icon: typeof Folders }
type SidebarPaneMode = "workbench" | "project"

/** 空间行高度（h-9），行容器的高度弹簧动画据此收放 */
const SPACE_ROW_HEIGHT = 36

function DenseCollapseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="3.5" height="10" rx="1.25" fill="currentColor" opacity="0.55" />
      <rect x="6.5" y="3" width="7.5" height="10" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="110" cy="110" r="68" stroke="currentColor" strokeWidth="24" />
      <path d="M163 163l49 49" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
    </svg>
  )
}

export function Sidebar({
  collapsed,
  onToggle,
  onNewMission,
  view,
  onViewChange,
  projectFavorited,
  onProjectFavoriteChange,
  managementPanel,
  onManagementPanelChange,
}: {
  collapsed: boolean
  onToggle: () => void
  onNewMission: () => void
  view: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
  projectFavorited: boolean
  onProjectFavoriteChange: (favorited: boolean) => void
  managementPanel: ProjectManagementPanelId | null
  onManagementPanelChange: (panel: ProjectManagementPanelId | null) => void
}) {
  const [spacesOpen, setSpacesOpen] = useState(true)
  const [recentOpen, setRecentOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "spaces" | "recent">("all")
  const [spaces, setSpaces] = useState<SpaceItem[]>([
    { id: "product-development", label: "产品研发", icon: Folders },
    { id: "personal-workspace", label: "个人工作台", icon: UsersThree },
  ])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [rowFavorites, setRowFavorites] = useState<Record<string, boolean>>({})
  const { width, dragging, startResize } = useSidebarWidth()

  // 中段菜单区在「工作台导航」与「项目管理菜单」间切换：
  // AnimatePresence 同时挂载进退两个面板，做方向感知的推挤转场
  const paneMode: SidebarPaneMode = view === "projects" ? "project" : "workbench"
  const paneDirection = paneMode === "project" ? 1 : -1

  function createSpace() {
    setSpacesOpen(true)
    setSpaces((items) => [...items, { id: `space-${Date.now()}`, label: "未命名空间", icon: Folders }])
  }

  function commitRename(id: string, label: string) {
    setRenamingId(null)
    const next = label.trim()
    if (!next) return
    setSpaces((items) => items.map((item) => (item.id === id ? { ...item, label: next } : item)))
  }

  function archiveSpace(id: string) {
    setSpaces((items) => items.filter((item) => item.id !== id))
  }

  const visibleSpaces = searchQuery ? spaces.filter((item) => item.label.includes(searchQuery)) : spaces

  const workbenchPane = (
    <>
      <motion.nav variants={paneItemVariants} aria-label="主导航">
        <SidebarNavList
          items={navigation}
          value={view === "projects" ? null : view}
          onChange={onViewChange}
          collapsible
          renderTrailing={(item) =>
            item.id === "more" ? (
              <CaretRight className="sidebar-label ml-auto size-3 text-[var(--muted)]" aria-hidden />
            ) : null
          }
        />
      </motion.nav>

      {projectFavorited && filter === "all" ? (
        <motion.section variants={paneItemVariants} className="mt-5" aria-label="收藏项目">
          <div className={cn("flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]", collapsed && "justify-center px-0")}>
            <span className={cn("sidebar-label", collapsed && "hidden")}>收藏</span>
            <Star className={cn("ml-auto size-3 text-[#d79a3b]", !collapsed && "hidden")} weight="fill" />
          </div>
          {searchQuery && !"Fouc 桌面端 V1".includes(searchQuery) ? null : (
            <button
              type="button"
              aria-label="打开收藏项目 Fouc 桌面端 V1"
              onClick={() => onViewChange("projects")}
              className={cn(
                "mt-px flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium text-[var(--ink-soft)] outline-none transition-[background-color,box-shadow] hover:bg-raise hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Star className="size-[15px] shrink-0 text-[#d79a3b]" weight="fill" />
              <span className="sidebar-label truncate">Fouc 桌面端 V1</span>
            </button>
          )}
        </motion.section>
      ) : null}

      <motion.section variants={paneItemVariants} className={cn(projectFavorited && filter === "all" ? "mt-3" : "mt-5", filter === "recent" && "hidden")} aria-label="工作空间">
        <div
          className={cn(
            "flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]",
            collapsed && "justify-center px-0",
          )}
        >
          <button
            type="button"
            onClick={() => setSpacesOpen((open) => !open)}
            className={cn(
              "flex items-center gap-1 rounded-md outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              collapsed && "hidden",
            )}
            aria-expanded={spacesOpen}
            aria-label="切换空间列表"
          >
            <span className="sidebar-label">空间 ({spaces.length})</span>
            {spacesOpen ? (
              <CaretDown className="sidebar-label size-3" />
            ) : (
              <CaretRight className="sidebar-label size-3" />
            )}
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="新建空间"
                onClick={createSpace}
                className={cn(
                  "ml-auto flex size-6 items-center justify-center rounded-md outline-none hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  collapsed && "ml-0",
                )}
              >
                <Plus className="size-3" weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">新建空间</TooltipContent>
          </Tooltip>
        </div>

        {spacesOpen ? (
          <div className="mt-px">
            <AnimatePresence initial={false}>
              {visibleSpaces.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="sidebar-label px-2 py-1.5 text-[10.5px] text-[var(--muted)]"
                >
                  未找到空间
                </motion.p>
              ) : (
                visibleSpaces.map((space) => (
                  <motion.div
                    key={space.id}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: SPACE_ROW_HEIGHT, opacity: 1 }}
                    exit={{ height: 0, opacity: 0, x: 14 }}
                    transition={{ type: "spring", stiffness: 420, damping: 38, opacity: { duration: 0.16 } }}
                    className="overflow-hidden"
                  >
                    <SpaceRow
                      item={space}
                      collapsed={collapsed}
                      renaming={renamingId === space.id}
                      favorited={rowFavorites[space.id] ?? false}
                      menuOpen={menuOpenId === space.id}
                      onOpen={() => onViewChange("projects")}
                      onToggleFavorite={() =>
                        setRowFavorites((prev) => ({ ...prev, [space.id]: !prev[space.id] }))
                      }
                      onStartRename={() => setRenamingId(space.id)}
                      onRenameCommit={commitRename}
                      onRenameCancel={() => setRenamingId(null)}
                      onArchive={() => archiveSpace(space.id)}
                      onNewMission={onNewMission}
                      onMenuOpenChange={(open) => setMenuOpenId(open ? space.id : null)}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </motion.section>

      <motion.section variants={paneItemVariants} className={cn("mt-3", filter === "spaces" && "hidden")} aria-label="最近访问">
        <div
          className={cn(
            "flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]",
            collapsed && "justify-center px-0",
          )}
        >
          <button
            type="button"
            onClick={() => setRecentOpen((open) => !open)}
            aria-controls="recent-items"
            aria-expanded={recentOpen}
            aria-label={recentOpen ? "收起最近访问" : "展开最近访问"}
            className={cn(
              "flex min-w-0 items-center gap-1 rounded-md outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              collapsed && "hidden",
            )}
          >
            <span className="sidebar-label">最近 (1)</span>
            {recentOpen ? (
              <CaretDown className="sidebar-label size-3" />
            ) : (
              <CaretRight className="sidebar-label size-3" />
            )}
          </button>
          <div className={cn("sidebar-label ml-auto flex items-center gap-0.5", collapsed && "ml-0")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="新建任务"
                  onClick={onNewMission}
                  className="flex size-6 items-center justify-center rounded-md outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <Plus className="size-3" weight="bold" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">新建</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div
          id="recent-items"
          className={cn(recentOpen && "mt-1 animate-in fade-in-0 slide-in-from-top-1")}
        >
          {recentOpen ? (
            <button
              type="button"
              onClick={() => onViewChange("projects")}
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[11px] text-[var(--ink-soft)] outline-none transition-[background-color,box-shadow] hover:bg-raise hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Desktop className="size-[16px] shrink-0 text-[var(--muted)]" weight="fill" />
              <span className="sidebar-label truncate">{searchQuery && !"Fouc 桌面端".includes(searchQuery) ? "未找到项目" : "Fouc 桌面端"}</span>
              <span className="sidebar-label ml-auto text-[9px] text-[var(--muted)]">2 小时前</span>
            </button>
          ) : null}
        </div>
      </motion.section>
    </>
  )

  const projectPane = (
    <ProjectSidebarPane
      collapsed={collapsed}
      activePanel={managementPanel}
      onPanelChange={onManagementPanelChange}
      favorited={projectFavorited}
      onFavoriteChange={onProjectFavoriteChange}
      onExit={() => onViewChange("home")}
    />
  )

  return (
    <motion.div
      /* zIndex 用内联：材质底座对直接子元素的非分层 z-index:1 会压过 z-20 工具类，
         内联才能保住拖拽手柄压在主面板圆角之上的层级 */
      style={{ zIndex: 20 }}
      initial={false}
      animate={{ width: collapsed ? 60 : width }}
      transition={dragging ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 40 }}
      className="h-full shrink-0 max-[820px]:!w-[60px]"
    >
      <aside
        className={cn(
          // 右缘分割线由主面板的 border-left 统一提供，此处不再自绘
          "relative flex h-full min-h-0 flex-col px-3 pb-3 transition-[padding] duration-200 max-[1080px]:px-2.5",
          collapsed && "sidebar-collapsed px-2 max-[1080px]:px-2",
        )}
      >
        <div className="flex h-[66px] shrink-0 items-center">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="展开侧边栏"
                  onClick={onToggle}
                  className="relative z-30 mx-auto flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--ink-soft)] outline-none transition-[background-color,color,box-shadow] hover:bg-raise hover:text-[var(--ink)] hover:shadow-[0_2px_8px_rgba(28,32,40,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="scale-x-[-1]"><DenseCollapseIcon /></span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="sidebar-label min-w-0 flex-1 leading-none">
                <div className="truncate text-[15px] font-semibold tracking-[-0.025em] text-[var(--ink-soft)]">Fouc</div>
                <div className="mt-1.5 truncate text-[10px] font-medium text-[var(--muted)]">{SIDEBAR_VERSION}</div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="收起侧边栏"
                    onClick={onToggle}
                    className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <DenseCollapseIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">收起侧边栏</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="搜索"
                    aria-pressed={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <SearchIcon className="size-[17px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">搜索</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="筛选"
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                          filter !== "all"
                            ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                            : "aria-expanded:bg-wash",
                        )}
                      >
                        <Funnel className="size-[17px]" weight="fill" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">筛选</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuLabel>显示范围</DropdownMenuLabel>
                  {([['all', '全部'], ['spaces', '仅空间'], ['recent', '仅最近']] as const).map(([id, label]) => (
                    <DropdownMenuCheckboxItem key={id} checked={filter === id} onCheckedChange={() => setFilter(id)}>{label}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {searchOpen && !collapsed ? (
          <div className="mb-1 animate-in fade-in-0 slide-in-from-top-1">
            <input autoFocus type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索空间与项目" aria-label="搜索空间与项目" className="h-8 w-full rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[11px] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" />
          </div>
        ) : null}

        {/* 新建任务仅属于工作台菜单：进入项目菜单时以高度弹簧收起 */}
        <AnimatePresence initial={false}>
          {paneMode === "workbench" ? (
            <motion.div
              key="mission-button"
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 39, opacity: 1, marginTop: 4 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="overflow-hidden"
            >
              <Button
                type="button"
                variant="outline"
                onClick={onNewMission}
                aria-label="新建任务"
                className={cn(
                  "h-[39px] w-full justify-start rounded-[8px] border-[var(--line)] bg-chip px-3 text-[12px] font-semibold shadow-none hover:bg-chip-strong",
                  collapsed && "justify-center px-0",
                )}
              >
                <PlusCircle className="size-[16px]" weight="bold" />
                <span className="sidebar-label">新建任务</span>
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative mt-2.5 min-h-0 flex-1" style={{ perspective: 1200 }}>
          <AnimatePresence initial={false} custom={paneDirection}>
            <motion.div
              key={paneMode}
              custom={paneDirection}
              variants={paneContainerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex flex-col overflow-y-auto pb-2"
            >
              {paneMode === "project" ? projectPane : workbenchPane}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="打开个人菜单"
                className={cn(
                  "flex h-[42px] w-full items-center gap-2 rounded-[8px] border border-[var(--line)] bg-chip px-2 text-left outline-none transition-colors hover:bg-chip-strong data-[state=open]:bg-chip-strong focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  <Image src="/avatars/lin-mo.png" alt="" width={28} height={28} className="size-7 object-cover" />
                  <span className="absolute right-0 bottom-0 size-1.5 rounded-full border border-[var(--panel)] bg-[#18b988]" />
                </span>
                <span className="sidebar-label min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">林默</span>
                  <span className="block truncate text-[9px] text-[var(--muted)]">本地在线</span>
                </span>
                <CaretDown className="sidebar-label size-3 text-[var(--muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuLabel>林默 · 个人工作台</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onViewChange("settings")}>
                <GearSix weight="fill" /> 设置
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell weight="fill" /> 通知
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!collapsed ? <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} /> : null}
      </aside>
    </motion.div>
  )
}

function SpaceRow({
  item,
  collapsed,
  renaming,
  favorited,
  menuOpen,
  onOpen,
  onToggleFavorite,
  onStartRename,
  onRenameCommit,
  onRenameCancel,
  onArchive,
  onNewMission,
  onMenuOpenChange,
}: {
  item: SpaceItem
  collapsed: boolean
  renaming: boolean
  favorited: boolean
  menuOpen: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  onStartRename: () => void
  onRenameCommit: (id: string, label: string) => void
  onRenameCancel: () => void
  onArchive: () => void
  onNewMission: () => void
  onMenuOpenChange: (open: boolean) => void
}) {
  const Icon = item.icon
  const actionsVisible = menuOpen

  return (
    <div className="group/space relative flex h-9 items-center rounded-lg pr-0.5 transition-[background-color] hover:bg-raise">
        {renaming ? (
          <input
            autoFocus
            defaultValue={item.label}
            aria-label="重命名空间"
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRenameCommit(item.id, event.currentTarget.value)
              if (event.key === "Escape") onRenameCancel()
            }}
            onBlur={(event) => onRenameCommit(item.id, event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-[7px] border border-[var(--accent-soft-line)] bg-panel px-2 text-[11px] font-medium text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <button
            type="button"
            aria-label={item.label}
            onClick={onOpen}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg pl-2 text-left text-[11px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <CaretRight className="sidebar-label size-3 shrink-0 text-[var(--muted)]" aria-hidden />
            <Icon className="size-[16px] shrink-0 text-[var(--muted-strong)]" weight="fill" aria-hidden />
            <span className="sidebar-label truncate">{item.label}</span>
          </button>
        )}

        {!renaming && !collapsed ? (
          <div
            className={cn(
              "ml-auto flex shrink-0 items-center gap-0.5 pl-0.5 transition-[opacity,transform] duration-200 ease-out",
              actionsVisible
                ? "translate-x-0 opacity-100"
                : "translate-x-[3px] opacity-0 group-hover/space:translate-x-0 group-hover/space:opacity-100 group-focus-within/space:translate-x-0 group-focus-within/space:opacity-100",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <RowIconButton
                  aria-label={favorited ? "取消收藏" : "收藏"}
                  onClick={onToggleFavorite}
                  className={cn(favorited && "text-[#d79a3b]")}
                >
                  <Star className="size-[14px]" weight={favorited ? "fill" : "regular"} />
                </RowIconButton>
              </TooltipTrigger>
              <TooltipContent side="top">{favorited ? "取消收藏" : "收藏"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <RowIconButton aria-label="新建任务" onClick={onNewMission}>
                  <Plus className="size-[14px]" weight="bold" />
                </RowIconButton>
              </TooltipTrigger>
              <TooltipContent side="top">新建任务</TooltipContent>
            </Tooltip>
            <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <RowIconButton aria-label={`${item.label} · 更多操作`}>
                      <DotsThree className="size-[15px]" weight="bold" />
                    </RowIconButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">更多操作</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onSelect={onStartRename}>
                  <PencilSimple weight="fill" />重命名
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[var(--err-ink)]" onSelect={onArchive}>
                  <Archive weight="fill" />归档
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
    </div>
  )
}

function RowIconButton({ className, children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-[26px] items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-[background-color,color,transform] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
