'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './resource-tree-controls.messages';
import {
  Crosshair,
  Eye,
  Grid2X2,
  List,
  SlidersHorizontal,
  ArrowDownAZ,
  ArrowDownZA,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './resource-tree.module.css';
export type ResourceSort = 'catalog' | 'asc' | 'desc';
export type ResourceKind = 'table' | 'view';
export function ResourceTreeControls({
  disabled,
  canLocate,
  sort,
  kinds,
  onLocate,
  onSort,
  onKind,
}: {
  disabled: boolean;
  canLocate: boolean;
  sort: ResourceSort;
  kinds: ReadonlySet<ResourceKind>;
  onLocate: () => void;
  onSort: (sort: ResourceSort) => void;
  onKind: (kind: ResourceKind, visible: boolean) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const filtered = kinds.size !== 2 || sort !== 'catalog';
  return (
    <>
      <button
        type="button"
        className={`${styles.iconButton} fouc-action`}
        aria-label={tConnector('locateCurrentObject')}
        title={tConnector('locateCurrentObject')}
        disabled={disabled || !canLocate}
        onClick={onLocate}
      >
        <Crosshair size={15} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={styles.iconButton}
          disabled={disabled}
          aria-label={tConnector('resourceSortingAndFilters')}
          title={tConnector('resourceSortingAndFilters')}
          data-active={filtered}
        >
          <SlidersHorizontal size={15} />
          {filtered && <i className={styles.filterDot} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label={tConnector('resourceSortingAndFilters')}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{tConnector('objectSortOrder')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSort(value as ResourceSort)}
            >
              <DropdownMenuRadioItem className="gap-2" value="catalog">
                <List />
                {tConnector('catalogOrder')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem className="gap-2" value="asc">
                <ArrowDownAZ />
                {tConnector('nameAZ')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem className="gap-2" value="desc">
                <ArrowDownZA />
                {tConnector('nameZA')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{tConnector('filterByType')}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="gap-2"
              checked={kinds.has('table')}
              onCheckedChange={(visible) => onKind('table', visible)}
              onSelect={(event) => event.preventDefault()}
            >
              <Grid2X2 />
              {tConnector('table')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="gap-2"
              checked={kinds.has('view')}
              onCheckedChange={(visible) => onKind('view', visible)}
              onSelect={(event) => event.preventDefault()}
            >
              <Eye />
              {tConnector('view')}
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
