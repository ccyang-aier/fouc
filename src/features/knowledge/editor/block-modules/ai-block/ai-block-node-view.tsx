'use client';

import { useState } from 'react';
import { CheckCircle, CircleNotch, Pause, Play, Sparkle, Trash } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { useAiStreamingTask } from '../../../ai/use-ai-streaming-task';
import styles from './ai-block.module.css';

export function AiBlockNodeView({ scope, ...props }: NodeViewProps & { scope?: PageScope }) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const [error, setError] = useState('');
  const prompt = String(node.attrs.prompt || '');
  const blockId = String(node.attrs.blockId || '');
  const taskId = node.attrs.taskId ? String(node.attrs.taskId) : null;
  return <NodeViewWrapper as="section" {...HTMLAttributes} data-fouc-node="ai-block" data-block-id={node.attrs.blockId} className={styles.root}>
    <div className={styles.header} contentEditable={false}><span className={styles.title}><span className={styles.sparkle}><Sparkle aria-hidden size={16} weight="fill" /></span> AI 工作块</span><span className={styles.subtle}>生成内容以建议形式出现</span></div>
    <div className={styles.controls} contentEditable={false}>
      <label className={styles.promptLabel} htmlFor={`ai-prompt-${blockId}`}>任务说明</label>
      <textarea id={`ai-prompt-${blockId}`} aria-label="AI 任务说明" placeholder="描述希望 AI 完成的工作…" rows={2} value={prompt} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ prompt: event.target.value })} />
      <div className={styles.options}>
        <label>模型档位<select aria-label="AI 模型档位" value={node.attrs.tier} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ tier: event.target.value })}><option value="fast">快速</option><option value="smart">深度</option></select></label>
        {scope && editor.isEditable ? <AiTaskActions scope={scope} taskId={taskId} blockId={blockId} prompt={prompt} tier={node.attrs.tier} onTaskId={(id) => updateAttributes({ taskId: id })} onError={setError} /> : <span className={styles.localNotice}>AI 任务需连接团队知识库</span>}
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
    <div className={styles.output}><span className={styles.outputLabel} contentEditable={false}>结果 · 可继续编辑</span><NodeViewContent className={styles.content} /></div>
  </NodeViewWrapper>;
}

function AiTaskActions({ scope, taskId, blockId, prompt, tier, onTaskId, onError }: {
  scope: PageScope; taskId: string | null; blockId: string; prompt: string; tier: 'fast' | 'smart';
  onTaskId: (taskId: string | null) => void; onError: (message: string) => void;
}) {
  const task = useAiStreamingTask(scope.workspaceId, taskId);
  const [busy, setBusy] = useState(false);
  const status = task.snapshot?.status;
  const run = async () => {
    if (!prompt.trim() || !blockId) return;
    setBusy(true); onError('');
    try {
      const snapshot = await task.start({ pageId: scope.pageId, insideBlockId: blockId, afterBlockId: null, prompt: prompt.trim(), tier });
      onTaskId(snapshot.taskId);
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'AI 任务启动失败'); }
    finally { setBusy(false); }
  };
  const cancel = async () => { setBusy(true); onError(''); try { await task.cancel(); } catch (cause) { onError(cause instanceof Error ? cause.message : '取消失败'); } finally { setBusy(false); } };
  const revoke = async () => { setBusy(true); onError(''); try { await task.revoke(); onTaskId(null); task.reset(); } catch (cause) { onError(cause instanceof Error ? cause.message : '撤销失败'); } finally { setBusy(false); } };

  return <div className={styles.taskActions}>
    {status === 'running' ? <><span className={styles.status}><CircleNotch aria-hidden className={styles.spin} size={14} />正在生成 · {task.snapshot?.blocksWritten ?? 0} 块</span><button type="button" className={styles.secondary} disabled={busy} onClick={() => void cancel()}><Pause aria-hidden size={14} />停止</button></> : <>
      {status === 'done' ? <span className={styles.status}><CheckCircle aria-hidden size={15} />已生成 {task.snapshot?.blocksWritten ?? 0} 块</span> : status === 'failed' ? <span className={styles.failed}>生成失败，可重试</span> : status === 'cancelled' ? <span className={styles.status}>已停止</span> : null}
      <button type="button" className={styles.primary} disabled={busy || !prompt.trim() || !blockId} onClick={() => void run()}><Play aria-hidden size={13} weight="fill" />{status ? '重新生成' : '开始生成'}</button>
      {status ? <button type="button" className={styles.secondary} disabled={busy} title="撤销此任务写入的建议块" onClick={() => void revoke()}><Trash aria-hidden size={14} />撤销生成</button> : null}
    </>}
  </div>;
}
