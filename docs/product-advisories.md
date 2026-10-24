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
| `poc` 攻撃コードの公開 | `poc.status === 'public'` と、公表者本人または開発元が公開した一次資料（`sources` で `type: 'poc'`）のURL |

検証スクリプト `scripts/product-status.mjs` は、理由と根拠の双方向の整合（根拠があるのに理由を省く、理由があるのに根拠がない）を失敗にする。深刻度・悪用・KEV の各値は出典URLが `sources` に含まれていなければならない。

**収録しないもの**：第三者の観測記事だけが根拠の悪用報告、第三者の記事やハッシュだけで本体が非公開の攻撃コード、製品を特定しない一般的な注意喚起（例：JPCERT-AT-2026-0030）。開発元や公表者が「実証した」と述べるだけでコードを公開していない場合は `poc` に当たらず、`caveats` に記す。

**開発元 Critical の範囲**：すべての開発元のCritical公表を網羅的に探索しているわけではない。注意喚起・KEV・確認依頼を通じて確認した製品に限る。この境界は各確認記録に明記する。

## 2つの日付

- `publishedDate`：開発元の公表日。CVEレコードやデータベースの公開日時とは区別し、時刻が資料にある場合だけ `publishedAt` に保持する
- `listedDate`：収録契機日。注意喚起の公開日、CISA KEVへの追加日、開発元のCritical公表日、実悪用報告の公表日、攻撃コードの公開日のうち、収録基準を最初に満たした日。タイムラインと対象期間の判定に使う。検証スクリプトは、この日が根拠項目の日付のいずれかと一致することを要求する

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

## 候補の自動検出

`pnpm product:candidates --since YYYY-MM-DD` は、CISA KEV の全件JSON、JPCERT/CC の注意喚起一覧、IPA の重要なセキュリティ情報一覧を取得し、収録済み記録と確認記録の除外判定に照らして、次を報告する（既定は直近14日）。

- **未収録の候補**：KEV の新規追加で記録にないもの、記録にも除外判定にもない注意喚起
- **差分**：記録があるのに KEV 掲載や注意喚起が反映されていないもの（`kev-not-recorded`、`alert-not-recorded`）

報告は `.cache/product-candidates/<日付>.json` に書き、`--summary` で Markdown も出力する。`--draft` を付けると KEV 由来の候補について CNA レコードから下書きを `.cache/product-drafts/` に生成するが、下書きには `TODO` が残るため、検証スクリプトは `src/data/products` に置かれた下書きを失敗にする。公開は常に人が一次資料を読んで判定する。

`poc`（攻撃コードの公開）には自動検出の発見源がなく、oss-security などを人が確認して手動で追加する。取得失敗は終了コード 2 で区別し、「候補なし」とは扱わない。GitHub Actions の `product-candidates` ワークフローが毎週月曜に同じ検出を実行し、結果をジョブの要約とアーティファクトに残す（Issue や PR は自動作成しない）。

## 更新手順

1. 候補を集める：`pnpm product:candidates --since <前回確認日>` の報告（JPCERT/CC 注意喚起一覧、IPA 重要なセキュリティ情報、CISA KEV の `dateAdded`）に、確認依頼のあった製品の開発元告知を加える
2. 各候補について開発元告知とCVEレコードを読み、影響範囲・修正版・CVSS・悪用の記述を転記する。推測で補わない
3. 収録基準に該当するかを判定し、`inclusion` と根拠項目を埋める。該当しない候補も確認記録に残す
4. `listedDate` を根拠項目の日付から決め、`product-meta.json` の期間に収まることを確認する
5. `node scripts/product-status.mjs` と `pnpm check` を実行する

利用者の依存関係・構成・非公開資料は送信しない。製品名で引ける状態にするところまでが範囲で、利用の有無の判定はしない。

## 2026-10-22 の初回収録

