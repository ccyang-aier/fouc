"use client"

/** 社区分页器：摘要与翻页控件同行居中排布，圆形翻页钮 + 窗口式页码，激活页主题实底。 */

import { CaretLeft, CaretRight } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

type PageItem = number | "dots"

function pageWindow(current: number, pageCount: number): PageItem[] {
  if (pageCount <= 1) return []
  const items: PageItem[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(pageCount - 1, current + 1)
  if (left > 2) items.push("dots")
  for (let page = left; page <= right; page += 1) items.push(page)
  if (right < pageCount - 1) items.push("dots")
  items.push(pageCount)
  return items
}

export function CommunityPagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav aria-label="分页" className="flex items-center justify-center gap-4">
      <p className="text-[9.5px] tabular-nums text-[var(--muted)]">
        {from}–{to} <span aria-hidden className="text-[var(--line-strong)]">/</span> {total} 项
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className="flex size-7 items-center justify-center rounded-full text-[var(--muted-strong)] outline-none transition-[background-color,color,opacity] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-35"
          >
            <CaretLeft className="size-3.5" weight="bold" />
          </button>
          {pageWindow(page, pageCount).map((item, index) =>
            item === "dots" ? (
              <span key={`dots-${index}`} aria-hidden className="px-0.5 text-[10px] text-[var(--muted)]">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`第 ${item} 页`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onChange(item)}
                className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10.5px] font-medium tabular-nums outline-none transition-[background-color,color] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  item === page
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--muted-strong)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)]",
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
            className="flex size-7 items-center justify-center rounded-full text-[var(--muted-strong)] outline-none transition-[background-color,color,opacity] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-35"
          >
            <CaretRight className="size-3.5" weight="bold" />
          </button>
        </div>
      ) : null}
    </nav>
  )
}
