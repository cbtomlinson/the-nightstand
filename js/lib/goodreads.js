// Parse a Goodreads CSV export into shelf rows.
// Goodreads quotes fields that contain commas and can put newlines *inside*
// quoted fields (reviews), so we need a real tokenizer, not a line split.

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped ""
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Goodreads "Exclusive Shelf" → our status. Custom shelves named like "dnf"
// or "did-not-finish" map to dnf; everything unknown defaults to to_read.
function toStatus(shelf) {
  const s = (shelf || '').trim().toLowerCase();
  if (s === 'read') return 'finished';
  if (s === 'currently-reading') return 'reading';
  if (s === 'to-read') return 'to_read';
  if (s === 'dnf' || s === 'did-not-finish' || s === 'abandoned') return 'dnf';
  return 'to_read';
}

// Goodreads wraps ISBNs as ="9780123456789" to stop Excel mangling them.
const cleanIsbn = (s) => (s || '').replace(/[="]/g, '').trim() || null;

export function parseGoodreads(text) {
  const rows = parseCSV(text).filter((r) => r.length > 1);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => (h || '').trim());
  const col = (name) => header.indexOf(name);
  const iTitle = col('Title');
  const iAuthor = col('Author');
  const iRating = col('My Rating');
  const iShelf = col('Exclusive Shelf');
  const iIsbn = col('ISBN13') >= 0 ? col('ISBN13') : col('ISBN');
  if (iTitle < 0) return []; // not a Goodreads export

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const title = (row[iTitle] || '').trim();
    if (!title) continue;
    const rating = iRating >= 0 ? parseInt(row[iRating], 10) : 0;
    out.push({
      title,
      author: (iAuthor >= 0 ? row[iAuthor] : '').trim(),
      status: toStatus(iShelf >= 0 ? row[iShelf] : ''),
      rating: rating > 0 ? rating : null,
      isbn: iIsbn >= 0 ? cleanIsbn(row[iIsbn]) : null,
    });
  }
  return out;
}
