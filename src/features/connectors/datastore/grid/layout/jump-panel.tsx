'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './jump-panel.messages';
import { useState } from 'react';
import { Columns, MagnifyingGlass } from '@phosphor-icons/react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { columnLabel } from '../../result-format';
import { WorkbenchSidePanel } from '../../workbench-side-panel';
import styles from './jump-panel.module.css';
export function GridJumpPanel({
  result,
  comments,
  columns,
  selected,
  onJump,
  onClose,
}: {
  result: DatabaseQueryResult;
  comments?: readonly (string | null)[];
  columns: readonly number[];
  selected: number | null;
  onJump: (column: number) => void;
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [search, setSearch] = useState(''),
    [pinned, setPinned] = useState(false);
  const needle = search.trim().toLocaleLowerCase(),
    matches = columns.filter((column) =>
      [result.columns[column], comments?.[column] ?? ''].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      ),
    );
  return (
    <WorkbenchSidePanel
      label={tConnector('jumpToColumn')}
      title={tConnector('jumpToColumn')}
      icon={<Columns size={16} />}
      pinned={pinned}
      onPin={() => setPinned((value) => !value)}
      onClose={onClose}
    >
      <label className={styles.search}>
        <MagnifyingGlass size={16} />
        <input
          autoFocus
          aria-label={tConnector('searchColumnsToJumpTo')}
          placeholder={tConnector('searchColumnsComments')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className={styles.list} aria-label={tConnector('visibleColumns')}>
        {matches.map((column) => (
          <button
            type="button"
            key={column}
            className="fouc-action"
            data-active={selected === column || undefined}
            onClick={() => onJump(column)}
            title={`${result.columns[column]} · ${result.columnTypes[column]}`}
          >
            <span>{columnLabel(result.columns, column)}</span>
            <small>#{columns.indexOf(column) + 1}</small>
          </button>
        ))}
        {!matches.length && <p>{tConnector('noMatchingColumns')}</p>}
      </div>
    </WorkbenchSidePanel>
  );
}
