'use client';
import { useState } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { saveLocalAsset } from '../assets/local-assets';
import { documentFileAccept, documentFileFormat, type DocumentFile } from './file-format';
import { FilePlus } from '@phosphor-icons/react';
export function LocalDocumentImport({ onImport, knowledgeBaseId }: {
    knowledgeBaseId: string;
    onImport: (items: {
        name: string;
        text: string;
        file: DocumentFile;
    }[]) => boolean;
}) {
    const { notify } = useAppAlert();
    const [busy, setBusy] = useState(false);
    async function importFiles(files: FileList | null) {
        if (!files?.length)
            return;
        setBusy(true);
        try {
            const items = await Promise.all(Array.from(files).map(async (file) => {
                if (!documentFileFormat(file.name)) throw new Error('请选择 PDF、PPTX、Word、CSV、JSON、TXT 或 Markdown 等支持的格式。');
                if (file.size > 100 * 1024 * 1024) throw new Error('单个预览文件请控制在 100 MB 以内。');
                const source = await saveLocalAsset(knowledgeBaseId, file);
                return { name: file.name, text: '', file: { source, name: file.name, mime: file.type, size: file.size } };
            }));
            if (onImport(items)) notify('success', `已导入 ${items.length} 个文档，已保存至本机。`);
            else notify('error', '保存失败，请检查浏览器存储空间。');
        }
        catch (error) {
            notify('error', error instanceof Error ? error.message : '读取失败，请重新选择文件。');
        }
        finally {
            setBusy(false);
        }
    }
    return <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy)
        void importFiles(event.dataTransfer.files); }} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center"><UploadSimpleIcon /><p className="mb-4 text-xs leading-6 text-slate-500">拖入文档，或选择 PDF、PPTX、Word、表格与文本文件。<br />内容仅保存至当前浏览器，每个文件最大 100 MB。</p><label className="inline-block cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-xs text-white">{busy ? '正在导入…' : '选择文件'}<input className="sr-only" aria-label="选择文档文件" type="file" accept={documentFileAccept} multiple disabled={busy} onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }}/></label></div>;
}
function UploadSimpleIcon() { return <FilePlus size={28} className="mx-auto mb-3 text-blue-500"/>; }
