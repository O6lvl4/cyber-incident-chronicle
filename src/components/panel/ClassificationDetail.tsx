import type { Incident } from '../../types';
import type { AttackClassification, ClassificationStatus, EntityClassification } from '../../classificationTypes';
import { getEntities, getAttack, INDUSTRY_LABELS, MANUFACTURING_LABELS, LISTING_LABELS, ATTACK_LABELS, ACCESS_LABELS, CONFIDENCE_LABELS } from '../../lib/classification';

function EntitySources({ entity }: { entity: EntityClassification }) {
  if (entity.sources.length === 0) return <p className="classification-help">企業分類の根拠資料は未確認です。</p>;
  return <ul className="classification-sources">{entity.sources.map(source => <li key={source.url}>
    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
    <span>資料確認日 {source.checkedDate || '未確認'}</span>
  </li>)}</ul>;
}

function EntityCard({ entity }: { entity: EntityClassification }) {
  const subtype = entity.manufacturingType === 'unknown' && entity.industry !== 'manufacturing' ? '未確認・不明' : MANUFACTURING_LABELS[entity.manufacturingType];
  return <section className="classification-entity">
    <h4>{entity.name}</h4>
    <dl className="classification-facts">
      <div><dt>業種</dt><dd>{INDUSTRY_LABELS[entity.industry]}</dd></div>
      <div><dt>製造業の細分類</dt><dd>{subtype}</dd></div>
      <div><dt>対象企業の上場区分</dt><dd>{LISTING_LABELS[entity.listingStatus]}</dd></div>
      <div><dt>上場区分の基準日</dt><dd>{entity.listingAsOfDate || '未確認'}</dd></div>
    </dl>
    {entity.listedParent && <p className="classification-parent"><span>上場親会社（参考）</span><a href={entity.listedParent.sourceUrl} target="_blank" rel="noopener noreferrer">{entity.listedParent.name} ↗</a><small>親会社の上場は、対象企業自体の上場を意味しません。</small></p>}
    {entity.note && <p className="classification-help">{entity.note}</p>}
    <EntitySources entity={entity}/>
  </section>;
}

function Confidence({ status }: { status: ClassificationStatus }) {
  return <span className="classification-confidence" data-confidence={status}>{CONFIDENCE_LABELS[status]}</span>;
}

function AttackEvidence({ attack, item }: { attack: AttackClassification; item: Incident }) {
  return <>
    <p className="classification-help">分類の確認日：{attack.reviewedDate || '未確認'}</p>
    {attack.note && <p className="classification-help">{attack.note}</p>}
    {attack.sourceUrls.length > 0 && <ul className="classification-sources">{attack.sourceUrls.map((url, index) => <li key={url}>
      <a href={url} target="_blank" rel="noopener noreferrer">{item.sources.find(source => source.url === url)?.title ?? `攻撃分類の根拠資料 ${index + 1}`} ↗</a>
    </li>)}</ul>}
  </>;
}

export default function ClassificationDetail({ item }: { item: Incident }) {
  const entities = getEntities(item.id);
  const attack = getAttack(item.id);
  return <div className="classification-detail">
    <h3>被害対象企業の分類</h3>
    <p className="classification-help">業種・上場区分は対象企業ごとに記録しています。複数の対象企業がある事案は、いずれか1社がすべての企業条件に一致すると表示されます。</p>
    <p className="classification-help">業種は編集上の大分類です。上場区分は確認基準日の状態で、発生当時とは異なる場合があります。</p>
    {entities.map((entity, index) => <EntityCard key={`${entity.name}-${index}`} entity={entity}/>)}
    <h3>攻撃・事象と初期侵入経路</h3>
    <dl className="classification-facts classification-attack">
      <div><dt>攻撃・事象の種類</dt><dd>{ATTACK_LABELS[attack.attackKind]} <Confidence status={attack.attackKindStatus}/></dd></div>
      <div><dt>初期侵入経路</dt><dd>{ACCESS_LABELS[attack.initialAccess]} <Confidence status={attack.initialAccessStatus}/></dd></div>
    </dl>
    <p className="classification-help">事象の種類と侵入経路は独立して分類しています。「未公表・不明」は攻撃がなかったことを示しません。</p>
    <AttackEvidence attack={attack} item={item}/>
  </div>;
}
