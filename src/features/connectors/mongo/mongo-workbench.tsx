'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import type {
  MongoCollectionInfo,
  MongoCollectionList,
  MongoCountResult,
  MongoDatabaseList,
  MongoDocumentPage,
  MongoIndexList,
  MongoSession,
} from '@fouc/shared/mongo';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { Funnel } from '@phosphor-icons/react/dist/csr/Funnel';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Stack } from '@phosphor-icons/react/dist/csr/Stack';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import { useState } from 'react';
import { uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { MongoDocumentTransfer } from './document-transfer';
import { MongoGridFsPanel } from './gridfs';
import { messages as unitMessages } from './i18n/mongo-workbench';
import { MongoConsole } from './mongo-console';
import { MongoDocumentDetails, MongoDocuments } from './mongo-document-view';
import { MongoIndexes, MongoInformation } from './mongo-metadata';
import { MongoMutationAction } from './mongo-mutation-action';
import { useMongoResource, type MongoResource } from './mongo-resource';
import styles from './mongo.module.css';

function ResourceStatus({
  resource,
  label,
  onRetry,
}: {
  resource: MongoResource<unknown>;
  label: string;
  onRetry: () => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  if (resource.loading)
    return (
      <div className={styles.empty} role="status">
        <span className={styles.spinner} />
        <strong>
          {tu('正在读取')}
          {label}
        </strong>
        <span>{tu('请求可取消，切换集合会自动停止当前读取。')}</span>
      </div>
    );
  if (resource.error)
    return (
      <div className={styles.empty}>
        <p className={styles.error} role="alert">
          {uiText(resource.error, locale)}
        </p>
        <button className={styles.smallButton} onClick={onRetry}>
          <ArrowsClockwise size={14} />
          {tu('重试')}
        </button>
      </div>
    );
  return null;
}
function MongoDocumentBrowser({
  base,
  database,
  collection,
  writable,
  onUnlock,
}: {
  base: string;
  database: string;
  collection: string;
  writable: boolean;
  onUnlock: () => Promise<void>;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [filter, setFilter] = useState('{}'),
    [sort, setSort] = useState('{}'),
    [projection, setProjection] = useState('{}');
  const [advanced, setAdvanced] = useState(false),
    [limit, setLimit] = useState(50),
    [selected, setSelected] = useState<number | null>(null);
  const [request, setRequest] = useState({
    filter: '{}',
    sort: '{}',
    projection: '{}',
    offset: 0,
    limit: 50,
    revision: 0,
  });
  const [countRequested, setCountRequested] = useState(false),
    [countRevision, setCountRevision] = useState(0),
    [pastOffsets, setPastOffsets] = useState<number[]>([]);
  const body = JSON.stringify({ database, collection, ...request });
  const page = useMongoResource<MongoDocumentPage>(`${base}/find`, body, request.revision);
  const total = useMongoResource<MongoCountResult>(
    countRequested ? `${base}/count` : null,
    JSON.stringify({ database, collection, filter: request.filter }),
    request.revision + countRevision,
  );
  function apply() {
    setSelected(null);
    setCountRequested(false);
    setPastOffsets([]);
    setRequest((current) => ({
      filter,
      sort,
      projection,
      offset: 0,
      limit,
      revision: current.revision + 1,
    }));
  }
  function move(offset: number) {
    setSelected(null);
    setRequest((current) => ({ ...current, offset, revision: current.revision + 1 }));
  }
  function previous() {
    const offset = pastOffsets.at(-1);
    if (offset === undefined) return;
    setPastOffsets((current) => current.slice(0, -1));
    move(offset);
  }
  function next() {
    const offset = page.data?.nextOffset;
    if (offset === null || offset === undefined) return;
    setPastOffsets((current) => [...current, request.offset]);
    move(offset);
  }
  const selectedDocument = selected !== null ? page.data?.documents[selected] : undefined;
  const fullDocument = !request.projection.trim() || request.projection.trim() === '{}';
  function refreshDocuments() {
    setSelected(null);
    setCountRequested(false);
    setRequest((current) => ({ ...current, revision: current.revision + 1 }));
  }
  const dirty =
    filter !== request.filter ||
    sort !== request.sort ||
    projection !== request.projection ||
    limit !== request.limit;
  function requestCount() {
    setCountRequested(true);
    setCountRevision((current) => current + 1);
  }
  return (
    <div className={styles.browser}>
      <div className={styles.queryBar}>
        <div className={styles.filterLabel}>
          <Funnel size={15} />
          <span>FILTER</span>
        </div>
        <textarea
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label={tu('MongoDB 文档筛选 Extended JSON')}
          spellCheck={false}
          placeholder="{ }"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
        />
        <button
          className={styles.smallButton}
          data-active={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          {tu('排序 / 字段')}
        </button>
        <button
          className={page.loading ? styles.smallButton : styles.primaryButton}
          onClick={() => (page.loading ? page.cancel() : apply())}
        >
          {page.loading ? <Stop size={14} /> : <Play size={13} weight="fill" />}
          {page.loading ? tu('取消') : dirty ? tu('应用') : tu('查询')}
        </button>
      </div>
      {advanced && (
        <div className={styles.advanced}>
          <label>
            <span>
              SORT <small>{tu('自动追加 _id 保持稳定')}</small>
            </span>
            <textarea
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              spellCheck={false}
              placeholder='{"createdAt": -1}'
            />
          </label>
          <label>
            <span>
              PROJECTION <small>{tu('字段 1 包含 / 0 排除')}</small>
            </span>
            <textarea
              value={projection}
              onChange={(event) => setProjection(event.target.value)}
              spellCheck={false}
              placeholder='{"name": 1, "_id": 0}'
            />
          </label>
        </div>
      )}
      <div className={styles.mutationToolbar}>
        <span>{selectedDocument ? tu('已选择一个文档') : tu('选择文档后可审查替换或删除')}</span>
        <MongoDocumentTransfer
          base={base}
          database={database}
          collection={collection}
          filter={request.filter}
          sort={request.sort}
          writable={writable}
          onUnlock={onUnlock}
          onApplied={refreshDocuments}
        />
        <MongoMutationAction
          base={base}
          input={{ database, collection, operation: 'insert-document', documentEjson: '{}' }}
          label={tu('新增文档')}
          writable={writable}
          onApplied={refreshDocuments}
        />
        {selectedDocument && (
          <>
            <MongoMutationAction
              base={base}
              input={{
                database,
                collection,
                operation: 'replace-document',
                originalEjson: selectedDocument,
                documentEjson: selectedDocument,
              }}
              label={tu('替换文档')}
              writable={writable}
              disabled={!fullDocument}
              onApplied={refreshDocuments}
            />
            <MongoMutationAction
              base={base}
              input={{
                database,
                collection,
                operation: 'delete-document',
                originalEjson: selectedDocument,
              }}
              label={tu('删除文档')}
              writable={writable}
              disabled={!fullDocument}
              onApplied={refreshDocuments}
            />
          </>
        )}
        {selectedDocument && !fullDocument && <small>{tu('取消字段投影后才能修改完整文档')}</small>}
      </div>
      <div className={styles.documentArea}>
        <div className={styles.documentMain}>
          <ResourceStatus resource={page} label={tu('文档')} onRetry={() => move(request.offset)} />
          {page.data &&
            (page.data.documents.length ? (
              <MongoDocuments
                documents={page.data.documents}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <div className={styles.empty}>
                <MagnifyingGlass size={25} />
                <strong>{tu('没有匹配的文档')}</strong>
                <span>{tu('调整筛选条件，或检查当前集合。')}</span>
              </div>
            ))}
        </div>
        {page.data && selected !== null && page.data.documents[selected] && (
          <MongoDocumentDetails
            key={`${request.revision}:${selected}`}
            text={page.data.documents[selected]}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      {page.data?.warnings.map((warning) => (
        <p key={warning} className={styles.notice}>
          {uiText(warning, locale)}
        </p>
      ))}
      <footer className={styles.pageFooter}>
        <div>
          <span className={styles.statusDot} />
          {page.data
            ? `${request.offset + (page.data.documents.length ? 1 : 0)}–${request.offset + page.data.documents.length}`
            : '—'}
          <span className={styles.footerDivider} />
          {total.data ? (
            tu('{v0} 个匹配文档', { v0: String(total.data.count) })
          ) : (
            <button disabled={total.loading || !page.data} onClick={requestCount}>
              {countRequested && total.loading
                ? tu('正在精确计数…')
                : countRequested && total.error
                  ? tu('计数失败')
                  : tu('精确计数')}
            </button>
          )}
          {total.error && (
            <span title={uiText(total.error, locale)} className={styles.error}>
              {uiText(total.error, locale)}
            </span>
          )}
          <span className={styles.footerDivider} />
          {page.data ? `${page.data.elapsedMs.toFixed(1)} ms` : tu('等待结果')}
        </div>
        <div>
          <label>
            {tu('每页')}{' '}
            <select
              aria-label={tu('MongoDB 每页文档数')}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              {[25, 50, 100, 250, 500].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.iconButton}
            aria-label={tu('上一页文档')}
            disabled={page.loading || request.offset === 0}
            onClick={previous}
          >
            <CaretLeft size={15} />
          </button>
          <button
            className={styles.iconButton}
            aria-label={tu('下一页文档')}
            disabled={page.loading || !page.data?.nextOffset}
            onClick={next}
          >
            <CaretRight size={15} />
          </button>
        </div>
      </footer>
    </div>
  );
}
function MongoCollectionPanel({
  base,
  database,
  collection,
  writable,
  onUnlock,
}: {
  base: string;
  database: string;
  collection: string;
  writable: boolean;
  onUnlock: () => Promise<void>;
}) {
  const { t: tu } = useTranslation(unitMessages);

  const [tab, setTab] = useState<'documents' | 'indexes' | 'information'>('documents'),
    [revision, setRevision] = useState(0);
  const body = JSON.stringify({ database, collection });
  const indexes = useMongoResource<MongoIndexList>(
    tab === 'indexes' ? `${base}/indexes` : null,
    body,
    revision,
  );
  const information = useMongoResource<MongoCollectionInfo>(
    tab === 'information' ? `${base}/information` : null,
    body,
    revision,
  );
  return (
    <>
      <div className={styles.collectionHeader}>
        <div>
          <Stack size={18} />
          <strong>{collection}</strong>
          <span>{database}</span>
        </div>
        <div className={styles.segment}>
          {(['documents', 'indexes', 'information'] as const).map((mode) => (
            <button key={mode} data-active={tab === mode} onClick={() => setTab(mode)}>
              {mode === 'documents' ? tu('文档') : mode === 'indexes' ? tu('索引') : tu('集合信息')}
            </button>
          ))}
        </div>
      </div>
      {tab === 'documents' ? (
        <MongoDocumentBrowser
          base={base}
          database={database}
          collection={collection}
          writable={writable}
          onUnlock={onUnlock}
        />
      ) : (
        <div className={styles.panelContent}>
          {tab === 'indexes' && (
            <div className={styles.mutationToolbar}>
              <MongoMutationAction
                base={base}
                input={{
                  database,
                  collection,
                  operation: 'create-index',
                  keysEjson: '{"field":1}',
                }}
                label={tu('创建索引')}
                writable={writable}
                onApplied={() => setRevision((value) => value + 1)}
              />
              {indexes.data?.indexes
                .filter((index) => !index.primary)
                .map((index) => (
                  <MongoMutationAction
                    key={index.name}
                    base={base}
                    input={{ database, collection, operation: 'drop-index', indexName: index.name }}
                    label={tu('删除索引 ') + index.name}
                    writable={writable}
                    onApplied={() => setRevision((value) => value + 1)}
                  />
                ))}
            </div>
          )}
          <ResourceStatus
            resource={tab === 'indexes' ? indexes : information}
            label={tab === 'indexes' ? tu('索引') : tu('集合信息')}
            onRetry={() => setRevision((value) => value + 1)}
          />
          {tab === 'indexes' && indexes.data && <MongoIndexes data={indexes.data} />}
          {tab === 'information' && information.data && (
            <MongoInformation data={information.data} />
          )}
        </div>
      )}
    </>
  );
}
function MongoWorkspace({
  session,
  name,
  onBack,
  onSessionChange,
}: {
  session: MongoSession;
  name: string;
  onBack: () => void;
  onSessionChange?: (session: MongoSession) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const base = `/api/database/mongo/sessions/${session.id}`;
  const [database, setDatabase] = useState(session.database),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0),
    [mode, setMode] = useState<'collections' | 'console' | 'gridfs'>('collections');
  const databases = useMongoResource<MongoDatabaseList>(`${base}/databases`, undefined, revision);
  const collections = useMongoResource<MongoCollectionList>(
    `${base}/collections`,
    JSON.stringify({ database }),
    revision,
  );
  const current =
    selected ??
    collections.data?.collections.find((item) => !item.name.startsWith('system.'))?.name ??
    null;
  const [writeBusy, setWriteBusy] = useState(false),
    [writeError, setWriteError] = useState<UiMessage>('');
  async function toggleWriteAccess() {
    setWriteBusy(true);
    setWriteError('');
    try {
      const next = await backendFetch<MongoSession>(`${base}/write-access`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: session.readOnly }),
      });
      onSessionChange?.(next);
    } catch (reason) {
      setWriteError(uiFailure(reason));
    } finally {
      setWriteBusy(false);
    }
  }
  async function unlockForImport() {
    if (!session.readOnly) return;
    const next = await backendFetch<MongoSession>(`${base}/write-access`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    onSessionChange?.(next);
  }
  const names = [
    ...new Set([session.database, ...(databases.data?.databases.map((item) => item.name) ?? [])]),
  ];
  const visible =
    collections.data?.collections.filter((item) =>
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ) ?? [];
  return (
    <section className={styles.workbench} aria-label={tu('MongoDB 数据工作台')}>
      <header className={styles.header}>
        <button className={styles.iconButton} aria-label={tu('返回连接器')} onClick={onBack}>
          <ArrowLeft size={17} />
        </button>
        <span className={styles.brand}>
          <Database size={20} weight="duotone" />
        </span>
        <div className={styles.connectionName}>
          <strong>{name}</strong>
          <span>
            MongoDB {session.version ?? ''} · {session.host}
          </span>
        </div>
        <button
          type="button"
          className={styles.readOnly}
          disabled={writeBusy || !onSessionChange}
          aria-label={session.readOnly ? tu('解锁 MongoDB 写入') : tu('锁定 MongoDB 写入')}
          onClick={() => void toggleWriteAccess()}
        >
          <Lock size={12} />
          {writeBusy ? tu('切换中…') : session.readOnly ? tu('只读') : tu('可写')}
        </button>
        <div className={styles.headerTabs}>
          <button data-active={mode === 'collections'} onClick={() => setMode('collections')}>
            {tu('数据浏览')}
          </button>
          <button data-active={mode === 'console'} onClick={() => setMode('console')}>
            {tu('命令')}
          </button>
          <button data-active={mode === 'gridfs'} onClick={() => setMode('gridfs')}>
            {tu('GridFS 文件')}
          </button>
        </div>
        <button
          className={styles.iconButton}
          aria-label={tu('刷新数据库与集合目录')}
          onClick={() => setRevision((value) => value + 1)}
        >
          <ArrowsClockwise size={17} />
        </button>
      </header>
      {writeError && (
        <p className={styles.error} role="alert">
          {uiText(writeError, locale)}
        </p>
      )}
      <div className={styles.mobileResources}>
        <select
          aria-label={tu('窄屏 MongoDB 数据库')}
          value={database}
          onChange={(event) => {
            setDatabase(event.target.value);
            setSelected(null);
            setSearch('');
          }}
        >
          {names.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label={tu('窄屏 MongoDB 集合')}
          value={current ?? ''}
          onChange={(event) => {
            setSelected(event.target.value);
            setMode('collections');
          }}
        >
          <option value="" disabled>
            {tu('选择集合')}
          </option>
          {collections.data?.collections.map((item) => (
            <option key={item.name} value={item.name} disabled={item.name.startsWith('system.')}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.namespaceActions}>
        <MongoMutationAction
          base={base}
          input={{ database, collection: '', operation: 'create-collection' }}
          label={tu('新建集合')}
          writable={!session.readOnly}
          onApplied={() => setRevision((value) => value + 1)}
        />
        {current && (
          <MongoMutationAction
            base={base}
            input={{ database, collection: current, operation: 'drop-collection' }}
            label={tu('删除集合')}
            writable={!session.readOnly}
            onApplied={() => {
              setSelected(null);
              setRevision((value) => value + 1);
            }}
          />
        )}
      </div>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <label className={styles.databaseLabel}>DATABASE</label>
          <div className={styles.databaseSelect}>
            <Database size={15} />
            <select
              aria-label={tu('MongoDB 数据库')}
              value={database}
              onChange={(event) => {
                setDatabase(event.target.value);
                setSelected(null);
                setSearch('');
              }}
            >
              {names.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {databases.error && (
            <p className={styles.sidebarWarning} title={uiText(databases.error, locale)}>
              {tu('数据库目录不可用；仍可浏览当前数据库。')}
            </p>
          )}
          {databases.data?.truncated && (
            <p className={styles.sidebarWarning}>{tu('数据库目录已截断')}</p>
          )}
          <div className={styles.sidebarTitle}>
            <span>COLLECTIONS</span>
            <span>{collections.data?.collections.length ?? '—'}</span>
          </div>
          <label className={styles.collectionSearch}>
            <MagnifyingGlass size={14} />
            <input
              aria-label={tu('搜索 MongoDB 集合')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tu('搜索集合…')}
            />
          </label>
          <div className={styles.collectionList}>
            {collections.loading && <p className={styles.sidebarMessage}>{tu('读取集合…')}</p>}
            {collections.error && (
              <div className={styles.sidebarMessage}>
                <p role="alert" className={styles.error}>
                  {uiText(collections.error, locale)}
                </p>
                <button
                  className={styles.smallButton}
                  onClick={() => setRevision((value) => value + 1)}
                >
                  {tu('重试')}
                </button>
              </div>
            )}
            {visible.map((item) => (
              <button
                key={item.name}
                disabled={item.name.startsWith('system.')}
                title={item.name.startsWith('system.') ? tu('系统集合暂未开放') : item.name}
                data-active={current === item.name && mode === 'collections'}
                onClick={() => {
                  setSelected(item.name);
                  setMode('collections');
                }}
              >
                <Stack size={15} />
                <span>{item.name}</span>
                {item.kind !== 'collection' && (
                  <small>
                    {item.kind === 'view' ? 'VIEW' : item.kind === 'timeseries' ? 'TIME' : '?'}
                  </small>
                )}
              </button>
            ))}
            {collections.data && !visible.length && (
              <p className={styles.sidebarMessage}>
                {search ? tu('没有匹配集合') : tu('当前数据库没有集合')}
              </p>
            )}
            {collections.data?.truncated && (
              <p className={styles.sidebarWarning}>{tu('集合目录已达到 2000 项显示上限。')}</p>
            )}
          </div>
          <div className={styles.sidebarFooter}>
            <span className={styles.statusDot} />
            {tu('已连接')}
            <span>{tu('Native driver')}</span>
          </div>
        </aside>
        <main className={styles.main}>
          {mode === 'gridfs' ? (
            <MongoGridFsPanel base={base} database={database} revision={revision} />
          ) : mode === 'console' ? (
            <MongoConsole key={`${base}:${database}`} base={base} database={database} />
          ) : current ? (
            <MongoCollectionPanel
              key={`${base}:${database}:${current}`}
              base={base}
              database={database}
              collection={current}
              writable={
                !session.readOnly &&
                collections.data?.collections.find((item) => item.name === current)?.kind ===
                  'collection'
              }
              onUnlock={unlockForImport}
            />
          ) : (
            <div className={styles.empty}>
              <Database size={30} weight="duotone" />
              <strong>{tu('选择一个集合')}</strong>
              <span>{tu('原生文档、索引与统计会在这里显示。')}</span>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
export function MongoWorkbench(props: {
  session: MongoSession;
  name: string;
  onBack: () => void;
  onSessionChange?: (session: MongoSession) => void;
}) {
  return <MongoWorkspace key={props.session.id} {...props} />;
}
