import { PRODUCTS, PRODUCT_META } from '../../data/product-index';
import { INCLUSION_LABELS, INCLUSION_ORDER } from '../../lib/products';
export default function ProductAbout() {
  const counts = INCLUSION_ORDER.map(reason => [INCLUSION_LABELS[reason], PRODUCTS.filter(item => item.inclusion.includes(reason)).length] as const);
  return <article className="panel-body incident-detail"><span className="eyebrow">PRODUCT ADVISORIES</span><h2>製品・ランタイムの注意喚起の読み方</h2>
    <p>{PRODUCT_META.coverageNote}</p>
    <section className="coverage-panel" aria-label="収録基準と件数">
      <h3>収録基準と件数</h3>
      <p>対象期間：{PRODUCT_META.windowStart} 〜 {PRODUCT_META.windowEnd}（開発元の公表日）<br/>収録 {PRODUCTS.length}件。次のいずれかを一次資料で確認できた場合だけ収録し、理由ごとの根拠を各記録に残します。</p>
      <dl className="coverage-counts">{counts.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
      <p className="fine-print">1件が複数の理由を持つため合算できません。深刻度の高い順位付けではなく、基準を満たすかどうかの記録です。</p>
    </section>
    <h3>ライブラリの脆弱性とは別のカテゴリー</h3><p>PHP本体やGitLabのように、npm / PyPI などのパッケージとして配布されない製品・ランタイムを扱います。ライブラリの脆弱性は公開データベースの全件収録ですが、このカテゴリーは基準を満たす記録だけの選定です。両者の件数を合算しません。</p>
    <h3>時間軸は収録契機日</h3><p>注意喚起の公開日、CISA KEVへの追加日、開発元のCritical公表日、実悪用報告の公表日のうち、収録基準を最初に満たした日を時間軸にします。開発元の公表日は別に保持し、古い脆弱性がKEVに追加された場合は両者が離れます。時刻が資料にない場合は日付だけを保持し、推定で補いません。</p>
    <h3>注意喚起の確認</h3><p>JPCERT/CC など公的機関の注意喚起は、一覧を確認した日時と結果を記録します。注意喚起がないことは、重要性が低いことや安全であることを意味しません。</p>
    <h3>評価と悪用を混同しない</h3><p>深刻度・CVSSは公表元の評価と出典で、独自に計算しません。実際の悪用とCISA KEV掲載は別々に根拠を記録し、未確認を「悪用なし」とは扱いません。開発元の実証（PoC）は実際の攻撃の観測ではありません。</p>
    <h3>利用の有無は判定しない</h3><p>利用環境の依存関係や設定を送信・診断しません。製品名で引ける状態にするところまでで、使っているかどうかの判断は各組織の構成確認に委ねます。</p>
    <p className="fine-print">未掲載であることは、脆弱性や注意喚起がないことを意味しません。</p>
  </article>;
}
