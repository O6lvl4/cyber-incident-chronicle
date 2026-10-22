import { PRODUCTS, PRODUCT_KEYS, PRODUCT_YEARS } from '../data/product-index';
import { PRODUCT_FOCUS_OPTIONS, normalizeProductFocus } from '../lib/products';
import type { ProductBrowse } from './ProductView';
interface Props { browse: ProductBrowse; query: string; onQueryChange: (query: string) => void }
export default function ProductFilters({ browse, query, onQueryChange }: Props) {
  return <>
    <span className="filter-label">製品を絞る</span>
    <span className="sr-only" id="product-filter-coverage">収録 {PRODUCTS.length}件。製品名で引けるのは収録済みの製品だけで、未収録は脆弱性がないことを意味しません</span>
    <label className="status-filter product-filter"><span className="sr-only">製品</span><select value={browse.productKey} onChange={event => browse.setProductKey(event.target.value)} aria-label="製品" aria-describedby="product-filter-coverage"><option value="all">全製品</option>{PRODUCT_KEYS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label className="status-filter focus-filter"><span className="sr-only">収録理由</span><select value={browse.focus} onChange={event => browse.setFocus(normalizeProductFocus(event.target.value))} aria-label="収録理由">{PRODUCT_FOCUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="status-filter"><span className="sr-only">公表年</span><select value={browse.year} onChange={event => browse.setYear(event.target.value)} aria-label="公表年"><option value="all">全年</option>{PRODUCT_YEARS.map(value => <option key={value}>{value}</option>)}</select></label>
    <label className="search-wrap"><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="製品名・CVE" aria-label="製品・脆弱性を検索"/><span className="search-icon" aria-hidden="true">⌕</span></label>
  </>;
}
