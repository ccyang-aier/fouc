import { WorkbenchShell } from "@/shell/workbench-shell"
import { WorkspaceProvider } from "@/features/workspaces/workspace-provider"
import { ProjectResourceProvider } from "@/features/project/project-resources"

export default function Home() {
  return <WorkspaceProvider><ProjectResourceProvider><WorkbenchShell /></ProjectResourceProvider></WorkspaceProvider>
}
