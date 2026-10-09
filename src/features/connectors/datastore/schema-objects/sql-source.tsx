import { useMemo } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { tokenizeSqlSemantic, type RelationalProvider } from '@fouc/shared';
import styles from './schema-objects.module.css';
const KEYWORDS = new Set('create replace or view materialized trigger function procedure sequence begin end returns language as select from where join on before after instead of insert update delete for each row execute default in out inout declare if then else security definer invoker immutable stable volatile strict parallel safe with no data start increment minvalue maxvalue cache cycle owned by alter owner to and not null return'.split(' '));
function sourceTokens(sql: string, provider: RelationalProvider) {
  if (sql.length > 128 * 1024) return null;
  const tokens = tokenizeSqlSemantic(sql, provider); return tokens.length > 16_000 ? null : tokens;
}
export function SchemaSqlSource({ sql, name, provider, caption }: { sql: string | null; name: string; provider: RelationalProvider; caption: string }) {
  const { notify } = useAppAlert();
  const tokens = useMemo(() => sql === null ? null : sourceTokens(sql, provider), [sql, provider]);
  async function copy() { if (sql === null) return; try { await navigator.clipboard.writeText(sql); notify('success', '完整源码已复制'); } catch { notify('error', '复制失败，请手动选择源码'); } }
  function download() {
    if (sql === null) return; const url = URL.createObjectURL(new Blob([sql], { type: 'text/plain;charset=utf-8' })), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'schema-object'}.sql`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('success', '完整源码已下载');
  }
  return <div className={styles.source}><div className={styles.sourceToolbar}><span>{caption}</span><button disabled={sql === null} onClick={() => void copy()}><Copy size={13} />复制</button><button disabled={sql === null} onClick={download}><DownloadSimple size={13} />下载 .sql</button></div>{sql === null ? <div className={styles.empty}><strong>源码未知</strong><span>当前目录未提供，或当前主体无读取权限。</span></div> : <pre className={styles.sourceCode}>{tokens ? <code>{tokens.map((token, index) => <span key={index}>{sql.slice(index ? tokens[index - 1].span.end : 0, token.span.start)}<span data-token={token.kind === 'word' && KEYWORDS.has(token.normalized) ? 'keyword' : token.kind}>{token.text}</span></span>)}{sql.slice(tokens.at(-1)?.span.end ?? 0)}</code> : <code>{sql}</code>}</pre>}</div>;
}
