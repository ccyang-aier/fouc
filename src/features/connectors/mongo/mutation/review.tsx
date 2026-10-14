'use client';
import { useTranslation } from '@/lib/i18n';
import { formatJsonSource } from '@fouc/shared';
import type { MongoMutationReview } from '@fouc/shared/mongo-mutation';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { uiText } from '../../i18n/ui-message';
import { mongoMutationTitle } from '../i18n/mutation-titles';
import { messages as unitMessages } from './../i18n/mutation-review';
import styles from './mutation.module.css';

export function MongoMutationReviewView({ review }: { review: MongoMutationReview }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  return (
    <section className={styles.review}>
      <div className={styles.reviewTarget}>
        <span>{tu('已读取并核对当前目标')}</span>
        <code>
          {review.database} / {review.collection}
        </code>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{tu('操作')}</dt>
          <dd>{mongoMutationTitle(review.operation, locale)}</dd>
        </div>
        <div>
          <dt>{tu('影响数量')}</dt>
          <dd>{review.affectedCount ?? tu('未知')}</dd>
        </div>
        {review.indexName && (
          <div>
            <dt>{tu('索引')}</dt>
            <dd>{review.indexName}</dd>
          </div>
        )}
        {review.documentId && (
          <div>
            <dt>{tu('精确 BSON 身份')}</dt>
            <dd>
              <code>{review.documentId}</code>
            </dd>
          </div>
        )}
      </dl>
      <div className={styles.diff}>
        {review.before && (
          <div>
            <h4>{tu('当前内容')}</h4>
            <pre>{formatJsonSource(review.before, 2)}</pre>
          </div>
        )}
        {review.after && (
          <div>
            <h4>{review.before ? tu('提交后内容') : tu('将创建的内容')}</h4>
            <pre>{formatJsonSource(review.after, 2)}</pre>
          </div>
        )}
      </div>
      {!!review.warnings.length && (
        <div className={styles.warnings}>
          <WarningCircle size={16} />
          <div>
            {review.warnings.map((warning) => (
              <p key={warning}>{uiText(warning, locale)}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
