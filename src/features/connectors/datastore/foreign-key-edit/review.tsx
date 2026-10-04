"use client";

import {
  Copy,
  WarningCircle,
  CheckCircle,
  LockOpen,
} from "@phosphor-icons/react";
import type { RelationalProvider } from "@fouc/shared";
import type { ForeignKeyEditModel } from "./use-foreign-key-edit";
import styles from "./foreign-key-edit.module.css";

export function ForeignKeyReview({
  model,
  provider,
  writable,
}: {
  model: ForeignKeyEditModel;
  provider: RelationalProvider;
  writable: boolean;
}) {
  const {
    prepared,
    result,
    remaining,
    copy,
    busy,
    unlock,
    confirmed,
    locked,
    setConfirmed,
  } = model;
  if (!prepared) return null;
  return (
    <>
      <div className={styles.reviewHead}>
        <strong>
          {prepared.review.input.kind === "create" ? "创建" : "删除"}{" "}
          {prepared.review.input.name}
        </strong>
        <small>
          {result
            ? "计划已消费"
            : remaining
              ? `剩余 ${remaining} 秒`
              : "审查已过期"}{" "}
          ·{" "}
          {prepared.review.transaction === "implicit" ? "隐式提交" : "原生事务"}
        </small>
        <button
          type="button"
          aria-label="复制外键DDL"
          onClick={() => void copy()}
        >
          <Copy size={14} />
        </button>
      </div>
      <pre className={styles.sql} aria-label="完整外键DDL">
        {prepared.review.sql}
      </pre>
      <ul className={styles.warnings}>
        {prepared.review.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {result ? (
        <div
          className={`${styles.result} ${result.outcome === "applied" ? styles.success : styles.uncertain}`}
          role={result.outcome === "applied" ? "status" : "alert"}
        >
          {result.outcome === "applied" ? (
            <CheckCircle size={21} />
          ) : (
            <WarningCircle size={21} />
          )}
          <div>
            <strong>
              {result.outcome === "applied"
                ? "外键变更已确认"
                : result.outcome === "unknown"
                  ? "结果未确认"
                  : "外键变更未应用"}
            </strong>
            <p>{result.message}</p>
          </div>
        </div>
      ) : (
        <>
          {!writable && (
            <div className={styles.unlock}>
              <LockOpen size={17} />
              <span>当前会话只读，先审查完整DDL再解锁。</span>
              <button
                type="button"
                disabled={Boolean(busy) || !remaining}
                onClick={() => void unlock()}
              >
                {busy === "unlock" ? "解锁中…" : "解锁外键写入"}
              </button>
            </div>
          )}
          <label className={styles.confirm}>
            <input
              type="checkbox"
              aria-label="确认已审查外键变更"
              checked={confirmed}
              disabled={!writable || locked || !remaining}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              我已审查关系方向与完整DDL，确认
              {prepared.review.input.kind === "create" ? "创建" : "删除"}
              外键 <strong>{prepared.review.input.name}</strong>。
              {provider === "mysql" && (
                <small>理解MySQL DDL不能通过事务撤销。</small>
              )}
            </span>
          </label>
        </>
      )}
    </>
  );
}
