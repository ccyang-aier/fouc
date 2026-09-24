import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function IconButton({ label, children, className, onClick }: { label: string; children: ReactNode; className?: string; size?: string; tooltipSide?: string; onClick?: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={cn("inline-flex items-center justify-center", className)}>{children}</button>;
}
