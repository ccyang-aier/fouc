'use client';
import { createUiMessages, uiText, uiFailure, type UiMessage } from '../../../i18n/ui-message';
import { useTranslation, createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './view.messages';
const translateConnector = createTranslator(connectorMessages);
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  CaretLeft,
  CaretRight,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import { rawGridCellText } from '../clipboard';
import {
  BINARY_DOWNLOAD_BYTES,
  BINARY_PREVIEW_BYTES,
  HEX_BYTES_PER_ROW,
  HEX_PAGE_ROWS,
  binaryByteLabel,
  binaryDownloadName,
  binaryHexRows,
  binaryUtf8Preview,
  decodeBinaryPrefix,
  decodeCompleteBinary,
  findBinaryBytes,
  nativeBinaryValue,
  parseBinaryHexSearch,
  type BinaryValue,
} from './model';
import { identifyBinaryImage, type BinaryImage } from './image';
import styles from './binary.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type BinaryView = 'hex' | 'utf8' | 'image' | 'raw';
interface Props {
  value: DatabaseCell;
  columnName: string;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onCopy: (text: string, label: string) => void;
}
interface ViewState {
  source: DatabaseCell;
  view: BinaryView;
  page: number;
  search: string;
  found: number | null;
  message: UiMessage;
}
export function BinaryCellView({ value, columnName, textRef, onCopy }: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const model = useMemo(() => {
    try {
      const binary = nativeBinaryValue(value);
      if (!binary) throw connectorUiMessages.error('thisValueIsNotNativeBinaryData');
      const prefix = decodeBinaryPrefix(binary, undefined);
      return { binary, prefix, image: identifyBinaryImage(prefix), error: null };
    } catch (reason) {
      return {
        binary: null,
        prefix: null,
        image: null,
        error: reason instanceof Error ? uiText(reason, locale) : String(reason),
      };
    }
  }, [value, locale]);
  const [snapshot, setState] = useState<ViewState>(() => ({
    source: value,
    view: 'hex',
    page: 0,
    search: '',
    found: null,
    message: '',
  }));
  let state = snapshot;
  if (state.source !== value) {
    state = { source: value, view: 'hex', page: 0, search: '', found: null, message: '' };
    setState(state);
  }
  const binary = model.binary,
    prefix = model.prefix;
  const truncated = Boolean(binary && prefix && prefix.length < binary.bytes);
  const pages = prefix
    ? Math.max(1, Math.ceil(prefix.length / (HEX_BYTES_PER_ROW * HEX_PAGE_ROWS)))
    : 1;
  const page = Math.min(state.page, pages - 1);
  const rows = useMemo(
    () => (prefix ? binaryHexRows(prefix, page * HEX_PAGE_ROWS, undefined) : []),
    [prefix, page],
  );
  const utf8 = useMemo(
    () => (prefix ? binaryUtf8Preview(prefix, truncated) : null),
    [prefix, truncated],
  );
  const view = model.error ? 'raw' : state.view;
  function change(next: Partial<ViewState>): void {
    setState({ ...state, ...next });
  }
  function search(): void {
    if (!prefix) return;
    try {
      const found = findBinaryBytes(
        prefix,
        parseBinaryHexSearch(state.search),
        state.found === null ? 0 : state.found + 1,
      );
      change({
        found,
        page: found === null ? page : Math.floor(found / (HEX_BYTES_PER_ROW * HEX_PAGE_ROWS)),
        message:
          found === null
            ? connectorUiMessages.message('noMatchingBytesInTheCurrentPreviewRange')
            : connectorUiMessages.message('matchAtOffsetXSearchAgainForTheNextMatch', {
                p0: String(found.toString(16).toUpperCase()),
              }),
      });
    } catch (reason) {
      change({ message: uiFailure(reason) });
    }
  }
  function download(): void {
    if (!binary) return;
    try {
      const bytes = decodeCompleteBinary(binary);
      const url = URL.createObjectURL(
        new Blob([bytes.slice().buffer], { type: 'application/octet-stream' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = binaryDownloadName(columnName, model.image?.extension);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      change({
        message: connectorUiMessages.message('handedOriginalBytesToTheBrowserForSaving', {
          p0: String(binaryByteLabel(binary.bytes, locale)),
        }),
      });
    } catch (reason) {
      change({ message: uiFailure(reason) });
    }
  }
  return (
    <section className={styles.viewer} aria-label={tConnector('rawBinaryByteViewer')}>
      <div className={styles.tabs} role="tablist" aria-label={tConnector('binaryViewMode')}>
        {(
          [
            { id: 'hex', label: 'HEX' },
            { id: 'utf8', label: 'UTF-8' },
            ...(model.image ? [{ id: 'image', label: tConnector('image') }] : []),
            { id: 'raw', label: tConnector('originalValue') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            disabled={Boolean(model.error) && tab.id !== 'raw'}
            onClick={() => change({ view: tab.id as BinaryView, message: '' })}
          >
            {tab.label}
          </button>
        ))}
        <span>{binary ? binaryByteLabel(binary.bytes, locale) : tConnector('invalidBytes')}</span>
      </div>
      {model.error && (
        <p role="alert" className={styles.message}>
          {model.error}
          {tConnector('theOriginalValueIsUnchanged')}
        </p>
      )}
      {truncated && view !== 'raw' && (
        <p className={styles.message}>
          {tConnector('previewSearchOnlyTheFirst')}
          {binaryByteLabel(BINARY_PREVIEW_BYTES, locale)}
          {tConnector('fullSize')}
          {binaryByteLabel(binary!.bytes, locale)}。
        </p>
      )}
      {view === 'hex' && (
        <>
          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <MagnifyingGlass size={13} />
            <input
              aria-label={tConnector('searchBinaryHexadecimalBytes')}
              value={state.search}
              onChange={(event) => change({ search: event.target.value, found: null, message: '' })}
              placeholder={tConnector('searchBytesEGFf')}
              maxLength={384}
            />
            <button type="submit">{tConnector('lookup')}</button>
          </form>
          <div
            className={styles.hex}
            role="tabpanel"
            aria-label={tConnector('hexadecimalAndAsciiView')}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>OFFSET</th>
                  <th>HEX</th>
                  <th>ASCII</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.offset}
                    data-match={
                      state.found !== null &&
                      parseInt(row.offset, 16) <= state.found &&
                      state.found < parseInt(row.offset, 16) + HEX_BYTES_PER_ROW
                    }
                  >
                    <th>{row.offset}</th>
                    <td>{row.hex}</td>
                    <td>{row.ascii}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p>{tConnector('emptyBinaryValueBytes')}</p>}
          </div>
          <div className={styles.paging}>
            <button
              type="button"
              aria-label={tConnector('previousBytePage')}
              disabled={!page}
              onClick={() => change({ page: page - 1 })}
            >
              <CaretLeft size={13} />
            </button>
            <span>
              {page + 1} / {pages}
              {tConnector('pagesUpTo')}
              {HEX_PAGE_ROWS * HEX_BYTES_PER_ROW} B
            </span>
            <button
              type="button"
              aria-label={tConnector('nextBytePage')}
              disabled={page + 1 === pages}
              onClick={() => change({ page: page + 1 })}
            >
              <CaretRight size={13} />
            </button>
            <button
              type="button"
              disabled={!rows.length}
              title={tConnector('copyTheCurrentBytePageOnly')}
              onClick={() =>
                onCopy(
                  rows.map((row) => row.hex).join('\n'),
                  translateConnector('hexForTheCurrentPreviewPage'),
                )
              }
            >
              <Copy size={13} />
            </button>
          </div>
        </>
      )}
      {view === 'utf8' &&
        (utf8 === null ? (
          <p role="status" className={styles.empty}>
            {tConnector('thisRangeIsNotValidUtfUseHexToInspect')}
          </p>
        ) : (
          <textarea
            ref={textRef}
            aria-label={tConnector('binaryUtfPreview')}
            className={styles.text}
            value={utf8}
            readOnly
            spellCheck={false}
          />
        ))}
      {view === 'raw' && (
        <textarea
          ref={textRef}
          aria-label={tConnector('originalCellValue')}
          className={styles.text}
          value={rawGridCellText(value, true)}
          readOnly
          spellCheck={false}
        />
      )}
      {view === 'image' && binary && model.image && (
        <BinaryImagePreview value={binary} image={model.image} />
      )}
      {state.message && (
        <p className={styles.message} role="status">
          {uiText(state.message, locale)}
        </p>
      )}
      {binary && (
        <div className={styles.download}>
          <span>
            {binary.bytes > BINARY_DOWNLOAD_BYTES
              ? tConnector('theOriginalFileExceedsMibUseFullTableExport')
              : tConnector('saveAllOriginalBytes')}
          </span>
          <button type="button" disabled={binary.bytes > BINARY_DOWNLOAD_BYTES} onClick={download}>
            <DownloadSimple size={13} />
            {tConnector('saveFile')}
          </button>
        </div>
      )}
    </section>
  );
}
function BinaryImagePreview({ value, image }: { value: BinaryValue; image: BinaryImage }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [status, setStatus] = useState<{
    source: string;
    failure: string | null;
    loaded: boolean;
  } | null>(null);
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (value.bytes > BINARY_DOWNLOAD_BYTES) return;
    const target = element.current;
    if (!target) return;
    const bytes = decodeCompleteBinary(value);
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: image.mimeType }));
    target.src = url;
    return () => {
      target.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [value, image.mimeType]);
  const current = status?.source === value.base64 ? status : null;
  return (
    <div
      className={styles.image}
      role="tabpanel"
      aria-label={tConnector('nativeBinaryImagePreview')}
    >
      {value.bytes > BINARY_DOWNLOAD_BYTES ? (
        <p>{tConnector('imagePreviewsAreLimitedToMibUseTheOriginalValue')}</p>
      ) : (
        <>
          {!current?.loaded && !current?.failure && (
            <p role="status">{tConnector('decodingTheOriginalImage')}</p>
          )}
          {current?.failure && <p role="alert">{current.failure}</p>}
          {/* Raster bytes are local native data, with bounded headers and no remote URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={element}
            hidden={!current?.loaded || Boolean(current.failure)}
            alt={tConnector('nativeBinaryImage', {
              p0: String(image.width),
              p1: String(image.height),
            })}
            onError={() =>
              setStatus({
                source: value.base64,
                loaded: false,
                failure: translateConnector(
                  'theImageCannotBeDecodedOriginalBytesRemainAvailableTo',
                ),
              })
            }
            onLoad={() => {
              const mismatch =
                element.current &&
                (element.current.naturalWidth !== image.width ||
                  element.current.naturalHeight !== image.height);
              setStatus({
                source: value.base64,
                loaded: !mismatch,
                failure: mismatch
                  ? translateConnector('imageDimensionsDoNotMatchTheOriginalHeaderDisplayWas')
                  : null,
              });
            }}
          />
        </>
      )}
      <small>
        {image.mimeType} · {image.width} × {image.height}
      </small>
    </div>
  );
}
