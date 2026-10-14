'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './context-menu.messages';
import {
  ArrowDown,
  ArrowUp,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsLeftRight,
  Camera,
  Copy,
  Database,
  DownloadSimple,
  EyeSlash,
  Funnel,
  Highlighter,
  List,
  PencilSimple,
  Table,
  Trash,
  MagicWand,
  X,
  Rows,
  ArrowsOutSimple,
} from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import { createPortal } from 'react-dom';
import { getOverlayRoot } from '@/lib/overlay-root';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TableGridContextActions } from './context-actions';
import type { ResultGridSelectionScope } from './selection-controller';
import type { GridHighlightMode, GridValuePresentation } from './presentation';
import styles from './context-menu.module.css';
export function GridContextMenu({
  point,
  cell,
  scope,
  actions,
  includeHeaders,
  onHeaders,
  onClose,
  onCellDetails,
  onRowDetails,
  onColumnDetails,
  onCopy,
  onTranspose,
  onClear,
  onScreenshot,
  onReturnFocus,
  hasHighlight,
  canHideEqual,
  hasHiddenColumns,
  canViewJson,
  canViewBinary,
  onHighlight,
  onHideEqual,
  onShowColumns,
  onOpenWith,
}: {
  point: {
    x: number;
    y: number;
  } | null;
  cell: {
    columnIndex: number;
    columnName: string;
    value: DatabaseCell;
  } | null;
  scope: ResultGridSelectionScope | null;
  actions?: TableGridContextActions;
  includeHeaders: boolean;
  onHeaders: (value: boolean) => void;
  onClose: () => void;
  onReturnFocus: () => void;
  onCellDetails: () => void;
  onRowDetails: () => void;
  onColumnDetails: () => void;
  onCopy: (format: 'raw' | 'tsv' | 'csv' | 'json') => void;
  onTranspose: () => void;
  onClear: () => void;
  onScreenshot: () => void;
  hasHighlight: boolean;
  canHideEqual: boolean;
  hasHiddenColumns: boolean;
  canViewJson: boolean;
  canViewBinary: boolean;
  onHighlight: (mode: GridHighlightMode | null) => void;
  onHideEqual: () => void;
  onShowColumns: () => void;
  onOpenWith: (mode: GridValuePresentation) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  if (!point || !cell || !scope) return null;
  const blocked = !actions?.writable || !actions.canEdit;
  const submenuOffset = window.innerWidth < 520 ? -196 : 2;
  return (
    <DropdownMenu
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {createPortal(
        <DropdownMenuTrigger
          aria-hidden
          tabIndex={-1}
          className={styles.anchor}
          style={{ left: point.x, top: point.y }}
        />,
        getOverlayRoot() ?? document.body,
      )}
      <DropdownMenuContent
        density="compact"
        aria-label={tConnector('tableSelectionMenu')}
        side="right"
        align="start"
        sideOffset={0}
        collisionPadding={8}
        className={styles.menu}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r' && actions) {
            event.preventDefault();
            if (!actions.queryDisabled) {
              onClose();
              actions.onRefresh();
            }
          }
        }}
      >
        {actions && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={actions.queryDisabled}
                onSelect={() => actions.onDatabaseSort(cell.columnName, 'asc')}
              >
                <Database weight="bold" />
                {tConnector('sortAscendingInDatabase')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={actions.queryDisabled}
                onSelect={() => actions.onDatabaseSort(cell.columnName, 'desc')}
              >
                <Database weight="bold" />
                {tConnector('sortDescendingInDatabase')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={actions.queryDisabled}
                onSelect={() => actions.onPageSort(cell.columnIndex, 'asc')}
              >
                <ArrowUp weight="bold" />
                {tConnector('sortCurrentPageAscending')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={actions.queryDisabled}
                onSelect={() => actions.onPageSort(cell.columnIndex, 'desc')}
              >
                <ArrowDown weight="bold" />
                {tConnector('sortCurrentPageDescending')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          {actions && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={actions.queryDisabled}>
                <Funnel weight="bold" />
                {tConnector('filter')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                density="compact"
                sideOffset={submenuOffset}
                collisionPadding={8}
              >
                <DropdownMenuItem
                  disabled={cell.value === null || typeof cell.value === 'object'}
                  onSelect={() => actions.onFilter(cell.columnName, cell.value, 'equals')}
                >
                  {tConnector('equalsCurrentValue')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={cell.value === null || typeof cell.value === 'object'}
                  onSelect={() => actions.onFilter(cell.columnName, cell.value, 'not-equals')}
                >
                  {tConnector('doesNotEqualCurrentValue')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => actions.onFilter(cell.columnName, cell.value, 'is-null')}
                >
                  {tConnector('isNull')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => actions.onFilter(cell.columnName, cell.value, 'is-not-null')}
                >
                  {tConnector('isNotNull')}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Highlighter weight="bold" />
              {tConnector('highlight')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              density="compact"
              sideOffset={submenuOffset}
              collisionPadding={8}
            >
              <DropdownMenuItem onSelect={() => onHighlight('value')}>
                {tConnector('highlightMatchingValues')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onHighlight('rows')}>
                {tConnector('highlightSelectedRows')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onHighlight('columns')}>
                {tConnector('highlightSelectedColumns')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasHighlight} onSelect={() => onHighlight(null)}>
                {tConnector('clearHighlights')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canHideEqual} onSelect={onHideEqual}>
            <EyeSlash weight="bold" />
            {tConnector('hideColumnsWithIdenticalNumericValues')}
          </DropdownMenuItem>
          {hasHiddenColumns && (
            <DropdownMenuItem onSelect={onShowColumns}>
              {tConnector('showAllColumns')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onCellDetails}>
            <ArrowsOutSimple weight="bold" />
            {tConnector('cellDetails')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onColumnDetails}>
            <Table weight="bold" />
            {tConnector('columnDetails')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRowDetails}>
            <Rows weight="bold" />
            {tConnector('rowDetails')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Copy weight="bold" />
              {tConnector('copy')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              density="compact"
              sideOffset={submenuOffset}
              collisionPadding={8}
            >
              <DropdownMenuItem onSelect={() => onCopy('raw')}>
                {tConnector('originalCurrentCellValue')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopy('tsv')}>
                {tConnector('originalSelectionValuesTsv')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopy('csv')}>
                {tConnector('originalSelectionValuesCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopy('json')}>
                {tConnector('originalSelectionValuesJson')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={includeHeaders}
                onCheckedChange={onHeaders}
                onSelect={(event) => event.preventDefault()}
              >
                {tConnector('includeColumnNames')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {actions && (
            <>
              <DropdownMenuItem
                disabled={blocked || !actions.canNull}
                onSelect={() => actions.onEdit('null', scope)}
                title={!actions.writable ? tConnector('unlockTableWritesToEdit') : undefined}
              >
                <X weight="bold" />
                {tConnector('setToNull')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={blocked} onSelect={() => actions.onEdit('fill', scope)}>
                <PencilSimple weight="bold" />
                {tConnector('bulkEditSelection')}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={blocked}>
                  <MagicWand weight="bold" />
                  {tConnector('generateValues')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  density="compact"
                  sideOffset={submenuOffset}
                  collisionPadding={8}
                >
                  <DropdownMenuItem onSelect={() => actions.onEdit('generate-uuid', scope)}>
                    UUID
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.onEdit('generate-now', scope)}>
                    {tConnector('currentTimeIso')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.onEdit('generate-sequence', scope)}>
                    {tConnector('incrementingSequenceStartAt')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuItem onSelect={onTranspose}>
            <ArrowsLeftRight weight="bold" />
            {tConnector('transposeView')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onClear}>
            <List weight="bold" />
            {tConnector('clearSelection')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onScreenshot}>
            <Camera weight="bold" />
            {tConnector('captureSelectedRegion')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {actions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={!actions.writable || !actions.canClone}
                onSelect={() => actions.onEdit('clone', scope)}
              >
                <Copy weight="bold" />
                {tConnector('clone')}
                {scope.rows.length}
                {tConnector('rowsAsNewRows')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!actions.writable || !actions.canDelete}
                onSelect={() => actions.onEdit('delete', scope)}
              >
                <Trash weight="bold" />
                {tConnector('delete')}
                {scope.rows.length}
                {tConnector('row')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={!scope.rectangular}>
                  <DownloadSimple weight="bold" />
                  {tConnector('export')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  density="compact"
                  sideOffset={submenuOffset}
                  collisionPadding={8}
                >
                  {(['csv', 'tsv', 'json', 'markdown', 'sql'] as const).map((format) => (
                    <DropdownMenuItem key={format} onSelect={() => actions.onExport(format, scope)}>
                      {format === 'markdown' ? 'Markdown' : format.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowSquareOut weight="bold" />
              {tConnector('openAs')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              density="compact"
              sideOffset={submenuOffset}
              collisionPadding={8}
            >
              <DropdownMenuItem onSelect={() => onOpenWith('text')}>
                {tConnector('textView')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canViewJson}
                title={!canViewJson ? tConnector('theCurrentValueIsNotValidJson') : undefined}
                onSelect={() => onOpenWith('json')}
              >
                {tConnector('jsonView')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canViewBinary}
                title={
                  !canViewBinary ? tConnector('theCurrentValueIsNotNativeBinaryData') : undefined
                }
                onSelect={() => onOpenWith('binary')}
              >
                {tConnector('binaryView')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        {actions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={actions.queryDisabled} onSelect={actions.onRefresh}>
                <ArrowsClockwise weight="bold" />
                {tConnector('refresh')}
                <span className={styles.shortcut}>Ctrl R</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
