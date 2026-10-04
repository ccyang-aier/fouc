"use client";

import { useState } from "react";
import { Link } from "@phosphor-icons/react";
import type { RelationalProvider } from "@fouc/shared";
import {
  useForeignKeyEdit,
  type ForeignKeyEditContext,
} from "./use-foreign-key-edit";
import { ForeignKeyDesigner } from "./designer";
import { ForeignKeyReview } from "./review";
import { SqlDialog } from "../sql-library-dialog";
import styles from "./foreign-key-edit.module.css";

interface Props extends ForeignKeyEditContext {
  provider: RelationalProvider;
  disabled: boolean;
}

export function ForeignKeyEditAction(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="外键管理"
        disabled={props.disabled || props.provider === "sqlite" || !props.table}
        title={
          props.provider === "sqlite"
            ? "SQLite外键修改需要重建表，当前未实现"
            : "真实外键创建与删除 · 先审查DDL"
        }
        onClick={() => setOpen(true)}
      >
        <Link size={14} />
        <span>外键管理</span>
      </button>
      {open && (
        <ForeignKeyDialog
          key={`${props.base}:${props.schema}:${props.table}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ForeignKeyDialog({
  base,
  provider,
  schema,
  table,
  writable,
  onUnlock,
  onChanged,
  onBusyChange,
  onClose,
}: Props & { onClose: () => void }) {
  const model = useForeignKeyEdit({
    base,
    schema,
    table,
    writable,
    onUnlock,
    onChanged,
    onBusyChange,
  });
  const {
    prepared,
    result,
    locked,
    busy,
    error,
    notice,
    options,
    retryOptions,
    edit,
    remaining,
    confirmed,
    commit,
    valid,
    prepare,
  } = model;
  return (
    <SqlDialog
      title="外键管理"
      className={styles.dialog}
      busy={locked}
      onClose={onClose}
    >
      <div className={styles.context}>
        <Link size={19} />
        <div>
          <strong>
            {schema}.{table}
          </strong>
          <span>
            {provider === "mysql" ? "MySQL · InnoDB" : "PostgreSQL"} ·{" "}
            {prepared ? "原生DDL审查" : "真实字段与引用键"}
          </span>
        </div>
      </div>
      <div className={styles.body}>
        {prepared ? (
          <ForeignKeyReview
            model={model}
            provider={provider}
            writable={writable}
          />
        ) : (
          <ForeignKeyDesigner model={model} />
        )}
        {(error || notice) && (
          <p
            className={error ? styles.error : styles.hint}
            role={error ? "alert" : "status"}
          >
            {error || notice}
            {!options && error && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={retryOptions}
              >
                重读目录
              </button>
            )}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button type="button" disabled={locked} onClick={onClose}>
          {result ? "关闭" : "取消"}
        </button>
        <span />
        {prepared && !result && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void edit()}
          >
            返回编辑
          </button>
        )}
        {!prepared ? (
          <button
            type="button"
            className={styles.primary}
            disabled={!options || !valid || Boolean(busy)}
            onClick={() => void prepare()}
          >
            {busy === "prepare" ? "只读审查中…" : "审查外键DDL"}
          </button>
        ) : (
          !result && (
            <button
              type="button"
              className={styles.danger}
              disabled={!confirmed || !writable || !remaining || Boolean(busy)}
              onClick={() => void commit()}
            >
              {busy === "commit" ? "原生提交中…" : "确认外键变更"}
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
