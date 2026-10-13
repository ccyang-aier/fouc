"use client"

import type { ProjectManagementPanelId } from "./project-management-model"
import { ProjectWorkbench } from "./project-workbench"

export function ProjectHomeCanvas({ favorited, onFavoriteChange, managementPanel, onManagementPanelChange }: {
  projectId: string
  projectName: string
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  managementPanel: ProjectManagementPanelId | null
  onManagementPanelChange: (panel: ProjectManagementPanelId | null) => void
}) {
  return <ProjectWorkbench favorited={favorited} onFavoriteChange={onFavoriteChange} managementPanel={managementPanel} onManagementPanelChange={onManagementPanelChange} />
}
