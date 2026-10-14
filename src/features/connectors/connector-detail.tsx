import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connector-detail.messages';
import { connectorPresentation, type Connector } from './connectors-data';
import { ConnectorDetailHeader } from './connector-detail-header';
import { DtsConnectorDetail } from './dts-connector-detail';
import { DatastoreConnections } from './datastore/connection-directory';
export function ConnectorDetail({
  connector,
  onBack,
  onConnectionChange,
  onWorkbenchFocus,
  onOpenProject,
}: {
  connector: Connector;
  onBack: () => void;
  onConnectionChange: (connected: boolean) => void;
  onWorkbenchFocus?: () => void;
  onOpenProject: (id: string) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const presentation = connectorPresentation(connector, locale);
  if (connector.id === 'connector-dts')
    return <DtsConnectorDetail onBack={onBack} onConnectionChange={onConnectionChange} />;
  if (connector.id === 'connector-mysql')
    return (
      <DatastoreConnections
        provider="mysql"
        onBack={onBack}
        onWorkbenchFocus={onWorkbenchFocus}
        onOpenProject={onOpenProject}
      />
    );
  if (connector.id === 'connector-redis')
    return (
      <DatastoreConnections
        provider="redis"
        onBack={onBack}
        onWorkbenchFocus={onWorkbenchFocus}
        onOpenProject={onOpenProject}
      />
    );
  if (connector.id === 'connector-mongodb')
    return (
      <DatastoreConnections
        provider="mongodb"
        onBack={onBack}
        onWorkbenchFocus={onWorkbenchFocus}
        onOpenProject={onOpenProject}
      />
    );
  if (connector.id === 'connector-postgres' || connector.id === 'connector-sqlite')
    return (
      <DatastoreConnections
        provider={connector.id === 'connector-postgres' ? 'postgres' : 'sqlite'}
        onBack={onBack}
        onWorkbenchFocus={onWorkbenchFocus}
        onOpenProject={onOpenProject}
      />
    );
  return (
    <section
      aria-label={tConnector('connectorDetails', { p0: String(presentation.name) })}
      className="flex h-full min-h-0 flex-col bg-panel"
    >
      <ConnectorDetailHeader name={presentation.name} onBack={onBack} />
      <div aria-label={tConnector('connectorDetails8')} className="min-h-0 flex-1" />
    </section>
  );
}
