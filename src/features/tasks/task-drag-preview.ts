const previewInset = 18;

export function createTaskDragPreview(source: HTMLElement, event: { clientX: number; clientY: number; dataTransfer: DataTransfer }, className: string) {
  const bounds = source.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = className;
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.style.left = `${Math.max(0, Math.min(bounds.left - previewInset, window.innerWidth - bounds.width - previewInset * 2))}px`;
  host.style.top = `${Math.max(0, Math.min(bounds.top - previewInset, window.innerHeight - bounds.height - previewInset * 2))}px`;
  host.style.width = `${bounds.width + previewInset * 2}px`;
  const preview = source.cloneNode(true) as HTMLElement;
  preview.removeAttribute('data-task-id');
  preview.removeAttribute('data-dragging');
  preview.removeAttribute('tabindex');
  preview.dataset.dragPreview = 'true';
  preview.style.width = `${bounds.width}px`;
  for (const element of preview.querySelectorAll('[id]')) element.removeAttribute('id');
  host.append(preview);
  document.body.append(host);
  event.dataTransfer.setDragImage(host, event.clientX - bounds.left + previewInset, event.clientY - bounds.top + previewInset);
  // The browser captures this rendered copy before the next paint. Keep its
  // padding so the rotated card and floating shadow fit inside the drag image.
  const frame = window.requestAnimationFrame(() => host.remove());
  return () => { window.cancelAnimationFrame(frame); host.remove(); };
}
