/** Pagination only bounds rendered rows; callers retain the complete searchable dataset. */
export const ADVISORY_PAGE_SIZE = 50;
export const SQL_PAGE_SIZE = 100;
export function paginate<T>(items: T[], requestedPage: number, pageSize: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requestedPage) || 0));
  const start = page * size;
  return { page, pages, start, end: Math.min(items.length, start + size), items: items.slice(start, start + size) };
}
