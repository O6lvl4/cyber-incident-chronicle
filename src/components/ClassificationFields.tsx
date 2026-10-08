import { useState } from 'react';
import type { AppState } from '../hooks/useAppState';
import { INDUSTRY_LABELS, MANUFACTURING_LABELS, LISTING_LABELS, ATTACK_LABELS, ACCESS_LABELS, CONFIDENCE_LABELS } from '../lib/classification';

interface FilterField { key: keyof AppState['classification']; label: string; shortLabel: string; options: Record<string, string> }
export const CLASSIFICATION_FIELDS: FilterField[] = [
  { key: 'industry', shortLabel: '業種', label: '被害対象企業の業種', options: INDUSTRY_LABELS },
  { key: 'manufacturingType', shortLabel: 'メーカー', label: '製造業の細分類', options: MANUFACTURING_LABELS },
  { key: 'listingStatus', shortLabel: '上場', label: '被害対象企業の上場区分', options: LISTING_LABELS },
  { key: 'attackKind', shortLabel: '種類', label: '攻撃・事象の種類', options: ATTACK_LABELS },
  { key: 'initialAccess', shortLabel: '経路', label: '初期侵入経路', options: ACCESS_LABELS },
  { key: 'confidence', shortLabel: '確度', label: '攻撃・経路の確度', options: CONFIDENCE_LABELS },
];

function FilterSelect({ field, state }: { field: FilterField; state: AppState }) {
  return <label className="classification-field">
    <span>{field.label}</span>
    <select value={state.classification[field.key]} aria-label={field.label} aria-describedby={field.key === 'confidence' ? 'classification-confidence-help' : undefined} onChange={event => {
      const value = event.target.value;
      state.setClassification(previous => ({ ...previous, [field.key]: value }));
    }}>
      <option value="all">すべて</option>
      {Object.entries(field.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}

export default function ClassificationFields({ state }: { state: AppState }) {
  const [advancedOpen, setAdvancedOpen] = useState(() => state.classification.initialAccess !== 'all' || state.classification.confidence !== 'all');
  return <>
    <div className="classification-grid">{CLASSIFICATION_FIELDS.slice(0, 4).map(field => <FilterSelect key={field.key} field={field} state={state}/>)}</div>
    <details className="classification-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
      <summary>詳細条件</summary>
      <div className="classification-grid">{CLASSIFICATION_FIELDS.slice(4).map(field => <FilterSelect key={field.key} field={field} state={state}/>)}</div>
    </details>
    <details className="classification-explanation">
      <summary>分類について</summary>
      <p className="classification-help">食品・電機などの製造細分類を選ぶと該当するメーカーに絞り込みます。上場区分は被害対象企業自身の分類です。事象の種類と初期侵入経路は別に扱います。</p>
      <p className="classification-help" id="classification-confidence-help">確度は選択した事象の種類・初期侵入経路のそれぞれに適用します。両方とも「すべて」の場合は事象の種類の確度で絞り込みます。</p>
    </details>
  </>;
}
