'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowClockwise, ArrowsOut, Copy, DownloadSimple, ImageSquare, MagnifyingGlassPlus, ShieldCheck } from '@phosphor-icons/react';
import type { ChannelAttachment } from '@fouc/shared/chats';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { usePageVisible } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import { ChannelPanelModal } from './channel-panel-modal';
import { ChannelRequestError, channelClient } from './channel-client';
import { ChannelTool, formatFileSize } from './channel-ui';
import { ChannelFileIcon } from './channel-file-icon';
import type { ChannelWorkbench } from './use-channel-workbench';
import { previewMessages } from './channel-file-preview.messages';
import styles from './channel-file-preview.module.css';

type PreviewKind = 'markdown' | 'text' | 'image' | 'pdf' | 'unsupported';
type PreviewResource = { url: string; text: string | null; tooLarge: boolean; lines: number };
type PreviewError = 'load' | 'render' | 'forbidden' | 'missing';
type PreviewState = { status: 'loading' } | { status: 'failed'; error: PreviewError; resource?: PreviewResource } | { status: 'ready'; resource: PreviewResource };
const textLimit = 2 * 1024 * 1024;
const markdownPlugins = [remarkGfm];

function previewKind({ mime, name }: ChannelAttachment): PreviewKind {
  if (/^image\/(?:png|jpeg|gif|webp|avif)(?:;|$)/i.test(mime) || /\.(?:png|jpe?g|gif|webp|avif)$/i.test(name)) return 'image';
  if (/^application\/pdf(?:;|$)/i.test(mime) || /\.pdf$/i.test(name)) return 'pdf';
  if (/markdown/i.test(mime) || /\.(?:md|markdown|mdown)$/i.test(name)) return 'markdown';
  if (/^text\/|json|javascript|typescript|xml|yaml/i.test(mime) || /\.(?:txt|log|csv|json|ya?ml|toml|ini|[cm]?js|jsx|tsx?|css|scss|html?|xml|sql|py|go|rs|java|sh|c|cpp|h|cs)$/i.test(name)) return 'text';
  return 'unsupported';
}

/** A preview is a click-owned session; changed identity, project or channel destroys its Blob URLs. */
export function ChannelFilePreview({ attachment, workbench: w, onClose }: {
  attachment: ChannelAttachment; workbench: ChannelWorkbench; onClose: () => void;
}) {
  const visible = usePageVisible();
  const channel = w.channel;
  if (!visible || !channel || !w.project.scopeKey || w.project.principal === 'guest' || channel.projectId !== w.project.selectedProject?.id) return null;
  return <FilePreviewSession key={`${w.project.scopeKey}:${channel.id}:${attachment.messageId}:${attachment.id}`} attachment={attachment} projectId={channel.projectId} channelId={channel.id} onClose={onClose} />;
}

