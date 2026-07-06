/**
 * Local dev PDF pool. Populated by `pnpm --filter web dev:pdfs`, which downloads
 * a fixed set of open-access PDFs into public/dev-pdfs/ (git-ignored). The dev
 * "Create Project from template" tool attaches these to studies instead of
 * fetching from publishers, which block automated downloads.
 */

interface DevPdfEntry {
  fileName: string;
  title: string;
  firstAuthor: string;
  year: number;
}

export interface DevPdf {
  fileName: string;
  data: ArrayBuffer;
}

const MANIFEST_URL = '/dev-pdfs/manifest.json';

/**
 * Load the pool manifest. Returns [] if the pool has not been downloaded, so
 * callers can skip PDF attachment gracefully.
 */
export async function loadDevPdfPool(): Promise<DevPdfEntry[]> {
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return [];
    const data = (await res.json()) as DevPdfEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the bytes for the pool entry at `index` (wraps around the pool). Returns
 * null if the file is missing or unreadable.
 */
export async function takeDevPdf(pool: DevPdfEntry[], index: number): Promise<DevPdf | null> {
  if (pool.length === 0) return null;
  const entry = pool[index % pool.length];
  try {
    const res = await fetch(`/dev-pdfs/${entry.fileName}`);
    if (!res.ok) return null;
    return { fileName: entry.fileName, data: await res.arrayBuffer() };
  } catch {
    return null;
  }
}
