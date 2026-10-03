import type { Connector } from "./connectors-data"
import { ConnectorDetailHeader } from "./connector-detail-header"
import { DtsConnectorDetail } from "./dts-connector-detail"
import { DatastoreConnections } from "./datastore/connection-directory"

export function ConnectorDetail({ connector, onBack, onConnectionChange, onWorkbenchFocus }: { connector: Connector; onBack: () => void; onConnectionChange: (connected: boolean) => void; onWorkbenchFocus?: () => void }) {
  if (connector.id === "connector-dts") return <DtsConnectorDetail onBack={onBack} onConnectionChange={onConnectionChange} />
  if (connector.id === "connector-mysql") return <DatastoreConnections provider="mysql" onBack={onBack} onWorkbenchFocus={onWorkbenchFocus} />
  if (connector.id === "connector-redis") return <DatastoreConnections provider="redis" onBack={onBack} onWorkbenchFocus={onWorkbenchFocus} />
  if (connector.id === "connector-postgres" || connector.id === "connector-sqlite") return <DatastoreConnections provider={connector.id === "connector-postgres" ? "postgres" : "sqlite"} onBack={onBack} onWorkbenchFocus={onWorkbenchFocus} />
  return (
    <section aria-label={`${connector.name} 连接器详情`} className="flex h-full min-h-0 flex-col bg-panel">
      <ConnectorDetailHeader name={connector.name} onBack={onBack} />
      <div aria-label="连接器详情内容" className="min-h-0 flex-1" />
    </section>
  )
}
