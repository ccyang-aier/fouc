'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretRight, Check, CircleNotch, ImageSquare, Plus, Trash, X } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorBackgrounds, type EditorBackground } from '@/lib/editor-appearance';
import styles from './editor-settings.module.css';

export function EditorBackgroundPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { backgrounds, addBackground, removeBackground } = useEditorBackgrounds();
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const active = backgrounds.find(background => background.id === value) ?? backgrounds[0];

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try { onChange(await addBackground(file)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '图片上传失败，请重试'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    try { await removeBackground(id); if (value === id) onChange('white'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '背景删除失败，请重试'); }
    finally { setBusy(false); }
  }

  return <div className={styles.backgroundField}>
    <span className={styles.fieldLabel} id="editor-background-label">页面背景</span>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={styles.backgroundSelect} aria-labelledby="editor-background-label">
        <BackgroundSwatch background={active} />
        <span>{active.label}</span><CaretDown size={16} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent data-editor-appearance-dropdown side="bottom" align="start" className={styles.backgroundDropdown}>
        <ScrollArea className={styles.backgroundList}>
          {backgrounds.map(background => <DropdownMenuItem key={background.id} className={styles.backgroundOption} onSelect={() => onChange(background.id)}>
            <BackgroundSwatch background={background} /><span>{background.label}</span>
            {value === background.id && <Check className={styles.activeCheck} size={15} weight="bold" aria-hidden />}
          </DropdownMenuItem>)}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    <button className={styles.manageButton} type="button" onClick={() => { setError(''); setManaging(true); }}>
      <ImageSquare size={19} aria-hidden /><span>管理背景</span><CaretRight size={16} aria-hidden />
    </button>
    {managing && <BackgroundDialog onClose={() => setManaging(false)}>
      <div className={styles.managerHeader}><h2 id="editor-background-manager-title">页面背景</h2><button type="button" aria-label="关闭背景管理" onClick={() => setManaging(false)}><X size={18} /></button></div>
      <ScrollArea className={styles.galleryScroll}>
        <div className={styles.gallery}>
          {backgrounds.map(background => <div className={styles.backgroundTile} key={background.id}>
            <button type="button" className={styles.backgroundChoice} aria-pressed={value === background.id} onClick={() => onChange(background.id)}>
              <BackgroundSwatch background={background} large />
              <span className={styles.backgroundTileLabel}>{background.label}{value === background.id && <Check size={15} weight="bold" aria-hidden />}</span>
            </button>
            {background.image && <button type="button" className={styles.deleteBackground} aria-label={`删除背景 ${background.label}`} disabled={busy} onClick={() => void remove(background.id)}><Trash size={16} /></button>}
          </div>)}
          <button className={styles.uploadTile} type="button" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <CircleNotch className={styles.spinner} size={24} aria-hidden /> : <Plus size={24} aria-hidden />}<span>{busy ? '处理中…' : '上传图片'}</span>
          </button>
        </div>
      </ScrollArea>
      <input ref={input} className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传页面背景" disabled={busy} onChange={event => void upload(event.target.files?.[0])} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.managerFooter}><button type="button" onClick={() => setManaging(false)}>完成</button></div>
    </BackgroundDialog>}
  </div>;
}

function BackgroundSwatch({ background, large = false }: { background: EditorBackground; large?: boolean }) {
  return <span className={large ? styles.largeSwatch : styles.swatch} style={{ backgroundColor: background.color, backgroundImage: background.image ? `url("${background.image}")` : undefined }} aria-hidden />;
}

function BackgroundDialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog className={styles.backgroundDialog} ref={ref} aria-labelledby="editor-background-manager-title" onCancel={onClose} onClick={event => {
    if (event.target === ref.current) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }
  }}>{children}</dialog>;
}
