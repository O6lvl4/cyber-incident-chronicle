# 製品・ランタイムの注意喚起：収録・更新契約

企業のサイバーインシデント、ライブラリの脆弱性とは独立した3つ目のカテゴリー。PHP本体、GitLab、Windows、ネットワーク機器のように、npm / PyPI などのパッケージとして配布されない製品・ランタイムの脆弱性を扱う。件数を他のカテゴリーと合算しない。

## 収録基準

ライブラリの脆弱性が公開データベースの全件収録であるのに対し、このカテゴリーは**基準を満たす記録だけの選定**である。次のいずれかを一次資料で確認できた場合だけ収録し、理由ごとの根拠を各記録の `inclusion` と対応する項目に残す。

| 理由 | 根拠として必要な項目 |
|---|---|
| `alert` 公的機関の注意喚起 | `alerts[]`（JPCERT/CC、IPAなど。発行元・題名・URL・公開日） |
| `critical` 公表元の評価 Critical | `severity.label === 'critical'` と出典URL |
| `exploited` 実悪用の報告 | `exploitation.status === 'reported'` と出典URL |
| `kev` CISA KEV 掲載 | `kev.status === 'listed'`、`addedDate`、照合日時、CISAのURL |

検証スクリプト `scripts/product-status.mjs` は、理由と根拠の双方向の整合（根拠があるのに理由を省く、理由があるのに根拠がない）を失敗にする。深刻度・悪用・KEV の各値は出典URLが `sources` に含まれていなければならない。

**収録しないもの**：第三者の観測記事だけが根拠の悪用報告、開発元の実証（PoC）だけの悪用、製品を特定しない一般的な注意喚起（例：JPCERT-AT-2026-0030）。

**開発元 Critical の範囲**：すべての開発元のCritical公表を網羅的に探索しているわけではない。注意喚起・KEV・確認依頼を通じて確認した製品に限る。この境界は各確認記録に明記する。

## 2つの日付

- `publishedDate`：開発元の公表日。CVEレコードやデータベースの公開日時とは区別し、時刻が資料にある場合だけ `publishedAt` に保持する
- `listedDate`：収録契機日。注意喚起の公開日、CISA KEVへの追加日、開発元のCritical公表日、実悪用報告の公表日のうち、収録基準を最初に満たした日。タイムラインと対象期間の判定に使う。検証スクリプトは、この日が根拠項目の日付のいずれかと一致することを要求する

2015年公表の脆弱性が2026年10月にKEVへ追加された場合、`publishedDate` は2015年、`listedDate` は追加日になる。両方を一覧と詳細に表示し、どちらかで代用しない。

## 保存先

- `src/data/products/<ID>.json`：1記録1ファイル。IDはCVE、または1つの告知が多数のCVEを含む場合は開発元の告知ID（例 `ORACLE-CPUOCT2026-JAVA-SE`、CVEは `aliases`）
- `src/data/product-meta.json`：対象期間（`listedDate` の範囲）、最終確認日、収録方針
- `src/productTypes.ts`、`scripts/product-status.mjs`：構造・出典・日付・根拠の検証
- `docs/data/product-advisory-review-<日付>.json`：候補の列挙、収録・除外の判定、取得失敗の記録

## 確認の深さ

- 開発元の告知、CNAのCVEレコード、公的機関の注意喚起、CISA KEVの全件JSONを個別に取得して照合する。取得できなかった資料（スクリプト描画、HTTP 403、メンテナンス中）は `caveats` に明記し、代わりに使った出典を示す
- 深刻度ラベルは公表元（開発元・CNA・ADP）の表記に従う。Microsoft の Important や Apache の Important など CVSS 以外の語を High に換算しない。数値しかない場合に CVSS 仕様の定性評価尺度を当てはめたときは、その旨を `caveats` に書く
- 開発元とCNAの影響範囲が一致しない場合は、表示に使った側を明記し、もう一方を `caveats` に残す
- 注意喚起の有無は、一覧を確認した日時と結果（`alertChecks`）を記録する。注意喚起がないことは重要性が低いことを意味しない

## 更新手順

1. 候補を集める：JPCERT/CC 注意喚起一覧、IPA 重要なセキュリティ情報、CISA KEV の `dateAdded`、確認依頼のあった製品の開発元告知
2. 各候補について開発元告知とCVEレコードを読み、影響範囲・修正版・CVSS・悪用の記述を転記する。推測で補わない
3. 収録基準に該当するかを判定し、`inclusion` と根拠項目を埋める。該当しない候補も確認記録に残す
4. `listedDate` を根拠項目の日付から決め、`product-meta.json` の期間に収まることを確認する
5. `node scripts/product-status.mjs` と `pnpm check` を実行する

利用者の依存関係・構成・非公開資料は送信しない。製品名で引ける状態にするところまでが範囲で、利用の有無の判定はしない。

## 2026-10-22 の初回収録

2026年10月1日〜22日の `listedDate` を対象に31件を収録した。内訳は CISA KEV 10月追加分 24件、IPA注意喚起だけが契機の Movable Type 2件と Oracle Java SE 1件（54 CVE を1記録に集約）、開発元 Critical が契機の PHP 2件（IPA注意喚起も確認）と GitLab 2件。候補と判定は [確認記録](data/product-advisory-review-2026-10-22.json) を参照。

- JPCERT/CC の10月注意喚起3件のうち、SiteGuard Server Edition と Microsoft 10月更新は収録、国内組織の不正アクセスは製品を特定しないため対象外
- IPA の10月分7件のうち、不正アクセス事案対策は製品を特定しないため対象外。NetScaler（9月28日）は対象期間前
- Oracle Java SE は当初、Critical なし・JPCERT注意喚起なしで除外としていたが、IPAの10月21日注意喚起を確認して `alert` 理由で収録した
- KEV 10月追加分のうち、ProFTPD・BIND・Struts・ONLYOFFICE・Strapi の5件は2015〜2023年公表の古い脆弱性で、`publishedDate` と `listedDate` が離れる。Struts と Strapi はライブラリとしても配布されるが、ライブラリ収録期間（2022年11月以降）より前のため、ライブラリ側には存在しない
- 取得できなかった開発元資料：Citrix CTX697174、Ivanti（スクリプト描画）、BeyondTrust BT26-05（HTTP 403）、EGセキュアソリューションズ（サイトがPHP脆弱性対応でメンテナンス中）。いずれもCNAのCVEレコードとJVN等で補い、`caveats` に明記
