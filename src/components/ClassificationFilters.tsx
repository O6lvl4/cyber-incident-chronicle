import type { AppState } from '../hooks/useAppState';
import { INDUSTRY_LABELS, MANUFACTURING_LABELS, LISTING_LABELS, ATTACK_LABELS, ACCESS_LABELS, CONFIDENCE_LABELS } from '../lib/classification';

type FilterKey = keyof AppState['classification'];
interface FilterField { key: FilterKey; label: string; options: Record<string, string> }
const FIELDS: FilterField[] = [
  { key: 'industry', label: '被害対象企業の業種', options: INDUSTRY_LABELS },
  { key: 'manufacturingType', label: '製造業の細分類', options: MANUFACTURING_LABELS },
  { key: 'listingStatus', label: '被害対象企業の上場区分', options: LISTING_LABELS },
  { key: 'attackKind', label: '攻撃・事象の種類', options: ATTACK_LABELS },
  { key: 'initialAccess', label: '初期侵入経路', options: ACCESS_LABELS },
  { key: 'confidence', label: '攻撃・経路の確度', options: CONFIDENCE_LABELS },
];

function FilterSelect({ field, state }: { field: FilterField; state: AppState }) {
  return <label className="classification-field">
    <span>{field.label}</span>
    <select value={state.classification[field.key]} aria-describedby={field.key === 'confidence' ? 'classification-confidence-help' : undefined} onChange={event => {
      const value = event.target.value;
      state.setClassification(previous => ({ ...previous, [field.key]: value }));
    }}>
      <option value="all">すべて</option>
      {Object.entries(field.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}

export default function ClassificationFilters({ state }: { state: AppState }) {
  const active = Object.values(state.classification).filter(value => value !== 'all').length;
  return <div className="classification-controls">
    <details className="classification-filters">
      <summary>企業・攻撃の分類 <span className="classification-filter-count">{active ? `${active}条件` : '指定なし'}</span></summary>
      <div className="classification-filter-body">
        <div className="classification-grid">{FIELDS.map(field => <FilterSelect key={field.key} field={field} state={state}/>)}</div>
        <p className="classification-help">食品・電機などの製造細分類を選ぶと該当するメーカーに絞り込みます。上場区分は被害対象企業自身の分類です。事象の種類と初期侵入経路は別に扱います。</p>
        <p className="classification-help" id="classification-confidence-help">確度は選択した事象の種類・初期侵入経路のそれぞれに適用します。両方とも「すべて」の場合は事象の種類の確度で絞り込みます。</p>
      </div>
    </details>
    <button className="classification-reset" onClick={state.resetFilters} aria-label="すべての絞り込みを解除">すべて解除</button>
  </div>;
}
