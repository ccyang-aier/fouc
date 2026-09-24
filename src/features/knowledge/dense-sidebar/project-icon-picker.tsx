"use client";

import * as React from "react";
import { Check } from "@phosphor-icons/react";

import { ProjectIcon } from "./project-icon";
import {
  PROJECT_ICON_CATALOG,
  type ProjectIconId,
} from "./project-icons";
import { useI18n } from "./use-i18n";
import { cn } from "@/lib/utils";

const ICON_GRID_COLUMNS = 8;

type ProjectIconPickerProps = {
  value: ProjectIconId;
  onChange: (iconId: ProjectIconId) => void;
};

const ProjectIconPicker = React.memo(function ProjectIconPicker({
  value,
  onChange,
}: ProjectIconPickerProps) {
  const { locale, t } = useI18n();

  const selectAt = React.useCallback(
    (index: number) => {
      const icon = PROJECT_ICON_CATALOG[index];
      if (!icon) return;
      onChange(icon.id);
      document.getElementById(`project-icon-${icon.id}`)?.focus({ preventScroll: true });
    },
    [onChange],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (event.key === "ArrowRight") nextIndex = index + 1;
      if (event.key === "ArrowLeft") nextIndex = index - 1;
      if (event.key === "ArrowDown") nextIndex = index + ICON_GRID_COLUMNS;
      if (event.key === "ArrowUp") nextIndex = index - ICON_GRID_COLUMNS;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = PROJECT_ICON_CATALOG.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      selectAt(Math.max(0, Math.min(PROJECT_ICON_CATALOG.length - 1, nextIndex)));
    },
    [selectAt],
  );

  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <legend className="text-[12px] font-medium text-foreground">
          {t("sidebar.projectIcon")}
        </legend>
        <p id="project-icon-description" className="text-[10.5px] text-muted-foreground">
          {t("sidebar.projectIconDescription")}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-describedby="project-icon-description"
        className="scrollbar-subtle max-h-[244px] overflow-y-auto rounded-[10px] border border-border bg-black/[0.015] p-2 dark:bg-white/[0.025]"
      >
        <div className="grid grid-cols-8 gap-2">
          {PROJECT_ICON_CATALOG.map((icon, index) => {
            const selected = icon.id === value;
            const label = icon.labels[locale];

            return (
              <button
                key={icon.id}
                id={`project-icon-${icon.id}`}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(icon.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "group relative inline-flex size-[50px] items-center justify-center rounded-[10px] outline-none transition-[background-color,box-shadow,transform] hover:bg-hover focus-visible:ring-2 focus-visible:ring-[#2f7cf6]/55 active:scale-[0.96]",
                  selected && "bg-selected ring-2 ring-[#2f7cf6] ring-offset-1 ring-offset-[var(--surface)]",
                )}
              >
                <ProjectIcon iconId={icon.id} className="size-9 rounded-[8px]" />
                {selected ? (
                  <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-[15px] items-center justify-center rounded-full border-2 border-surface bg-[#2f7cf6] text-white">
                    <Check aria-hidden="true" className="size-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
});

export { ProjectIconPicker };
export type { ProjectIconPickerProps };
