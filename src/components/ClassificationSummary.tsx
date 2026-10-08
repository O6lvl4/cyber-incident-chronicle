import type { Incident } from '../types';
import { summarizeAttacks } from '../lib/classification';
export default function ClassificationSummary({ incidents }: { incidents: Incident[] }) {
  const counts = summarizeAttacks(incidents);
  return <section className="classification-summary" aria-label="表示中の事案の攻撃種別集計" aria-live="polite" aria-atomic="true">
    <p><strong>表示中 {counts.total}件</strong><span>ランサムウェア：確認済み <b>{counts.confirmedRansomware}</b>件 / 可能性 <b>{counts.possibleRansomware}</b>件</span><span>攻撃種別不明 <b>{counts.unknown}</b>件</span></p>
    <details className="classification-summary-about"><summary>集計について</summary>
      <p className="classification-summary-note">収録・選択した事例の内訳です。国内全体の発生件数や割合ではありません。「不明」は攻撃なしを意味しません。</p>
    </details>
  </section>;
}
