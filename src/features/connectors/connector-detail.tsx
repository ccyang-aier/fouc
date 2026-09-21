import type { Connector } from "./connectors-data"
import { ConnectorDetailHeader } from "./connector-detail-header"
import { DtsConnectorDetail } from "./dts-connector-detail"
import { MysqlConnectionList } from "./mysql/mysql-connection-list"

export function ConnectorDetail({ connector, onBack, onConnectionChange }: { connector: Connector; onBack: () => void; onConnectionChange: (connected: boolean) => void }) {
  if (connector.id === "connector-dts") return <DtsConnectorDetail onBack={onBack} onConnectionChange={onConnectionChange} />
  if (connector.id === "connector-mysql") return <MysqlConnectionList onBack={onBack} />
  return (
    <section aria-label={`${connector.name} 连接器详情`} className="flex h-full min-h-0 flex-col bg-panel">
      <ConnectorDetailHeader name={connector.name} onBack={onBack} />
      <div aria-label="连接器详情内容" className="min-h-0 flex-1" />
    </section>
  )
}
