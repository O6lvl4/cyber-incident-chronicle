interface Props { page: number; pages: number; total: number; start: number; end: number; label: string; onChange: (page: number) => void }
export default function Pagination({ page, pages, total, start, end, label, onChange }: Props) {
  return <nav className="result-pagination" aria-label={`${label}のページ切替`}>
    <span className="page-range" role="status" aria-live="polite">{total ? start + 1 : 0}–{end} / {total}件</span>
    <div className="page-controls">
      <button className="n-btn" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label={`${label}の前のページ`}>前へ</button>
      <label><span className="sr-only">{label}のページ</span><select value={page} onChange={event => onChange(Number(event.target.value))} aria-label={`${label}のページ`}>
        {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} / {pages}</option>)}
      </select></label>
      <button className="n-btn" disabled={page === pages - 1} onClick={() => onChange(page + 1)} aria-label={`${label}の次のページ`}>次へ</button>
    </div>
  </nav>;
}
