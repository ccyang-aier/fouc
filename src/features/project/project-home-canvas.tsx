"use client"

import { ProjectDashboard } from "./dashboard/project-dashboard"

export function ProjectHomeCanvas({ projectId, projectName, source, onBack }: {
  projectId: string
  projectName: string
  source: "local" | "server"
  onBack: () => void
}) {
  return <ProjectDashboard projectId={projectId} projectName={projectName} source={source} onBack={onBack} />
}
