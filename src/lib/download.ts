/**
 * @fileoverview Save data as a file the user downloads.
 */

/** Offer `data` as a download named `fileName` (the object URL is freed afterwards) */
export function downloadFile(fileName: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing it
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A safe file name from a title: "My take (1).wav" → "my-take-1" */
export function fileStem(title: string): string {
  const stem = title
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'funkeys';
}