function FilePreviewSession({ attachment, projectId, channelId, onClose }: {
  attachment: ChannelAttachment; projectId: string; channelId: string; onClose: () => void;
}) {
  const { t, locale } = useTranslation(previewMessages);
  const { notify } = useAppAlert();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copying, setCopying] = useState(false);
  const [actualSize, setActualSize] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const alive = useRef(true);
  const kind = previewKind(attachment);
  const { id, messageId, mime, name } = attachment;
  const format = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase() : mime.split('/').at(-1)?.toUpperCase();
  const resource = state.status === 'loading' ? null : state.resource ?? null;

  useEffect(() => {
    alive.current = true;
    let active = true;
    let url: string | null = null;
    void channelClient.attachment(projectId, channelId, { id, messageId }).then(async blob => {
      if (!active) return;
      const textual = kind === 'markdown' || kind === 'text';
      const tooLarge = textual && blob.size > textLimit;
      const text = textual && !tooLarge ? await blob.text() : null;
      if (!active) return;
      url = URL.createObjectURL(blob);
      setState({ status: 'ready', resource: { url, text, tooLarge, lines: text === null ? 0 : text.split(/\r\n|\n|\r/).length } });
    }).catch(cause => {
      if (!active) return;
      const error = cause instanceof ChannelRequestError && [401, 403].includes(cause.status) ? 'forbidden' : cause instanceof ChannelRequestError && cause.status === 404 ? 'missing' : 'load';
      setState({ status: 'failed', error });
    });
    return () => { active = false; alive.current = false; if (url) URL.revokeObjectURL(url); };
  }, [projectId, channelId, id, messageId, kind, attempt]);

  function retry() { setState({ status: 'loading' }); setDimensions(null); setAttempt(value => value + 1); }
  function renderFailed() { setState(current => current.status === 'ready' ? { status: 'failed', error: 'render', resource: current.resource } : current); }
  function download() {
    if (!resource) return;
    const anchor = document.createElement('a');
    anchor.href = resource.url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
  }
  async function copy() {
    if (resource?.text === null || !resource || copying) return;
    setCopying(true);
    try { await navigator.clipboard.writeText(resource.text); if (alive.current) notify('success', t('copied')); }
    catch { if (alive.current) notify('error', t('copyFailed')); }
    finally { if (alive.current) setCopying(false); }
  }
  const compact = kind === 'unsupported' || resource?.tooLarge;
  const failureTitle = state.status === 'failed' ? state.error === 'forbidden' ? 'forbidden' : state.error === 'missing' ? 'missing' : state.error === 'render' ? 'renderFailed' : 'failed' : 'failed';
  const failureHelp = state.status === 'failed' ? state.error === 'forbidden' ? 'forbiddenHelp' : state.error === 'missing' ? 'missingHelp' : state.error === 'render' ? 'renderFailedHelp' : 'failedHelp' : 'failedHelp';

  return <ChannelPanelModal title={name} onClose={onClose} className={`${styles.previewDialog} ${kind === 'markdown' || kind === 'text' ? styles.readingDialog : ''} ${compact ? styles.compact : ''}`}
    headerIcon={<span className={styles.fileMark}><ChannelFileIcon attachment={attachment} size={24} /></span>}
    metadata={<span className={styles.metadata}><span>{format}</span><span aria-hidden>·</span><span>{formatFileSize(attachment.size, locale)}</span>{dimensions && <><span aria-hidden>·</span><span>{dimensions.width} × {dimensions.height}</span></>}</span>}>
    <div className={styles.readingArea} aria-label={t('preview')} data-kind={kind}>
      {state.status === 'loading' ? <div className={styles.loading} role="status" aria-label={t('loading')}><div className={styles.loadingSheet}>{[0, 1, 2, 3, 4, 5].map(line => <span key={line} />)}</div><p>{t('loading')}</p></div>
        : state.status === 'failed' ? <div className={styles.state}><AppAlert tone="error" title={t(failureTitle)} description={t(failureHelp)} action={<Button type="button" variant="outline" size="sm" onClick={retry}><ArrowClockwise size={14} />{t('retry')}</Button>} /></div>
          : state.resource.tooLarge || kind === 'unsupported' ? <div className={styles.state}><span className={styles.unsupportedIcon}><ChannelFileIcon attachment={attachment} size={36} /></span><h3>{t(state.resource.tooLarge ? 'large' : 'unavailable')}</h3><p>{t(state.resource.tooLarge ? 'largeHelp' : 'unavailableHelp')}</p></div>
            : kind === 'image' ? <div className={styles.imageStage} data-actual-size={actualSize}><Image className={styles.image} src={state.resource.url} alt={name} width={1200} height={900} unoptimized onError={renderFailed} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /></div>
              : kind === 'pdf' ? <iframe className={styles.pdf} src={`${state.resource.url}#view=FitH`} title={name} referrerPolicy="no-referrer" onError={renderFailed} />
                : kind === 'markdown' ? <article className={styles.document}><ReactMarkdown remarkPlugins={markdownPlugins} skipHtml components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" />, img: ({ alt }) => <span className={styles.embeddedImage}><ImageSquare size={14} />{alt || t('embeddedImage')}</span> }}>{state.resource.text}</ReactMarkdown></article>
                  : <div className={styles.codeDocument}><div className={styles.codeHeading}><span>{format}</span><span>{t('lines', { count: state.resource.lines })}</span></div><pre><code>{state.resource.text}</code></pre></div>}
    </div>
    <footer className={styles.footer}>
      <span className={styles.readOnly}><ShieldCheck size={13} aria-hidden />{t('readOnly')}</span>
      {kind === 'image' && state.status === 'ready' && <ChannelTool label={t(actualSize ? 'fit' : 'actualSize')} aria-pressed={actualSize} onClick={() => setActualSize(value => !value)}>{actualSize ? <ArrowsOut size={16} /> : <MagnifyingGlassPlus size={16} />}</ChannelTool>}
      {resource?.text !== null && resource?.text !== undefined && <Button type="button" variant="ghost" size="sm" data-surface="plain" loading={copying} onClick={() => void copy()}><Copy size={14} />{t('copy')}</Button>}
      <Button type="button" variant="outline" size="sm" disabled={!resource} onClick={download}><DownloadSimple size={14} />{t('download')}</Button>
    </footer>
  </ChannelPanelModal>;
}