2026年10月1日〜22日の `listedDate` を対象に31件を収録し、同日中に `poc` 理由を追加して Linux カーネルの Infinity Core 6件（CVE-2026-98260、98256、89754、80775、98385、97941。公表者が10月16日に攻撃コードを公開、kernel CNA の CVSS は 7.8 High または未記載、注意喚起・KEV・実悪用なし）を加え、計37件とした。10月23日には、公表者 FoxIO が実装ごとの攻撃コードを公開した HTTP/3 QPACK 増幅攻撃（Header Accordions。quic-go / quiche / lsquic / Wireshark は修正済み、Bun / h3 / aioquic は未修正）を告知単位の1記録として `poc` 理由で加え、計38件とした。ライブラリとして配布される実装はライブラリの脆弱性カテゴリーの対象でもあり、記録の注意書きで両者の関係を示す。内訳は CISA KEV 10月追加分 24件、IPA注意喚起だけが契機の Movable Type 2件と Oracle Java SE 1件（54 CVE を1記録に集約）、開発元 Critical が契機の PHP 2件（IPA注意喚起も確認）と GitLab 2件。候補と判定は [確認記録](data/product-advisory-review-2026-10-22.json) を参照。

- JPCERT/CC の10月注意喚起4件のうち、SiteGuard Server Edition、Microsoft 10月更新、PHP（10月22日、初回確認後に追加）は収録、国内組織の不正アクセスは製品を特定しないため対象外
- IPA の10月分7件のうち、不正アクセス事案対策は製品を特定しないため対象外。NetScaler（9月28日）は対象期間前
- Oracle Java SE は当初、Critical なし・JPCERT注意喚起なしで除外としていたが、IPAの10月21日注意喚起を確認して `alert` 理由で収録した
- KEV 10月追加分のうち、ProFTPD・BIND・Struts・ONLYOFFICE・Strapi の5件は2015〜2023年公表の古い脆弱性で、`publishedDate` と `listedDate` が離れる。Struts と Strapi はライブラリとしても配布されるが、ライブラリ収録期間（2022年11月以降）より前のため、ライブラリ側には存在しない
- 取得できなかった開発元資料：Citrix CTX697174、Ivanti（スクリプト描画）、BeyondTrust BT26-05（HTTP 403）、EGセキュアソリューションズ（サイトがPHP脆弱性対応でメンテナンス中）。いずれもCNAのCVEレコードとJVN等で補い、`caveats` に明記


## 2026-10-24 の対象限定ギャップ補完

確認依頼のあったNode.js・BINDと話題の一次資料で確認したArista・Oracleを既存基準で4記録追加し、合計42件とした。全製品の網羅調査ではなく、企業事案やライブラリの件数とは合算しない。

- Node.jsは10 CVEを1告知へ集約。CERT.LV等が全10件を列挙しており、High以外もalert基準を満たす。各系列の影響と22.23.4 / 24.22.1 / 26.12.1の修正版を区別し、BrotliのCNA評価をNode.jsの評価へ上書きしない。[確認記録](data/node-release-gap-review-2026-10-24.json)
- BIND CVE-2026-94300はISC High 8.1。CERT-FRの10月22日注意喚起を契機とし、Criticalや実悪用を推定しない。併せて、既存ライブラリWasmtimeのGHSA-897f-g5gm-fmxmへ、開発元・CNA・OSVで確認したCVE-2026-115889を別名として追加。新規脆弱性件数は増やさない。[確認記録](data/bind-wasmtime-gap-review-2026-10-24.json)
- Arista CVE-2026-114625はCriticalと開発元が確認した実悪用を根拠に収録。Oracle CVE-2026-91403は定例CPU集合とは別のCritical告知で、更新済みランタイムにもルート証明書除去や失効確認等の追加対策が必要。単一修正版で解決したと表現しない。[確認記録](data/product-advisory-review-2026-10-24-arista-oracle.json)
- CISA全件JSONはHTTP403で取得できず、新規記録のKEV状態は不明。AristaのCNA内CISA ADPに10月23日KEV追加の記載があることは留保・監査に残すが、直接取得に成功したと扱わない。既存の良好なデータと収集成功点は保持した。
