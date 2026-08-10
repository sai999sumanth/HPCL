export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function filenameFromContentDisposition(
  disposition: string | undefined,
  fallback: string
): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
  return match?.[1]?.trim() || fallback;
}
