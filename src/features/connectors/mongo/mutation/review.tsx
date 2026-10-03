import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { formatJsonSource } from '@fouc/shared';
import type { MongoMutationReview } from '@fouc/shared/mongo-mutation';
import styles from './mutation.module.css';

export function MongoMutationReviewView({ review }: { review: MongoMutationReview }) {
  return <section className={styles.review}>
    <div className={styles.reviewTarget}><span>已读取并核对当前目标</span><code>{review.database} / {review.collection}</code></div>
    <dl className={styles.facts}><div><dt>操作</dt><dd>{review.title}</dd></div><div><dt>影响数量</dt><dd>{review.affectedCount ?? '未知'}</dd></div>{review.indexName && <div><dt>索引</dt><dd>{review.indexName}</dd></div>}{review.documentId && <div><dt>精确 BSON 身份</dt><dd><code>{review.documentId}</code></dd></div>}</dl>
    <div className={styles.diff}>
      {review.before && <div><h4>当前内容</h4><pre>{formatJsonSource(review.before, 2)}</pre></div>}
      {review.after && <div><h4>{review.before ? '提交后内容' : '将创建的内容'}</h4><pre>{formatJsonSource(review.after, 2)}</pre></div>}
    </div>
    {!!review.warnings.length && <div className={styles.warnings}><WarningCircle size={16} /><div>{review.warnings.map(warning => <p key={warning}>{warning}</p>)}</div></div>}
  </section>;
}
