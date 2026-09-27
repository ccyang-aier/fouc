'use client';
import { useState } from 'react';
import { FilePlus } from '@phosphor-icons/react';
export function LocalDocumentImport({ onImport }: {
    onImport: (items: {
        name: string;
        text: string;
    }[]) => boolean;
}) {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    async function importFiles(files: FileList | null) {
        if (!files?.length)
            return;
        setBusy(true);
        setMessage('');
        try {
            const items = await Promise.all(Array.from(files).map(async (file) => {
                if (!/\.(txt|md)$/i.test(file.name))
                    throw new Error('本机模式支持 TXT 和 Markdown 文本文件。');
                if (file.size > 5 * 1024 * 1024)
                    throw new Error('单个文本文件请控制在 5 MB 以内。');
                return { name: file.name, text: await file.text() };
            }));
            setMessage(onImport(items) ? `已导入 ${items.length} 个文档，已保存至本机。` : '保存失败，请检查浏览器存储空间。');
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : '读取失败，请重新选择文件。');
        }
        finally {
            setBusy(false);
        }
    }
    return <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy)
        void importFiles(event.dataTransfer.files); }} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center"><UploadSimpleIcon /><p className="mb-4 text-xs leading-6 text-slate-500">拖入文本文件，或选择 TXT / Markdown 文件。<br />内容仅保存至当前浏览器，每个文件最大 5 MB。</p><label className="inline-block cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-xs text-white">{busy ? '正在导入…' : '选择文件'}<input className="sr-only" aria-label="选择文本文件" type="file" accept=".txt,.md" multiple disabled={busy} onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }}/></label>{message ? <p role="status" className="mt-4 text-xs text-slate-600">{message}</p> : null}</div>;
}
function UploadSimpleIcon() { return <FilePlus size={28} className="mx-auto mb-3 text-blue-500"/>; }
