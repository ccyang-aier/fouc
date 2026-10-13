export function downloadFile(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[<>:"/\\|?*]/g, '-');
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
