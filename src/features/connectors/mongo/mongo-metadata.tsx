'use client';
import { useTranslation } from '@/lib/i18n';
import { formatJsonSource } from '@fouc/shared';
import type { MongoCollectionInfo, MongoIndexList } from '@fouc/shared/mongo';
import { createUiMessages, uiText } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/mongo-metadata';
import styles from './mongo.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function MongoIndexes({ data }: { data: MongoIndexList }) {
  const { t: tu } = useTranslation(unitMessages);

  return (
    <div className={styles.metadata}>
      <div className={styles.sectionTitle}>
        <h3>{tu('索引')}</h3>
        <span>
          {data.indexes.length} {tu('个')}
          {data.truncated ? tu(' · 已截断') : ''}
        </span>
      </div>
      {!data.indexes.length ? (
        <p className={styles.muted}>{tu('当前集合没有索引。')}</p>
      ) : (
        <table className={styles.indexTable}>
          <thead>
            <tr>
              <th>{tu('名称 / 字段')}</th>
              <th>{tu('属性')}</th>
              <th>{tu('定义')}</th>
            </tr>
          </thead>
          <tbody>
            {data.indexes.map((index) => (
              <tr key={index.name}>
                <td>
                  <strong>{index.name}</strong>
                  <div className={styles.indexKeys}>
                    {index.keys.map((key) => (
                      <code key={key.field}>
                        {key.field}{' '}
                        <span>
                          {key.direction === '1'
                            ? '↑'
                            : key.direction === '-1'
                              ? '↓'
                              : key.direction}
                        </span>
                      </code>
                    ))}
                  </div>
                </td>
                <td>
                  <div className={styles.badges}>
                    {index.primary && <span>{tu('主键')}</span>}
                    {index.unique && <span>{tu('唯一')}</span>}
                    {index.sparse && <span>{tu('稀疏')}</span>}
                    {index.hidden && <span>{tu('隐藏')}</span>}
                    {index.expiresAfterSeconds !== null && (
                      <span>TTL {index.expiresAfterSeconds}s</span>
                    )}
                    {index.partialFilter && <span>{tu('部分索引')}</span>}
                    {index.collation && <span>Collation</span>}
                  </div>
                </td>
                <td>
                  <details>
                    <summary>{tu('完整 EJSON')}</summary>
                    <pre className={styles.json}>{formatJsonSource(index.raw, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export function MongoInformation({ data }: { data: MongoCollectionInfo }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const values: Array<[keyof typeof unitMessages, string | null]> = [
    ['文档数', data.count],
    ['数据大小 / bytes', data.sizeBytes],
    ['存储大小 / bytes', data.storageBytes],
    ['平均文档 / bytes', data.averageDocumentBytes],
    ['索引大小 / bytes', data.indexBytes],
    ['索引数量', data.indexCount],
  ];
  return (
    <div className={styles.metadata}>
      <div className={styles.sectionTitle}>
        <h3>{tu('集合信息')}</h3>
        <span>{tu('实时 collStats')}</span>
      </div>
      <dl className={styles.stats}>
        {values.map(([label, value]) => (
          <div key={label}>
            <dt>{uiText(uiMessage(label), locale)}</dt>
            <dd>{value ?? tu('未知')}</dd>
          </div>
        ))}
      </dl>
      {data.warnings.map((warning) => (
        <p key={warning} role="status" className={styles.notice}>
          {uiText(warning, locale)}
        </p>
      ))}
      {data.raw && (
        <details className={styles.rawStats}>
          <summary>{tu('原始统计 · Extended JSON')}</summary>
          <pre className={styles.json}>{formatJsonSource(data.raw, 2)}</pre>
        </details>
      )}
    </div>
  );
}
