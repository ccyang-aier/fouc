"use client";

import { Plus, Trash, CircleNotch } from "@phosphor-icons/react";
import { FOREIGN_KEY_ACTIONS } from "@fouc/shared/foreign-key-edit";
import type { ForeignKeyEditModel } from "./use-foreign-key-edit";
import styles from "./foreign-key-edit.module.css";

export function ForeignKeyDesigner({ model }: { model: ForeignKeyEditModel }) {
  const {
    kind,
    setKind,
    busy,
    options,
    error,
    name,
    setName,
    referenceSchema,
    referenceTable,
    target,
    resetReference,
    referenceKey,
    setReferenceKey,
    setLocals,
    selectedKey,
    locals,
    onDelete,
    setOnDelete,
    onUpdate,
    setOnUpdate,
    dropName,
    setDropName,
    dropped,
    targetError,
  } = model;
  return (
    <>
      <div className={styles.mode}>
        <button
          type="button"
          aria-pressed={kind === "create"}
          disabled={Boolean(busy)}
          onClick={() => setKind("create")}
        >
          <Plus size={14} />
          创建外键
        </button>
        <button
          type="button"
          aria-pressed={kind === "drop"}
          disabled={Boolean(busy)}
          onClick={() => setKind("drop")}
        >
          <Trash size={14} />
          删除外键 <small>{options?.foreignKeys.length ?? 0}</small>
        </button>
      </div>
      {!options && !error && (
        <p role="status" className={styles.hint}>
          <CircleNotch size={14} className="mw-spin" />
          读取本表原生目录…
        </p>
      )}
      {options && kind === "create" && (
        <>
          <label className={styles.field}>
            外键名称
            <input
              aria-label="新外键名称"
              value={name}
              disabled={Boolean(busy)}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
            />
          </label>
          <div className={styles.fields}>
            <label className={styles.field}>
              引用目录
              <select
                aria-label="外键引用目录"
                value={referenceSchema}
                disabled={Boolean(busy)}
                onChange={(event) => resetReference(event.target.value, "")}
              >
                {options.schemas.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              引用数据表
              <select
                aria-label="外键引用表"
                value={referenceTable}
                disabled={Boolean(busy) || !target}
                onChange={(event) =>
                  resetReference(referenceSchema, event.target.value)
                }
              >
                <option value="">选择真实表</option>
                {target?.tables.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            完整引用唯一键
            <select
              aria-label="外键引用唯一键"
              value={referenceKey}
              disabled={Boolean(busy) || !referenceTable || !target}
              onChange={(event) => {
                const key = target?.keys.find(
                  (item) => item.name === event.target.value,
                );
                setReferenceKey(event.target.value);
                setLocals(key?.columns.map(() => "") ?? []);
              }}
            >
              <option value="">选择唯一键 / 主键</option>
              {target?.keys.map((key) => (
                <option key={key.name} value={key.name}>
                  {key.name} · {key.columns.join(", ")}
                </option>
              ))}
            </select>
          </label>
          {referenceTable && target && !target.keys.length && (
            <p className={styles.hint}>
              引用表没有当前支持的完整、有效、非延迟唯一键。部分索引、表达式与前缀索引不能作为本入口的引用目标。
            </p>
          )}
          {selectedKey && (
            <div className={styles.mapping}>
              <header>
                <strong>字段对应</strong>
                <span>复合键按原生目录顺序引用</span>
              </header>
              {selectedKey.columns.map((column, index) => (
                <div className={styles.pair} key={column}>
                  <small>{index + 1}</small>
                  <select
                    aria-label={`本表字段 ${index + 1}`}
                    value={locals[index] ?? ""}
                    disabled={Boolean(busy)}
                    onChange={(event) =>
                      setLocals((current) =>
                        current.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      )
                    }
                  >
                    <option value="">选择本表字段</option>
                    {options.columns.map((item) => (
                      <option value={item.name} key={item.name}>
                        {item.name} · {item.dataType}
                      </option>
                    ))}
                  </select>
                  <span>→</span>
                  <div>
                    <code>{column}</code>
                    <small>
                      {
                        target?.columns.find((item) => item.name === column)
                          ?.dataType
                      }
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.fields}>
            <label className={styles.field}>
              ON DELETE
              <select
                aria-label="外键删除行为"
                value={onDelete}
                disabled={Boolean(busy)}
                onChange={(event) =>
                  setOnDelete(event.target.value as typeof onDelete)
                }
              >
                {FOREIGN_KEY_ACTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              ON UPDATE
              <select
                aria-label="外键更新行为"
                value={onUpdate}
                disabled={Boolean(busy)}
                onChange={(event) =>
                  setOnUpdate(event.target.value as typeof onUpdate)
                }
              >
                {FOREIGN_KEY_ACTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {options && kind === "drop" && (
        <>
          <label className={styles.field}>
            真实外键
            <select
              aria-label="要删除的外键"
              value={dropName}
              disabled={Boolean(busy)}
              onChange={(event) => setDropName(event.target.value)}
            >
              <option value="">选择已存在外键</option>
              {options.foreignKeys
                .filter((key) => key.nameSource === "catalog")
                .map((key) => (
                  <option key={key.name}>{key.name}</option>
                ))}
            </select>
          </label>
          {dropped && (
            <div className={styles.existing}>
              <strong>{dropped.name}</strong>
              <code>
                {dropped.columns.join(", ")} → {dropped.referencedSchema}.
                {dropped.referencedTable} (
                {dropped.referencedColumns.join(", ")})
              </code>
              <small>
                ON DELETE {dropped.onDelete} · ON UPDATE {dropped.onUpdate}
              </small>
            </div>
          )}
          {!options.foreignKeys.length && (
            <p className={styles.hint}>本表没有已存在的外键。</p>
          )}
        </>
      )}
      {targetError && kind === "create" && (
        <p role="alert" className={styles.error}>
          {targetError}
        </p>
      )}
      {options?.warnings.map((warning) => (
        <p className={styles.hint} key={warning}>
          {warning}
        </p>
      ))}
    </>
  );
}
