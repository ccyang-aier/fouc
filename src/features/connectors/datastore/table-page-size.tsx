'use client';
import { uiText, type UiMessage, createUiMessages } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-page-size.messages';
import { useId, useState } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import { RELATIONAL_PAGE_LIMITS } from '@fouc/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tablePageSize, TABLE_PAGE_SIZE_OPTIONS } from './table-pagination-model';
import styles from './table-pagination.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);

export function TablePageSize({
  size,
  defaultSize,
  disabled,
  onChange,
  onDefault,
}: {
  size: number;
  defaultSize: number;
  disabled: boolean;
  onChange: (size: number) => void;
  onDefault: (size: number) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(String(size)),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const value = tablePageSize(draft);
  function apply(persist = false) {
    if (disabled) return;
    if (value === null) {
      setError(
        connectorUiMessages.message('enterAnIntegerFromTo', {
          p0: String(RELATIONAL_PAGE_LIMITS.rows),
        }),
      );
      return;
    }
    if (persist) onDefault(value);
    else onChange(value);
    setOpen(false);
  }
  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (disabled && next) return;
        setOpen(next);
        if (next) {
          setDraft(String(size));
          setError('');
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${styles.sizeTrigger} fouc-action`}
          disabled={disabled}
          aria-label={tConnector('rowsPerPage')}
          title={tConnector('rowsPerPage')}
        >
          {size}
          {tConnector('rowsPage')}
          <CaretDown size={10} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={styles.sizeMenu}
        side="top"
        align="end"
        sideOffset={5}
        collisionPadding={8}
        density="compact"
        aria-label={tConnector('rowsPerPageOptions')}
      >
        {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
          <DropdownMenuItem key={option} disabled={disabled} onSelect={() => onChange(option)}>
            {option}
            {tConnector('rowsPage')}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className={styles.customSize} onKeyDown={(event) => event.stopPropagation()}>
          <label htmlFor={id}>{tConnector('customRowCount')}</label>
          <small>
            {tConnector('current')}
            {size}
            {tConnector('default')}
            {defaultSize}
          </small>
          <div>
            <input
              id={id}
              aria-label={tConnector('customRowsPerPage')}
              inputMode="numeric"
              value={draft}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setDraft(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  apply();
                }
              }}
            />
            <button
              type="button"
              className="fouc-action"
              aria-label={tConnector('applyRowsPerPage')}
              title={tConnector('applyRowsPerPage')}
              disabled={disabled || (value !== null && value === size)}
              onClick={() => apply()}
            >
              <Check size={14} />
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </div>
        <div className={styles.sizeActions}>
          <button
            type="button"
            className="fouc-action"
            disabled={disabled || (value !== null && value === size)}
            onClick={() => apply()}
          >
            {tConnector('thisTimeOnly')}
          </button>
          <button
            type="button"
            className={styles.defaultButton}
            disabled={disabled}
            onClick={() => apply(true)}
          >
            {tConnector('setAsDefault')}
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
