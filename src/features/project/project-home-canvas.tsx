"use client"

import type { ProjectManagementPanelId } from "./project-management-model"

export function ProjectHomeCanvas({ projectName }: {
  projectId: string
  projectName: string
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  managementPanel: ProjectManagementPanelId | null
  onManagementPanelChange: (panel: ProjectManagementPanelId | null) => void
}) {
  return <section aria-label={`${projectName}项目`} className="flex h-full items-center justify-center bg-panel text-[13px] text-[var(--ink-soft)]">项目工作台尚未开放</section>
}
