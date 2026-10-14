'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './toolbar.messages';
import {
  ArrowClockwise,
  CaretDown,
  DownloadSimple,
  Graph,
  MagnifyingGlass,
  Rows,
  SidebarSimple,
  SquaresFour,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './diagram.module.css';
export type DiagramExportFormat = 'svg' | 'png' | 'mermaid' | 'json';
export function DiagramToolbar({
  title,
  provider,
  objects,
  relationships,
  external,
  search,
  onSearch,
  fieldLimit,
  onFieldLimit,
  objectsVisible,
  onObjectsToggle,
  inspectorVisible,
  onInspectorToggle,
  busy,
  loading,
  disabled,
  onRefresh,
  onLayout,
  onExport,
  onClose,
}: {
  title: string;
  provider: string;
  objects: number;
  relationships: number;
  external: number;
  search: string;
  onSearch: (value: string) => void;
  fieldLimit: number;
  onFieldLimit: (value: number) => void;
  objectsVisible: boolean;
  onObjectsToggle: () => void;
  inspectorVisible: boolean;
  onInspectorToggle: () => void;
  busy: 'refresh' | 'export' | null;
  loading: boolean;
  disabled: boolean;
  onRefresh?: () => void;
  onLayout: () => void;
  onExport: (format: DiagramExportFormat) => void;
  onClose?: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <>
      <header className={styles.header}>
        <div className={styles.title}>
          <Graph size={16} />
          <h2>{title}</h2>
          <span className={styles.provider}>{provider}</span>
        </div>
        <div className={styles.headerActions}>
          <span>
            {objects}
            {tConnector('objects')}
            <span className={styles.statDivider}>·</span>
            {relationships}
            {tConnector('foreignKeys')}
            {external > 0 && (
              <>
                <span className={styles.statDivider}>·</span>
                {external}
                {tConnector('externalReferences')}
              </>
            )}
          </span>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tConnector('refreshStructure')}
              title={tConnector('refreshStructure')}
              loading={busy === 'refresh' || loading}
              disabled={disabled}
              onClick={onRefresh}
            >
              <ArrowClockwise size={16} />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tConnector('closeDiagram')}
              title={tConnector('closeDiagram')}
              disabled={Boolean(busy)}
              onClick={onClose}
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </header>
      <div className={styles.toolbar} aria-label={tConnector('diagramToolbar')}>
        <label className={styles.search}>
          <MagnifyingGlass size={15} />
          <input
            aria-label={tConnector('searchDiagramTablesOrColumns')}
            placeholder={tConnector('searchObjectsOrColumns')}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          aria-label={tConnector('toggleDiagramObjectList')}
          aria-pressed={objectsVisible}
          onClick={onObjectsToggle}
        >
          <SquaresFour size={16} />
          <span className={styles.actionLabel}>{tConnector('objects1031')}</span>
        </Button>
        <span className={styles.toolDivider} />
        <label
          className={styles.fieldLimit}
          title={tConnector('maximumVisibleColumnsPerTablePrimaryAndForeignKeysAre')}
        >
          <Rows size={15} />
          <select
            aria-label={tConnector('visibleDiagramColumnCount')}
            value={fieldLimit}
            onChange={(event) => onFieldLimit(Number(event.target.value))}
          >
            <option value={12}>{tConnector('columns')}</option>
            <option value={24}>{tConnector('columns1055')}</option>
          </select>
        </label>
        <Button
          variant="ghost"
          size="sm"
          aria-label={tConnector('automaticLayout')}
          disabled={disabled || !objects}
          onClick={onLayout}
        >
          <TreeStructure size={16} />
          <span className={styles.actionLabel}>{tConnector('automaticLayout')}</span>
        </Button>
        <div className={styles.exportActions}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={tConnector('toggleDiagramDetails')}
            aria-pressed={inspectorVisible}
            onClick={onInspectorToggle}
          >
            <SidebarSimple size={16} />
            <span className={styles.actionLabel}>{tConnector('details')}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={tConnector('exportDiagram')}
                loading={busy === 'export'}
                disabled={disabled || !objects}
              >
                <DownloadSimple size={16} />
                <span className={styles.actionLabel}>{tConnector('export')}</span>
                <CaretDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" density="compact">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onExport('svg')}>
                  {tConnector('svgVectorImage')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExport('png')}>
                  {tConnector('pngImage')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExport('mermaid')}>Mermaid</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExport('json')}>
                  {tConnector('jsonMetadata')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
