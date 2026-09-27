import { WorkbenchShell } from "@/shell/workbench-shell"
import { WorkspaceProvider } from "@/features/workspaces/workspace-provider"

export default function Home() {
  return <WorkspaceProvider><WorkbenchShell /></WorkspaceProvider>
}
