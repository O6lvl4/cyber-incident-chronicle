import type { DrawerMode } from '../hooks/useAppState';
import type { DuckDBHandle } from '../hooks/useDuckDB';
import type { UrlState } from '../lib/urlState';
import type { ProductAdvisory } from '../productTypes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATASET } from '../data';
import { PRODUCTS, PRODUCTS_BY_ID, PRODUCT_EVENTS, PRODUCT_KEYS, PRODUCT_META, PRODUCT_YEARS } from '../data/product-index';
import { themeFor } from '../lib/palette';
import { useAppState } from '../hooks/useAppState';
import { useDuckDB } from '../hooks/useDuckDB';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { filterProducts, normalizeProductFocus, type ProductFocus } from '../lib/products';
import { PRODUCT_SORT_OPTIONS, normalizeProductSort, sortProducts, type ProductSort } from '../lib/browseSort';
import type { BoardApi } from '../board/Board';
import Header from './Header';
import Drawer from './Drawer';
import BrowseControls from './BrowseControls';
import ProductFilters from './ProductFilters';
import ProductList from './ProductList';
import ProductTimeline, { PRODUCT_TIMELINE_ID } from './ProductTimeline';
import ProductDetail from './panel/ProductDetail';
import ProductAbout from './panel/ProductAbout';
import SqlConsole from './panel/SqlConsole';
import type { CategoryRouteProps } from './CategoryNav';
const LANE_IDS = ['products'];
const LIST_ID = 'product-list-panel';
const PRODUCT_IDS = new Set(PRODUCTS_BY_ID.keys());
const PRODUCT_SQL = 'SELECT id, vendor, product, title, publishedDate, severity.label AS severity, inclusion FROM products ORDER BY publishedDate DESC';
function ProductPanel({ mode, selected, db, onSelect }: { mode: DrawerMode; selected?: ProductAdvisory; db: DuckDBHandle; onSelect: (id: string) => void }) {
  if (mode === 'about') return <ProductAbout/>;
  if (mode === 'sql') return <SqlConsole db={db} knownIds={PRODUCT_IDS} initialSql={PRODUCT_SQL} onSelect={onSelect}/>;
  return selected ? <ProductDetail item={selected}/> : null;
}
export interface ProductBrowse { productKey: string; setProductKey: (value: string) => void; focus: ProductFocus; setFocus: (value: ProductFocus) => void; year: string; setYear: (value: string) => void }
export default function ProductView(props: CategoryRouteProps) {
  const st = useAppState({ events: PRODUCT_EVENTS, threadIds: LANE_IDS, initialUrl: props.initialUrl });
  const [productKey, setProductKey] = useState(() => PRODUCT_KEYS.some(([key]) => key === props.initialUrl.product) ? props.initialUrl.product! : 'all');
  const [focus, setFocus] = useState<ProductFocus>(() => normalizeProductFocus(props.initialUrl.focus));
  const [year, setYear] = useState(() => PRODUCT_YEARS.includes(props.initialUrl.year ?? '') ? props.initialUrl.year! : 'all');
  const [sort, setSort] = useState<ProductSort>(() => normalizeProductSort(props.initialUrl.productSort));
  const visible = useMemo(() => sortProducts(filterProducts(PRODUCTS, { productKey, focus, year, query: st.query }), sort), [productKey, focus, year, st.query, sort]);
  const shownIds = useMemo(() => new Set(visible.map(item => item.id)), [visible]);
  const events = useMemo(() => PRODUCT_EVENTS.filter(event => shownIds.has(event.id)), [shownIds]);
  const theme = useMemo(() => themeFor(st.dark), [st.dark]);
  const board = useRef<BoardApi>(null);
  const selected = st.selectedId ? PRODUCTS_BY_ID.get(st.selectedId) : undefined;
  const [dbWanted, setDbWanted] = useState(false);
  useEffect(() => { if (st.sqlOpen) setDbWanted(true); }, [st.sqlOpen]);
  const db = useDuckDB(DATASET, dbWanted);
  const select = useCallback((id: string) => { st.select(id); const item = PRODUCTS_BY_ID.get(id); if (item) board.current?.centerOn(Date.parse(item.listedDate)); }, [st.select]);
  useEffect(() => { if (st.selectedId && !shownIds.has(st.selectedId)) st.closeDrawer(); }, [st.selectedId, shownIds, st.closeDrawer]);
  const reset = useCallback(() => { setProductKey('all'); setFocus('all'); setYear('all'); st.setQuery(''); }, [st.setQuery]);
  const urlState: UrlState = useMemo(() => ({ kind: 'product', product: productKey, focus, year, productSort: sort, query: st.query, dark: st.dark,
    sel: st.selectedId ?? undefined, view: st.displayView, level: st.view?.level ?? st.initial?.level, center: st.view ? (st.view.start + st.view.end) / 2 : st.initial?.center }),
  [productKey, focus, year, sort, st.query, st.dark, st.selectedId, st.displayView, st.view, st.initial]);
  useEffect(() => { props.onUrlChange(urlState); }, [urlState, props.onUrlChange]);
  const changeView = (view: 'list' | 'timeline') => props.onNavigate({ ...urlState, view });
  const browse: ProductBrowse = { productKey, setProductKey, focus, setFocus, year, setYear };
  useKeyboardNav({ clearSelection: st.closeDrawer, resetView: () => board.current?.fitAll(), zoom: factor => board.current?.zoomBy(factor < 1 ? 1 : -1),
    step: delta => { if (st.displayView !== 'timeline') return; const sorted = sortProducts(visible, 'listed-asc'); const index = sorted.findIndex(item => item.id === st.selectedId); const next = sorted[Math.max(0, Math.min(sorted.length - 1, index + delta))]; if (next) select(next.id); },
  });
  return <div className={`app product-app${st.dark ? ' dark' : ''}`} data-total={PRODUCTS.length} data-filtered={visible.length}>
    <Header {...props} viewControls={<BrowseControls view={st.displayView} onViewChange={changeView} listId={LIST_ID} timelineId={PRODUCT_TIMELINE_ID} sortValue={sort} sortOptions={PRODUCT_SORT_OPTIONS} onSortChange={value => setSort(normalizeProductSort(value))}/>}
      threads={[]} state={st} onFitAll={() => board.current?.fitAll()} filters={<ProductFilters browse={browse} query={st.query} onQueryChange={st.setQuery}/>}/>
    <div className="summary-strip"><span><i className="live-dot"/>開発元と公的機関の一次資料からたどる、製品・ランタイムの注意喚起</span><span>資料確認 {PRODUCT_META.lastVerifiedDate} · 収録基準を満たす選定記録</span></div>
    <main className={`workspace view-${st.displayView}`}>
      <ProductList hidden={st.displayView !== 'list'} items={visible} total={PRODUCTS.length} selectedId={st.selectedId ?? undefined} onSelect={select} onReset={reset}/>
      <ProductTimeline state={st} events={events} theme={theme} board={board} onReset={reset}/>
      <Drawer mode={st.drawerMode} title={st.drawerMode === 'event' ? 'PRODUCT ADVISORY / 注意喚起の詳細' : undefined} onClose={st.closeDrawer}>
        <ProductPanel mode={st.drawerMode} selected={selected} db={db} onSelect={id => props.onNavigate({ ...urlState, product: 'all', focus: 'all', year: 'all', query: '', sel: id })}/>
      </Drawer>
    </main>
  </div>;
}
