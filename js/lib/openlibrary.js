// Book search via Open Library — free, no API key, permissive CORS, covers built
// straight from the cover id. Results are cached in-memory (polite + snappy).
// Google Books enrichment (ratings/descriptions/categories) is best added later
// server-side, so its API key stays hidden — see notes in the advisor function.
const SEARCH = 'https://openlibrary.org/search.json';
const cache = new Map();

export const coverUrl = (coverId, size = 'M') =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;

export async function searchBooks(query) {
  const q = (query || '').trim();
  if (!q) return [];
  if (cache.has(q)) return cache.get(q);

  const url = `${SEARCH}?q=${encodeURIComponent(q)}&limit=14&fields=title,author_name,cover_i,first_publish_year,isbn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open Library ' + res.status);
  const data = await res.json();

  const results = (data.docs || [])
    .filter((d) => d.title)
    .map((d) => ({
      title: d.title,
      author: (d.author_name && d.author_name[0]) || '',
      coverUrl: coverUrl(d.cover_i, 'M'),
      isbn: (d.isbn && d.isbn[0]) || null,
      year: d.first_publish_year || null,
      tags: [],
    }));
  cache.set(q, results);
  return results;
}
