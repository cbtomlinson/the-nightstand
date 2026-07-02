// Parse a StoryGraph CSV export into the same shelf rows the Goodreads
// importer produces, so store.importShelf handles both identically.
// Get the file at thestorygraph.com → Manage account → Manage your data →
// "Export StoryGraph library".
import { parseCSV } from './goodreads.js';

// StoryGraph "Read Status" → our status.
function toStatus(s) {
  s = (s || '').trim().toLowerCase();
  if (s === 'read') return 'finished';
  if (s === 'currently-reading') return 'reading';
  if (s === 'to-read') return 'to_read';
  if (s === 'did-not-finish' || s === 'dnf') return 'dnf';
  return 'to_read';
}

export function parseStoryGraph(text) {
  const rows = parseCSV(text).filter((r) => r.length > 1);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => (h || '').trim());
  const col = (name) => header.indexOf(name);
  const iTitle = col('Title');
  const iAuthor = col('Authors');
  const iStatus = col('Read Status');
  const iRating = col('Star Rating');
  if (iTitle < 0 || iStatus < 0) return []; // not a StoryGraph export

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const title = (row[iTitle] || '').trim();
    if (!title) continue;
    // StoryGraph ratings are fractional (e.g. 4.25); our scale is whole 1–5.
    const raw = iRating >= 0 ? parseFloat(row[iRating]) : NaN;
    const rating = Number.isFinite(raw) && raw > 0 ? Math.min(5, Math.max(1, Math.round(raw))) : null;
    out.push({
      title,
      author: (iAuthor >= 0 ? row[iAuthor] : '').trim(),
      status: toStatus(row[iStatus]),
      rating,
    });
  }
  return out;
}

// Header sniff: which service exported this CSV?
export function sniffImportFormat(text) {
  const head = (text || '').split('\n', 1)[0] || '';
  if (/read status/i.test(head) && /star rating/i.test(head)) return 'storygraph';
  if (/exclusive shelf/i.test(head)) return 'goodreads';
  return /(^|,)\s*"?title"?\s*(,|$)/i.test(head) ? 'goodreads' : null;
}
