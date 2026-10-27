# 脆弱性データのソース別カバレッジ検証

## 2026-10-27の確認結果

固定ソースを `af4e4b65e9787a45b2e6475edb959f65f430afaa`（2026-10-26T21:01:36Z）へ更新。前回成功確認点から全418変更ファイルを比較し、Reviewedの変更34件（対象29件、期間外1件、対象外4件）とunreviewed384件を区別。Reviewed全37,192 JSONを読み、対象19,254アドバイザリを全件再照合した。追加・削除・撤回状態の変更は0件。成功確認時刻から24時間の重複窓に加えて全文比較し、更新日時が古い訂正や遅延掲載も確認する。

表示は19,411件（未撤回18,544件・撤回履歴867件）。補助ソースで個別確認したPingora3件、webpage1件、skiplist2件の計6件を追加し、個別編集は556件（固定ソースへの重ね合わせ398件、固定範囲外158件）になった。当日の新規公表件数ではない。

- Reviewedの対象29変更のうち、影響版・パッケージ・CVSSに変更のある19 IDを区別。同一IDの開発元GHSA API19件を取得し、別の公式資料等も含め23個別編集（新規overlay19、既存4）を保存。残る6件はdatabase確認のままで、Open WebUI XSSの初回修正版0.3.14を開発元確認済みとはしない。HTTP200の読み込み画面6件とPyPI404の1件を本文確認成功から除外する。
- Keycloakの開発元が示す系列別修正版26.2.14／26.4.10／26.5.5とDB範囲、aiohttpの開発元LowとDBのModerate・CVSS4.0、Wagtailの正式版とrc版の下限差を保持。Log4jのbridgeとcore、Open WebUIの依存関係説明、pyLoadのプレリリース境界と配布未確認も出典別に残す。範囲・修正版・評価を一律に置き換えない。
- OSV7エクスポート284,837記録（284,428 ID）を以前の固定generationのサイズ・SHA256と照合し、両アーカイブ全件CRCと正規化JSONで比較。通常脆弱性は追加26・変更54・削除0、MALは追加37・変更48・削除0。MALを通常脆弱性に混入せず、ソース候補数を新規有効脆弱性数としない。
- 新規RustSec26候補中、安定GHSA別名と開発元本文・OSV APIを確認した6件を収録。Pingoraはcoreとproxyの両パッケージを保持し、H2メモリ問題の0.8.1への更新だけではカスタムH2Optionsの上限設定を代替しない。残りは期間外・安定主ID未確定等の理由で保留し、推測でIDを作らない。
- Pillow27件とMLflow1件のBIT別名28件はOSV APIとエクスポートの全文一致を確認して既存記録へ追補。以前の開発元確認内容・影響範囲・レコード日時を保持し、今回のOSV確認日時・原データ日時を出典側へ分離。PYSEC2件の列挙バージョン変更は元の構造化内容と監査へ残し、修正境界の変更とはしない。
- JVN/JPCERTの3フィードを取得し、新しいBrotli等の公式本文を確認。Brotliは既収録の系列別境界を支持するため重複追加しない。PHP等の製品情報はライブラリ事案に投入しない。MyJVN503・CISA KEV403は取得失敗として成功取得点と良好な既存値を維持し、変更なし・未掲載とは判断しない。

[Reviewed差分](data/github-reviewed-delta-2026-10-27.json)、[開発元確認](data/reviewed-maintainer-review-2026-10-27.json)、[補助ソース](data/supplemental-source-status-2026-10-27.json)、[補助候補](data/supplemental-candidate-delta-2026-10-27.json)、[個別追加](data/supplemental-individual-review-2026-10-27.json)、[別名追補](data/supplemental-alias-update-review-2026-10-27.json)、[保留候補](data/supplemental-held-candidate-review-2026-10-27.json)、[フィード本文](data/supplemental-feed-review-2026-10-27.json)を参照。全収録の開発元を今回個別再確認した意味ではない。以下は過去の確認履歴として保持する。

## 2026-10-26の確認結果

GitHub Advisory Database の HEAD `dbe4ccda1196a32f340ac2d8bfd1200ee6a9d438`（2026-10-25T18:37:35Z）まで、前回成功点からの全138変更ファイルを比較。すべて unreviewed で、Reviewed 全37,192件のJSON読込・内容ハッシュと tree SHA は前回と同一だった。固定表示ソース `636c67b12b53b8156458e7fd63072a89a388e634`、表示19,405件、個別編集531件、各記録の確認日時を維持し、今回の成功した内容不変の確認時刻は監査へ別記した。24時間の重複窓に加え、全文差分で遅延掲載・日時を維持した訂正を確認した。

- OSVの7全エクスポート284,774記録（284,365個別ID）を、前回の固定generationのサイズ・SHA256、両アーカイブ全件CRC、正規化JSONで比較。通常脆弱性の追加・変更・削除は0、MALは追加49・変更13・削除0。MALを通常のライブラリ脆弱性へ混入しない。
- JVN/JPCERTの3フィード91項目は取得成功・本文ハッシュ不変。MyJVNはHTTP 503、CISA KEVはHTTP 403で取得失敗。MyJVNの前回成功点（2026-10-20T21:35:52.516599Z）と良好な1,271履歴行、KEVの未知状態を保持する。取得失敗を変更なし・未掲載・実悪用なしとは扱わない。
- crypto-bigintはOSVの安定GHSA/CVE別名がなく、開発元の公開advisories APIも空配列であることを再確認。既存の候補保留を維持する。全開発元の個別再確認という意味ではない。

[Reviewed全件照合](data/github-reviewed-delta-2026-10-26.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-26.json)、[保留候補確認](data/supplemental-held-candidate-review-2026-10-26.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-25の更新記録

固定コミットを `636c67b12b53b8156458e7fd63072a89a388e634`（2026-10-24T18:39:41Z）へ更新。前回成功固定ソースからの全267変更ファイルを比較し、Reviewedの追加34件・変更0件・削除0件とunreviewed233件を区別した。Reviewed全37,192ファイルを読込・解析し、対象19,254アドバイザリを全件収録。期間前13,864・対象エコシステム外4,074・変換失敗0。前回成功確認時刻から24時間重複する窓に加え、全文比較で遅延追加や訂正を確認する。

表示は19,405件（未撤回18,538・撤回履歴867）、前回から29件増加。Reviewedの対象追加33件のうち5件は既存の個別収録と集約するため表示28件増、補助ソースから別の脆弱性1件を追加した。対象外の新規1件はPackagistのみのLaravel。新しい撤回・再有効化・削除はなく、履歴を維持する。当日の新規公表数ではない。個別編集531件は重ね合わせ379件と固定ソース外152件からなる。

- 新規Reviewed34件すべての開発元GHSA APIを取得・照合し、28新規個別編集と既存5件の再確認へ反映。既存の日本語要約・元の日時根拠・系列別範囲を保持する。全19,405件の開発元を今回再確認した意味ではない。公開監査は必要な構造化項目・ハッシュ・確認内容に限定し、原API本文・PoC・無関係な個人情報を含めない。
- virtualenv7件は開発元が確認した21.14.8と、Reviewedのより広い範囲を区別し、以前の版が安全とは断定しない。一時app-dataの別件は開発元の導入境界20.0.6とReviewedの21.14.8を保持。virtualenv2件のLow対Moderate、MSAL NodeのMedium/CVSS3.1 5.9対Highという評価差も出典別に残す。
- Pillow ArrowのGHSAは13.0.0を含むように見える範囲と空の修正版欄を持つが、マージ済みPR・修正commitのtagへの包含・公式リリースから13.0.0の修正を確認。virtualenv一時app-dataの21.14.10、Happy DOMの21.0.4も計8取得のリリース・修正資料で確認し、本文に残る「修正版未公開」等の記述との差を保存する。Pillowのolefileやalignment、MLflowの任意scorer依存、multerの非同期filterなどの適用条件を一律化しない。
- OSV7エクスポート284,725記録・284,316 IDsを前回固定generationのSHA256・サイズ、全ZIP CRC、正規化全文で比較。非MAL37追加・36変更、MAL6追加・変更0、削除0、同一IDのエクスポート間内容差0。API7件も対応exportと全文一致。成功内容確認時刻−24時間の重複窓に加え全文比較を維持する。MALを通常のライブラリ脆弱性へ混ぜない。
- @hapi/contentのCVE-2026-115728は6.0.1以上6.0.3未満の不完全修正。CNAは旧GHSA/CVEをrelatedと明示し、修正PR・tag・npmを確認して別記録1件を追加。OSVの旧GHSAへの追加aliasを採用せず、旧問題の修正版6.0.1と混同しない。Vyper3件のCVE別名を追補し、nested-callの開発元/CNAの完全修正0.3.0とDBの部分修正0.2.6の差を保存。Entire CLIの通常版v0.7.7とnightly v0.7.8-nightly.*の境界、Uni-CLI・Wasmtimeの別名も出典付きで保持する。
- Brotliの上流3系列1.0.10／1.1.1／1.2.1、Pythonの2パッケージの1.2.1／1.2.1.0、Envoy・Istioの下流版と有効化条件を公式資料で確認。下流製品をPyPI範囲へ混在させず、Envoyが列挙した版より古い版へ推定拡張しない。Istioの告知日10月15日とBrotli追記履歴10月20日を区別し、告知全体のCVSSをBrotli個別の評価に流用しない。
- JVN/JPCERTの3フィード91項目は変更0。MyJVNは503、CISA KEVは403で、以前の成功点と良好な履歴1,271行を保持。crypto-bigintは開発元の0.7.6修正を確認したが安定GHSA/CVEがないため候補として保持する。以前からの未確定候補も推測で解消しない。製品カテゴリーは42件を維持し、Envoyの同一CVE重複に関するスキーマ上の制約など未収録の理由も別記する。取得失敗を変更なし・未掲載・悪用なしと扱わない。

[Reviewed差分](data/github-reviewed-delta-2026-10-25.json)、[開発元確認](data/reviewed-maintainer-review-2026-10-25.json)、[補助ソース](data/supplemental-source-status-2026-10-25.json)、[補助候補](data/supplemental-candidate-delta-2026-10-25.json)、[個別追加](data/supplemental-individual-review-2026-10-25.json)、[別名追補](data/supplemental-alias-update-review-2026-10-25.json)、[Brotli下流確認](data/brotli-downstream-review-2026-10-25.json)、[保留候補](data/supplemental-held-candidate-review-2026-10-25.json)、[取得失敗](data/supplemental-fetch-failures-2026-10-25.json)、[製品候補確認](data/product-advisory-review-2026-10-25.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-24の更新記録

固定コミットを `073abc5bb4bf1211995d8cec3f32de47ce5195ee`（2026-10-23T21:51:41Z）へ更新。前回成功固定ソースとの差分74ファイル（追加67・変更7）とReviewed全37,158ファイルを解析した。対象19,221アドバイザリ、期間前13,864・対象外4,073・変換失敗0。前回成功確認時刻から24時間重複する窓に加え、全文差分で遅延追加・訂正を確認する。

表示は19,376件（未撤回18,509・撤回履歴867）、前回から71件増加。Reviewedの対象追加65件は既存個別収録1件と集約し表示64件増、補助ソースWasmtimeの過去公表7件を追加した。空のalias配列を持つ新規の撤回重複12件は別履歴として保持し、既存bracesの撤回1件と区別する。当日の新規公表数ではない。

- 全74差分を開発元GHSA・CNA・リリース・修正資料で確認。50の異なる開発元GHSAはAPI46件、API失敗後の公開HTML4件で確認し、取得失敗を別記した。Red Hat・IBMのHTTP200エラー本文は取得成功とせず、CNA代替の確認範囲を明示する。既存日本語編集を保ち、60の個別確認を重ねる。撤回重複履歴を除く深刻度差13件は出典別に保持。
- Apache TomcatのApache LowとReviewed Critical/CISA ADP CVSS3.1 9.1を区別。MLflowはDBが3.17.2を修正境界とする一方、開発元tagの対象処理と修正PRが整合しないため個別表示の修正版を未確認(null)とし、元のDB範囲を保持する。別の修正版が存在しないという主張ではない。Zodは上限付きcollectionへの修正、FastMCPは更新に加えてissuer設定が必要という条件を保持。
- BrotliのCNA/OSVで明示されたCVE・PYSEC別名を追補するが、上流C実装の3系列とPython wrapperの範囲を同一化しない。既存Wasmtime8件とBytebaseの別名も出典付きで追補。GoployのOSV新CVEはCNAで別の範囲・related参照と確認され、既存GHSAへ統合せず保留する。
- OSV全7エクスポート284,680記録・284,273 IDsを前回固定generationのSHA256、全ZIP CRC、正規化全文で比較。非MAL68追加・28変更、MAL45追加・13変更、削除0、同一IDのエクスポート間内容差0。API21件も対応exportと全文一致。悪性パッケージ報告を通常の脆弱性へ混ぜない。
- JVN/JPCERTの3フィード91項目と変更6URLの本文を確認。MyJVNは503、CISA KEVは403で、以前の成功点・良好な履歴1,271行を保持。ctutils/Tokio AsyncFdは安定主IDが未確認、vLLMは範囲・修正またはパッケージ対応が未確定のため候補として保持。未確認や取得失敗を変更なし・悪用なしと扱わない。

[Reviewed差分](data/github-reviewed-delta-2026-10-24.json)、[開発元確認](data/reviewed-maintainer-review-2026-10-24.json)、[補助ソース](data/supplemental-source-status-2026-10-24.json)、[補助候補](data/supplemental-candidate-delta-2026-10-24.json)、[個別追加](data/supplemental-individual-review-2026-10-24.json)、[別名追補](data/supplemental-alias-update-review-2026-10-24.json)、[保留候補](data/supplemental-held-candidate-review-2026-10-24.json)、[取得失敗](data/supplemental-fetch-failures-2026-10-24.json)を参照。

## 2026-10-23の更新記録

固定コミットを `42c7a08c808d82cb0b5c6bd03f078c1fd2905f69`（2026-10-22T19:24:27Z）へ更新。前回成功固定ソースとの差分72件（追加71・変更1）とReviewed全37,091ファイルを確認。対象19,156アドバイザリ、期間前13,864・対象外4,071・変換失敗0。更新時刻の24時間重複窓に加えて全文差分を使用する。

表示は19,305件（未撤回18,451・撤回履歴854）、前回から69件増加。Reviewedの新規71ソースは既存の個別収録・別名重複を集約し表示67件増、補助ソースLIFF SDK・Tokioの2件を追加した。新規の撤回重複2件と既存sprintf-jsの撤回1件を区別し、履歴を削除しない。

- 変更72件は開発元の68公開GHSA（API57・HTML代替11）とGNOME/CNA/RustSec、sprintf-jsの公開根拠を確認。API失敗11件を成功取得と混同せず、HTMLによる確認を別記。toml-nodeの開発元とReviewedの構造化パッケージ名tomeは、固定コミットのpackage.jsonとnpm公式メタデータでtomlと確認して表示を訂正し、原表記を証跡に保持。pypdfの修正版6.2.10対本文/DB6.21.0、10件の深刻度ラベル差は推測で解消しない。
- CVE-2026-96889のNext.jsと上流Librsvgは、開発元が共有するCVE・依存関係を根拠に集約。Librsvgの5系列の範囲・修正版とNext.js側の条件を両方保持し、上流とラッパーの影響条件・深刻度を一律化しない。
- OSV全7エクスポート284,566記録・284,160 IDsを前回固定generationのSHA256と全ZIP CRC、正規化全文で比較。非MAL72追加・2変更、MAL73追加・9変更、削除0。Go・Maven・NuGetは変更なし、RubyGemsはMALのみ変更。悪性パッケージ報告は通常の脆弱性へ混ぜない。
- LIFF SDKはnpm `@line/liff` 2.20.0以上2.31.1未満、修正版2.31.1。開発元とJVNの表記差、CVSS4.0 5.1と3.1 6.1を出典別に保存。Tokioは1.54.0のマルチスレッドruntimeのInterval、修正版1.54.1。Sleep・Timeoutへ影響を拡張せず、CVSSを補わない。
- JVN/JPCERTの91項目・新規7URL本文を確認。LIFF以外のPHP/BINDは製品カテゴリで今回のライブラリ収録対象外。MyJVNは503、CISA KEVは403で、以前の成功点・良好な履歴を保持。失敗は未掲載・悪用なし・変更なしを意味しない。

[Reviewed全件差分](data/github-reviewed-delta-2026-10-23.json)、[開発元確認](data/reviewed-maintainer-review-2026-10-23.json)、[補助ソース](data/supplemental-source-status-2026-10-23.json)、[補助候補差分](data/supplemental-candidate-delta-2026-10-23.json)、[個別追加](data/supplemental-individual-review-2026-10-23.json)、[フィード本文判定](data/supplemental-feed-review-2026-10-23.json)を参照。

## 2026-10-22の更新記録

固定コミットを `e603ab7fcde7887f5cc8c30b06e4e5ea3e32784b`（2026-10-21T20:50:27Z）へ更新。前回成功スナップショットからReviewed全変更47ファイルを比較し、全37,020ファイルを解析した。対象は19,085件、期間前13,864件、対象外4,071件、変換失敗0件。24時間の重なり期間に加えて全文差分を用い、遅延追加や更新日時の古い訂正も確認する。

表示は19,236件（未撤回18,385、撤回履歴851）。前回から60件増加し、内訳はReviewed47件・Tomcat8件・Next.js/React5件。既存CVE-2026-111943の訂正は新規件数に含めない。個別編集362件はoverlay211件・固定ソース外151件である。

- Reviewed追加47件は開発元APIを47回取得し、46の異なる開発元告知と撤回重複1件を照合。新規個別overlay46件を保存した。OpenClawの撤回済み重複はaliasの明示がないため推測統合せず履歴を保持する。9件の深刻度ラベル差、Vitestの構造化欄・本文・Reviewedの範囲差なども出典別に保持する。
- OSV7エコシステムの284,421記録・284,015 IDsを前回固定generationのサイズ・ハッシュと照合してCRC検証・正規化全文比較。非MALは追加50・更新43 IDs、MALは追加15・更新11 IDs、削除0。RubyGemsは変更なし、他6ソースは変更あり。MALを通常の脆弱性へ混ぜない。
- 非MAL差分89 IDsは現在のReviewedと対応。残る4 IDsは既存CVE-2026-111943の同一性群で、Go stdlibを追加しRustの範囲を訂正。webpki-roots / webpki-root-certsの0.26.11は互換ラッパーであり、依存先1.xを1.0.10以上へ更新する必要がある点を明記した。新たな4件として数えない。
- JVN/JPCERTの3フィード91項目と27新規URLを確認。Tomcat8件はApache公式9/10/11系列の告知・CNA・修正対象クラス・公式ビルド定義とMaven座標を照合して追加。系列別影響範囲と修正版を保持し、EOL系列で未公表の修正版はnull、important表記だけではHighに変換しない。Next.js/React5件は公式告知と公開repository GHSA原データで確認して追加。OSV/global GHSA APIの404は掲載未確認として保持し、repository advisory API成功とは分ける。厳密な不等号・条件・関連IDとaliasも区別する。Xerjはパッケージ対応未確定で保留する。
- MyJVNはHTTP200だがメンテナンスHTMLであり取得失敗。以前の成功日時と1,271履歴行を保持。CISA KEVは403で未知状態を維持し、未掲載・悪用なしとは扱わない。

[Reviewed差分](data/github-reviewed-delta-2026-10-22.json)、[開発元照合](data/reviewed-maintainer-review-2026-10-22.json)、[補助ソース取得](data/supplemental-source-status-2026-10-22.json)、[候補判定](data/supplemental-candidate-review-2026-10-22.json)、[Tomcat確認](data/tomcat-candidate-review-2026-10-22.json)、[Next.js確認](data/nextjs-candidate-review-2026-10-22.json)を参照。以下は過去の確認時点の履歴であり、現時点の未解決状態を上書きするものではない。


## 2026-10-21の更新記録

2026-10-21（JST）の確認では、固定コミットを `e411ff2b84c425b1b0349aa88916713bebe7786a`（2026-10-20T21:13:35Z）へ更新した。前回成功確認したHEADから全1,760変更ファイル、前回収録スナップショットから全2,504変更ファイルを比較し、Reviewed全36,973ファイルを読込・解析した。Reviewedの追加74件・変更46件のうち対象は追加73件・変更45件。対象19,038件を全件再収録し、期間前13,864件・対象エコシステム外4,071件・変換失敗0件を分離する。

表示は19,176件（未撤回18,326、撤回履歴850）で95件増加した。内訳はReviewed対象73件と補助ソース22件で、当日の新規公表件数ではない。個別編集303件は重ね合わせ165件と固定ソース外138件。Reviewedソースの撤回849件と、個別収録だけにある撤回1件を合わせた表示850件はいずれも従来と同じで、新しい撤回・再有効化・削除は0件。

- 対象の新規73件と既存変更45件、計118件すべての開発元本文を取得・照合した。API成功54件、公開HTML成功64件で、失敗したAPI63リクエストは別記する。確認した範囲・評価・追加条件を62新規個別編集と5既存個別編集へ反映。全19,176件の開発元を再確認したという意味ではない。監査は公開構造化項目と根拠・ハッシュに限定し、原文HTML/APIの無関係な項目やPoC本文は公開しない
- MsQuicの修正境界を2.6.2から系列別2.5.12／2.6.3へ訂正し、SignalRの誤ったCoreパッケージ行の削除を反映。OpenTelemetry、Jackson、Couchbaseでは開発元とDBの下限・修正版・本文内の不整合を推測で解消せず、それぞれの出典を残す。RabbitMQの追加CVSS3.1と開発元のCVSS4.0も版・出典を分ける
- certifiは開発元の修正境界2026.10.18とDBの2026.10.19を区別。公式配布メタデータ・チェックサム照合したwheelで、.18の除去と.19での影響外ルートの復元を確認し、問題のECC G3は復元されていないことを記録。MCPでは更新だけでは有効にならない上限・audience設定や、transportの共有をやめる必要を明記する。agent-router、uv、Angular、Pillowなどの評価・版表記・適用条件の相違も平坦化しない
- OSVの7全エクスポート284,356記録（283,950ソースID）と前回283,990記録を保存済みサイズ・ハッシュに照合し、全件CRC検証と正規化全文比較を実施。非MALは追加179・変更154、MALは追加187・変更20、削除0、エクスポート間の同一ID内容差0。前回成功内容確認時刻−24時間の重複窓に加え、全文比較で後日訂正を確認した。MALや悪性依存関係の通知は通常の脆弱性へ追加しない
- 補助ソースからWasmtime6件、webpkiの1同一性グループ、undici9件、Backstage1件、Apache CXF5件を開発元・公開原データで確認して追加。WasmtimeのCritical2件はCVSS3.1 9.9として保存し、実悪用とは扱わない。CXFはApache/CNAのパッケージ固有名・系列別境界を維持し、JVN概要との分類差や数値のない「important」評価からHighを推測しない
- OSVとReviewedで一致しない別名は候補監査の新旧項目と同一性台帳に保持する。追加別名のある107 GHSAソースを、Reviewed由来の別名として装わない。うちCVE別名5件は2件が収録期間外、3件が収録期間内で、2件は現在のReviewedのCVEと異なる（うち1件は開発元もReviewedと同じCVEを明示）。後者を含む個別の同一性照合は保留し、既存IDを置換しない。別名で未一致の995ソース記録も独立した未収録の有効脆弱性数ではない
- MyJVNは前回成功確認−24時間を含む10月18〜21日JSTの変更日窓を全12ページ・562製品/CPE記録取得。先頭ページ再読で安定し、履歴との比較では新規561行・共通行の日時だけの変更1行。従来の履歴を保持し、窓外へ移った行を削除とみなさない。JVN/JPCERTの3フィード79項目も取得し、新しい4告知は製品/Cユーティリティとして対象外。製品/CPE全件数をライブラリの未収録数にはしない
- CISA KEV公式JSON、保留中のEclipse Milo・dcm4che向けCISA本文はHTTP 403。以前の成功取得点と未知のKEV状態を維持し、失敗を未掲載・悪用なし・確認完了とみなさない。webpkiのCVE APIは404のため同一性の根拠を取得済みRustSec別名に限定。Azure2候補の版矛盾、vLLMのパッケージ対応・修正版矛盾などの未解決候補も保留する

[Reviewed全件照合](data/github-reviewed-delta-2026-10-21.json)、[開発元118件の個別照合](data/reviewed-maintainer-review-2026-10-21.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-21.json)、[候補の判定](data/supplemental-candidate-review-2026-10-21.json)、[補助ソースの個別追加](data/supplemental-individual-review-2026-10-21.json)、[vLLMの保留根拠](data/vllm-candidate-review-2026-10-21.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-19の更新記録

2026-10-19（JST）の確認では、GitHub Advisory DatabaseのHEAD `bd2141aaa8c93b3cecf03aba723011b7d709e5db`（2026-10-18T21:36:46Z）まで比較した。固定ソースからの変更753ファイル、前回成功確認したHEADからの変更652ファイルはすべてunreviewed。Reviewed全36,899件のJSON読込・解析と内容ハッシュを再確認し、変更がないため固定コミット `8e6fcc108ca6695dfcae73e70447aba37a3b5832`、対象18,965件とReviewed由来の確認日時を維持した。成功した内容不変の確認時刻は今回の監査に別記している。

表示は19,081件（未撤回18,231、撤回履歴850）のまま。既存209個別編集を保持し、既存アドバイザリへの別名補完10件を加え、個別編集は219件（重ね合わせ103、固定範囲外116）となった。今回の取得で新しく現れたソース記録を、当日の新規公表や新たな独立した脆弱性と数えない。

- OSVの7全エクスポート283,990記録（283,584ソースID）と、前回の固定generationで取得した283,987記録を保存済みサイズ・ハッシュに照合し、全件CRC検証と正規化全文比較を実施。非MALは追加1・変更14、MALは追加2・変更2、削除0、エクスポート間の同一ID内容差0。成功内容確認時刻−24時間の重複窓を保存し、全内容比較でも後日訂正を確認した
- 変更14件はCoder・VikunjaのGHSA/Goソースの別名と更新日時のみ。影響範囲・CVSS・撤回は不変で、元ソースの新旧別名・日時を監査に残し、OSVが明示した10件のCVE別名を既存表示記録にも補完した。10件のOSV APIを全エクスポートと照合し、開発元APIも別途取得したが、開発元のcve_idはすべてnullのため、CVE対応はOSV由来と明示する。開発元の日時・版表記やCVSSの有無を固定DBと同一とは扱わない。MALは通常のライブラリ脆弱性に追加しない
- 新しいPYSEC-2026-4319は、既に保留していたvLLMのCVE-2026-105922に対応する。OSVの修正境界0.32.0と、開発元の未マージ修正PR・実行方式による影響の違いが整合しないため、修正版を確定せず候補として保持。別名で未一致の995ソース記録は、情報通知・撤回・個別照合済みだが別名で一致しない記録も含み、独立した未収録の有効脆弱性数ではない
- MyJVNは10月17〜19日JSTの変更日窓で0製品/CPE記録。正常終了した空の1ページと先頭ページ再読でクエリ・総数・空結果を確認し、APIの空結果プレースホルダーは件数から除外した。前回186行は今回の窓の外に移ったため履歴へ保持し、計1,272履歴行とする。削除とはみなさない。今回の共通行は0であり、以前の原XML・descriptionを再検証したとはしない
- JVN/JPCERTの3フィードは取得成功・本文ハッシュ不変。CISA KEV公式JSONと保留中のEclipse Milo・dcm4che向けCISA本文は引き続きHTTP 403。以前の成功取得点、未知のKEV状態、未確定のパッケージ対応を維持し、取得失敗を未掲載・悪用なし・確認完了とみなさない

[Reviewed全件照合](data/github-reviewed-delta-2026-10-19.json)、[Reviewed開発元確認の対象](data/reviewed-maintainer-review-2026-10-19.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-19.json)、[候補の判定](data/supplemental-candidate-review-2026-10-19.json)、[別名補完の開発元・OSV照合](data/osv-alias-overlay-review-2026-10-19.json)、[vLLMの保留根拠](data/vllm-candidate-review-2026-10-19.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-18の更新記録

2026-10-18（JST）の確認では、GitHub Advisory DatabaseのHEAD `27185a855580c49d2738b648493da1e9246a2cfe`（2026-10-17T18:36:59Z）まで比較した。変更115ファイルはすべてunreviewedで、Reviewed全36,899件は前回と同一。全JSONの読込・解析と内容ハッシュを再確認し、固定コミット `8e6fcc108ca6695dfcae73e70447aba37a3b5832`、対象18,965件と既存記録の確認日時を維持した。取得成功・内容不変の確認時刻は別の監査に記録する。

補助ソースからRustの6件を開発元本文と個別照合して追加し、表示は19,081件（未撤回18,231、撤回履歴850）。個別編集209件は重ね合わせ93件と固定範囲外116件からなる。6件は過去公表分の収録追加であり、当日の新規公表件数ではない。既存203件の個別編集は変更していない。

- OSVの7全エクスポート283,987記録（283,581ソースID）と、前回283,966記録の保存済みサイズ・ハッシュを照合し、全件CRC検証と正規化全文比較を実施。非MALは追加10・変更6、MALは追加11・変更0、削除0、エクスポート間の同一ID内容差0。成功確認時刻−24時間の重複窓に加えて全内容を比較した
- 追加はpest_grammars、zipの3件、ammonia、negentropy。zipの権限変更問題では開発元の修正版9.0.1とOSVの9.0.0、ammoniaでは開発元の導入境界4.1.0とOSVの0.0.0-0を区別し、元の範囲・評価・出典を保持。pestのスタック保護は対応するstd環境に限ること、zipのOS権限・後続アクセス条件、ammoniaはXSSではないという留保を残した
- negentropyは開発元の公開GHSAを確認したが、OSVにGHSA別名がなく全体GHSA APIは404だった。開発元の公表・更新日時を根拠に独立したGHSA記録を追加し、根拠のないRustSec別名やOSV日時を結合しない。RustSec候補は個別照合済みであることと、別名で一致していないことを分ける
- OSVの既存変更6件は別名・更新日時・スキーマ版のみで、影響範囲・CVSS・撤回の変更はない。zvariant等3件の未保守通知とMALは通常の脆弱性へ追加しない。別名で未一致の994ソース記録には個別照合済みのnegentropyや情報通知・撤回記録も含まれ、独立した未収録の有効脆弱性数ではない
- MyJVNは10月16〜18日JSTの変更日窓を全4ページ・186製品/CPE記録取得。先頭ページ再読で安定し、前回との共通186行は保存したXML項目と一致、新規行0。JVN/JPCERTの3フィードも取得成功・内容不変。製品/CPE全件数をライブラリの欠落数にはしない
- CISA KEV公式JSONと保留中のEclipse Milo・dcm4che向けCISA本文はHTTP 403。以前の成功取得点とKEVの未知状態を維持し、取得失敗を未掲載・悪用なし・確認完了とみなさない

[Reviewed全件照合](data/github-reviewed-delta-2026-10-18.json)、[Reviewed開発元確認の対象](data/reviewed-maintainer-review-2026-10-18.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-18.json)、[候補の判定](data/supplemental-candidate-review-2026-10-18.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-17の更新記録

固定コミットを `8e6fcc108ca6695dfcae73e70447aba37a3b5832`（2026-10-16T21:17:43Z）へ更新し、Reviewed全36,899件、対象18,965件を全件再照合した。新規14件のうち対象13件・対象エコシステム外1件、既存変更1件、削除0件。最終表示は19,075件、撤回履歴850件、未撤回18,225件。前回より14件増えたが、収録追加数であり当日の新規公表件数ではない。個別編集は203件（重ね合わせ93、固定範囲外110）。

新しい撤回済みGHSAは別のGHSAと重複すると本文で説明されているが、ソースの別名配列に同一性リンクがないため推測で統合せず履歴として保持した。開発元とDBの範囲・修正版・CVSS評価の相違は個別編集と監査に保存する。全件の開発元を人手で再検証したという意味ではない。CISA公式JSONのHTTP 403は未掲載を意味せず、以前の成功取得点と未知状態を維持する。

- OSVの7全エクスポート283,966記録（283,560ソースID）をCRC確認して前回と正規化全文比較。非MALは追加13・変更32、MALは追加21・変更19、削除0。新しい非MALはすべてReviewedに一致。MALを通常の脆弱性へ追加しない
- MyJVNは10月15〜17日JSTの変更日窓を全14ページ・683製品/CPE記録取得し先頭ページ再読で安定性を確認。追加186、共通行の比較可能フィールド変更1。前回省略されたdescriptionは比較不能として変更数から分離
- PyMongo CVE-2026-106435をMongoDB CNA・開発元Jira・パッケージ資料で追加。影響範囲>=0.10.3,<=4.18.2と修正版4.18.3、C拡張を使うBSON API条件、通常のDB通信経路は到達しないことを区別。CVSS4.0 5.9と3.1 5.1を出典付きで保持
- JVN/JPCERTの3フィードを取得。Eclipse Milo・dcm4cheの告知候補はCISA本文403とパッケージ対応未確定を明示して保留。既存未解決候補とソースごとの成功取得点を保持

[Reviewed差分](data/github-reviewed-delta-2026-10-17.json)、[開発元照合](data/reviewed-maintainer-review-2026-10-17.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-17.json)、[候補の判定](data/supplemental-candidate-review-2026-10-17.json)を参照。以降は当時の確認履歴として保持する。

## 2026-10-16の更新記録

固定コミットを `5a755a2d9f25ca36b15794f53c360a26021f6bad`（2026-10-15T20:24:50Z）へ更新し、Reviewed全36,885件、対象18,952件を全件再照合した。新規61件のうち対象57件・対象エコシステム外4件、既存変更2件、削除0件。全体の対象外4,069件、期間前13,864件、変換失敗0件を区別する。最終表示は19,061件、撤回履歴849件、未撤回18,212件。前回より95件増えたが、過去公表分の補完を含み、当日の新規公表件数ではない。既存138個別編集を変更せず、現在の個別編集195件（重ね合わせ86、固定範囲外109）を保持する。

- 対象の新規57件と既存変更2件、計59件の開発元API本文をHTTP 200で取得して照合。公開用にはアドバイザリの公開項目・抽出本文・許可したHTTPヘッダーのみを保存し、取得原文のハッシュと公開用抽出物のハッシュを分ける。HTMLの追跡情報や無関係なAPIメタデータは含めない。Reviewedの差分用JSONも公開構造化項目の抽出物で、詳細本文・コード例・無関係な報告用参照は含めない。元のGit blobのハッシュを別記し、詳細本文の変更は有無・長さ・ハッシュだけで記録する。全Reviewedの開発元を再確認したという意味ではない
- Twistedの含む影響上限を25.5.0から26.4.0へ訂正。開発元も修正版を示していないためnullを維持。netlicensing-mcpの開発元範囲<=0.1.5とDBの<0.1.8、構造化CVSS9.6と本文8.3の差を保存
- MCP Pythonの開発元High/CVSS3.1 7.5、containerd復元機能のCritical評価と再有効化時の留保、Claude CodeのCVSS4.0ベクトル差を個別編集に反映。Podman・KEDA・Talos・Sliver・Borgなどの範囲や修正境界の相違を平坦化しない。Pipecatは1.6.0で警告・文書が追加されても公開ランナーの認証機能は追加されないという開発元の説明を残す
- OSV7全エクスポート283,932件（283,526ソースID）をCRC検証し、前回283,746件も保存済みサイズ・ハッシュと照合して正規化全文比較。非MAL追加175・変更146、MAL追加11・変更7、削除0、同一IDのエクスポート間内容差0。成功確認時刻−24時間を含む窓と全件比較で後日訂正を確認した。未収録候補992ソース記録は独立した有効脆弱性数ではない
- MyJVNは10月14〜16日JST変更窓を全15ページ・708製品/CPE記録取得し、先頭ページ再読で総数・ID・本文の安定を確認。前回との共通行の比較可能フィールド変更0、追加497件。製品/CPE全件数をライブラリの未収録数にはしない
- JVN候補からAdobeの公式APSB26-163全体へ照合を広げ、未収録32 CVEをCNA原文・開発元告知・パッケージ記録で確認。c2pa、c2patool、@contentauth/c2pa-webの含む影響上限と修正版を分け、告知のMediumとCNAのHigh表記が異なる2件も残す。さらにPayload、music-metadata、Bouncy Castle MLS、Backstage TechDocsの4件を追加。Payloadの厳密な下限、music-metadataの確認版とCNA範囲、製品版とパッケージ版の差を保存
- JVN/JPCERTの3フィードと前回取得失敗のJVN6本文を取得。TLSの既収録別名一致、未確定・対象外候補を分離し、Siemensの.NET Client Library 2件を公式告知・CNA・パッケージ情報で確認して追加。CISA KEV公式JSONはHTTP 403で、既存の未知状態と以前の成功取得点を維持。取得失敗をKEV未掲載としない

[Reviewed差分](data/github-reviewed-delta-2026-10-16.json)、[開発元照合](data/reviewed-maintainer-review-2026-10-16.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-16.json)、[候補の判定](data/supplemental-candidate-review-2026-10-16.json)、[JVN起点の個別追加](data/jvn-candidate-review-2026-10-16.json)を参照。以降の節は当時の確認履歴として保持する。

## 2026-10-15の更新記録

固定コミットを `b950a40c9ce07b70b943775709034132dd9614cb`（2026-10-14T21:37:11Z）へ更新し、Reviewed全36,824件、対象18,895件を全件再照合した。新規4件、既存変更4件。対象外4,065件、期間前13,864件、変換失敗0件を区別する。最終表示は18,966件、撤回履歴849件、未撤回18,117件。前回より27件増えたが、過去公表分の補完を含み、当日の新規公表件数ではない。既存111個別編集を変更せず、現在の個別編集138件（重ね合わせ67、固定範囲外71）を保持する。

- 新規ReviewedはOpenAPI.NET YAML、Apprise、Metalama、BBOT。既存変更はgit2の更新日時、OmniFacesのCVE別名、flyto-coreの参照、grpcの参照URLエンコードと日時。既存4件のDB影響範囲・CVSS・撤回は変更なし
- 8件の開発元API本文を取得し、原文・HTTPヘッダー・ハッシュを保存。MetalamaのHigh/CVSS3.1 8.2と本文のCVSS4.0 6.0、OmniFacesの現在の説明範囲/CVSS、BBOTの影響上限・修正版表記、Appriseの追加設定が必要な緩和策を4個別編集に反映。固定DBとの差を残し、日時・評価を混ぜない
- OSV7全エクスポート283,746件（283,340ソースID）をCRC検証し、前回283,708件の保存済みサイズ・ハッシュを再確認して正規化全文比較。非MAL追加23・変更23、MAL追加15・変更22、削除0、同一IDのエクスポート間内容差0。成功確認時刻−24時間を含む窓と全件比較で後日訂正を確認する
- 新しいRustSec19件（rustls4・Wasmtime15）は固定RustSec・OSV・開発元資料で個別確認。OSV公表日時と開発元の初回公開日時を区別し、系列別修正境界・機能依存・評価の出典差を残す。候補ソース数を独立した有効脆弱性数としない
- MyJVNは10月13〜15日JST変更窓を全7ページ・348製品/CPE記録取得し、先頭ページの再読で総数・ID・本文の安定を確認。前回137件の比較可能フィールドは不変、追加211件。うちBackstage、Pydantic AI、Jackrabbit2件の計4ライブラリ事例を開発元/CNAで確認し追加。製品版とパッケージ版、Jackrabbitの含む上限と明示された修正版、CNA本文のHIGHと構造化CVSS4.0 6.9/MEDIUMの差を保存
- JPCERT2フィード取得成功、JVNフィードは接続タイムアウト。新しい8告知URLのうちJPCERT2本文を確認し、取得不可のJVN6本文を確認済みとは扱わない。CISA KEVは公式JSONが403で、未知の状態と以前の成功取得点を維持。すべての公式ソース・全開発元の個別再確認という意味ではない

[Reviewed差分と原文](data/github-reviewed-delta-2026-10-15.json)、[補助ソース取得状況](data/supplemental-source-status-2026-10-15.json)、[候補の判定](data/supplemental-candidate-review-2026-10-15.json)、[公開更新の監査](data/publication-update-2026-10-15.json)を参照。以降の節は当時の確認履歴として保持する。

## 10月14日 Wasmtime未収録候補の個別補完

日次更新後にGHSA-32h6-97mm-8q3c、GHSA-cfhf-m2cr-62wj、GHSA-hw8m-q44c-ggrfを追加。いずれも10月2日公表で、OSVには取得済みだったが固定Reviewedソースに含まれず、古い未収録候補から公開データへの反映が未完了だった。開発元の数値・版・修正境界を確認し、critical 9.3（CVSS4.0）、medium 5.9（CVSS4.0）、medium 5.7（CVSS3.1）を原文どおり保持した。

現在は18,939件、撤回849件、未撤回18,090件。Wasmtimeの公開記録は32→40件。RustSec49ソース記録は別名重複と収録期間外を含み、その差17を未収録件数とは扱わない。補完前は34ソースが公開32記録に対応し、7ソースが期間外、8ソースが期間内未収録だった。上記3件に加えRUSTSEC-2026-0222・0268・0269・0315・0316も個別確認し、固定RustSecソース内で期間内対象の未収録8件を補完した。この固定ソース・対象期間での照合であり、世界全体の全脆弱性を網羅した意味ではない。

既存の日次ソース監査と取得点を保持し、今回の個別確認・原文は[補完監査](data/wasmtime-backfill-2026-10-14.json)と[ソース原文](data/wasmtime-source-snapshots-2026-10-14.json)に保存する。以下の件数はこの補完前の日次確認時点の記録。

最新補助ソース確認：2026-10-14（JST）。[10月14日の補助ソース監査](data/supplemental-source-status-2026-10-14.json)、[候補の個別判定](data/supplemental-candidate-review-2026-10-14.json)、[Reviewed差分](data/github-reviewed-delta-2026-10-14.json)を参照。

## 2026-10-14の更新記録

GitHub Advisory Databaseの固定コミットを `96d67ec0f9a258b05b8d4ef805425ec9dc0d0489`（2026-10-13T21:40:32Z）へ更新。前回成功確認と収録固定コミット以降の全1,852変更ファイルを比較し、Reviewed43件（追加40・変更3）、unreviewed1,809件。Reviewed全36,820件を再走査し、対象18,891件を全件収録した。対象外4,065件・期間前13,864件を分離し、変換失敗・削除・別名による重複集約は0件。

- 新規Reviewed40件はNuGetの.NET関連アドバイザリ。DB公表日は2026-10-13T19:41:19Z〜20:53:46Z（JSTでは10月14日）。Critical3・High29・Moderate8を上流の評価として保持し、実悪用とは読み替えない
- 新規40件のうち26件と既存変更3件の開発元アドバイザリAPIを取得して、日時・パッケージ・修正境界を照合。新規14件のAPIは未認証レート制限403で個別確認未完了。全件の開発元確認とは表現せず、一括収録の検証レベルはdatabaseのまま。詳読した8件と比較結果は監査に区別して記録
- 既存変更3件はOpenRemote・oauthlib2件の参照と更新日時のみ。固定DBの影響範囲・CVSS・別名・撤回は不変。ただし個別照合したoauthlib PKCE（CVE-2026-49265）は、開発元が修正境界3.3.2、固定DBが4.0.0と異なる。開発元の範囲を表示する個別編集を追加し、DB原文とconflictを保持。別のJSONP脆弱性の修正情報と統合しない
- .NET4件（CVE-2026-69651・70197・70186・88092）では、開発元が列挙するWindows ARMのNuGet行が固定DBにない。個別編集で全パッケージ・系列を保持し、DB原文との差を保存。`<=`の終端を次版に推定変換せず、修正境界を最新安全版と表現しない

OSVの7エクスポートは新規に全本文283,708件（283,302ソースID）を取得し、全JSONのCRCと正規化内容ハッシュを検証。保持していた前回283,650件も保存済みのサイズ・SHA-256と照合して全読込した。差分は非MAL追加43・変更33・削除0、MAL追加15・変更6・削除0。エクスポート間の同一IDの内容差は0件。前回成功した各エコシステムの内容確認時刻−24時間を含む公表・更新窓に加え、全本文比較で後日訂正も確認した。

- 非MAL追加43ソースのうち40件は上記Reviewedに一致。kuva（RUSTSEC-2026-0345／GHSA-3c48-9r95-hqhr）は開発元のアドバイザリ・修正コミット・リリースを確認して追加。影響範囲>=0.1.5,<0.3.1と>=0.4.0,<0.4.1を分け、Highは開発元の明示ラベル、数値CVSSは不明のまま
- ruzstd（RUSTSEC-2026-0344）はRustSec・OSV・修正コミットで確認できたが、取得できたソースにGHSA/CVE別名がなく、現行の主ID契約を満たさないため候補として保持。修正境界0.9.1を記録するが架空のIDを作らない。ammonia（RUSTSEC-2021-0158）は公表日が2021年のため期間外
- OSVだけのBIT/CVE別名追加を同一性グラフと監査に保存し、固定DBにない別名を固定JSON由来として装わない。PYSEC-2021-108のGIT導入コミット・列挙版訂正は期間外。PYSEC-2026-2946の列挙版1.7.12追加は、既存の修正境界4.5.128を変更しない。各原文の差を保持し、GIT範囲を単純な版境界へ変換しない
- 未収録の非MAL候補は1,001ソース記録（撤回73件を含む）。これは独立した新規・有効な脆弱性数ではない。未保守通知・MAL・歴史的な期間外情報を通常の新規脆弱性と混同しない

MyJVNは前回成功確認−24時間を含む10月12〜14日JSTの変更日窓を3ページ（50・50・37）取得し、137製品/CPE記録を確認。先頭ページの再読でも総数・ID・内容が一致した。ライブラリ候補のうち、Apache公式資料とCNA原文でlog4net6件、IBMのCNA原文とPyPIでLangflow1件、開発元アドバイザリでBackstage1件を確認し追加した。log4netの影響下限1.2.9／1.2.11／1.2.12、修正境界3.5.0を分離。Langflowは1.0.0〜1.12.2と修正1.12.3で、IBMサポートHTMLの「Site Unavailable」は成功確認と扱わない。Backstageは開発元のCVSS3.1 5.3とJVN概要のCVSS3.0 6.5の差を明記した。vLLM候補は開発元の再現結果が一致せず修正版未確認のため保留。製品/CPEの全件数からライブラリの欠落数を計算しない。

JVN/JPCERTの3フィードは2件の新しい告知URL（AssetView・Thelia）を含む。原文では7対象エコシステムのライブラリとして確認できないため追加しない。Elasticの8件はサーバー製品の告知であり、同名クライアントライブラリの影響へ推定対応させない。以前の241製品/CPE行と19候補は履歴として保持する。

最終表示は18,931件（対象Reviewed18,891＋固定範囲外の個別確認40）、撤回849件、未撤回18,082件。前回より49件増加したが、うち9件は過去公表分の補助ソース追加であり、当日の新規公表49件ではない。個別確認は103記録（重ね合わせ63、範囲外40）。既存89記録は変更せず保持した。

CISA KEV公式JSONへの1回の通常GETは今回も403。未知の状態と成功checkpointを維持し、関連する注意喚起やPoCから実悪用・KEV該当を推定しない。詳細な取得状況・原文・未解決候補は[10月14日の補助ソース監査](data/supplemental-source-status-2026-10-14.json)、[個別判定](data/supplemental-candidate-review-2026-10-14.json)、[Reviewed差分](data/github-reviewed-delta-2026-10-14.json)を参照。

## 2026-10-13の更新記録

GitHub Advisory Databaseの固定コミットを `6a254e681c55741e314a3b40977185df6090ea19`（2026-10-12T18:38:40Z）へ更新。前回の成功確認HEAD以降の全441変更ファイルを比較し、Reviewedは既存3件、unreviewedは438件。以前の収録固定コミットからは全667変更（Reviewed3、unreviewed664）。Reviewed全36,780件を既存インポーターで再走査し、対象18,851件を全件収録した。変換失敗・削除・新規Reviewedは0件。

- ImageSharp（CVE-2026-106117）：3.x系列の修正境界3.2.0と4.x系列の4.1.1を分離。開発元の公開APIと3.2.0リリースを確認し、NuGet名は `SixLabors.ImageSharp` を採用。DBの `ImageSharp` との差は原記録・conflictに保存
- Handlebars（CVE-2026-106445）：影響下限を4.0.0から3.0.0に更新。修正境界4.7.10は不変。開発元APIも照合
- Django（CVE-2026-15830）：参照リンクと更新日時の追加。影響範囲は不変
- 3件の別名・CVSS・撤回状態に変更なし。開発元APIの日時とDB日時を混同しない

OSVは7エクスポートの新しい全本文283,650件（283,244ソースID）をCRC検証。前回の全本文283,595件を固定generationで回収し、保存済みのサイズとSHA-256を照合した上で、正規化JSON全文を比較した。本文変更はnpm・PyPI・crates.io・NuGet、RubyGems・Go・Mavenは全文同一。エクスポート間の同一IDの内容差は0件。

- 非MALは追加11・変更161・削除0。変更161件のうち3件が上記Reviewed、RustSec158件は参照・スキーマ・relatedなどの変更で、影響範囲・CVSS・別名・撤回フィールドの変更なし
- MALは追加44・変更84・削除0。悪性パッケージ報告は通常のライブラリ脆弱性に混入させない
- 新規RustSec11ソースのうち9件を、RustSec公式資料・OSV API・開発元リポジトリの公開アドバイザリAPIで個別照合し追加。mykey2件、IronCrypto1件、quinn-proto6件。IronCryptoは開発元が列挙する関連6パッケージを保持し、ic-hpkeの下限0.2.11と他5件の0.2.5を分離
- 残る2件は、OSV公表日が2021年で期間外の `RUSTSEC-2021-0157` と、未保守通知 `RUSTSEC-2024-0449`。後者を通常の実装上の脆弱性に読み替えない
- 9件のグローバルGHSA APIは404、開発元リポジトリのAPIはすべて200・published・撤回なし。グローバルAPIにない原因やReviewed収録済みとは推定しない
- quinn-protoの範囲には出典差を明記。特に `RUSTSEC-2026-0340` は開発元の構造化欄 `=0.11.13` に対しRustSecは `>=0.11.0, <0.11.18`。RustSecの原範囲を保持し、開発元が全範囲を検証済みとはしない
- RustSecのIssued日は10月12日。OSV publishedは以前のReported日を反映し、開発元の初回公開日時も別に保持。今回9件の収録追加を「今日初めて公開された9件」とはしない

最終表示は18,882件（対象Reviewed18,851＋範囲外の個別確認31）、撤回849件、未撤回18,033件。個別確認89記録（重ね合わせ58、範囲外31）。未収録の非MAL候補は1,000ソース記録（撤回73件を含む）で、前回999件に未保守通知1件が加わった。これは新規・有効・独立した脆弱性数ではない。過去のPYSEC-2025-102とReviewedのパッケージ・版の相違も保持する。

MyJVNは前回成功確認−24時間を含む10月11〜13日JSTの変更日窓を全ページ取得し0件、先頭ページ再読でも一致。既存241製品/CPE行と19候補は履歴として保持し、今回の個別再確認とはしない。JVN/JPCERTの3フィード（73項目）と2告知は前回本文と同一。CISA KEVは公式JSONへの1回の通常GETが403となったため、未知の状態と成功時刻を維持した。

## 2026-10-12の更新記録

[10月12日の補助ソース監査](data/supplemental-source-status-2026-10-12.json)。この時点では固定Reviewedデータは10月11日確認分を保持。


2026-10-12（JST）にOSVの7エクスポート283,595件を全読込・CRC検証し、前回283,549件と全文の正規化JSONを比較。通常の脆弱性情報は追加・変更・削除0件。変更67ソースIDはMALのみ（追加46、変更21）で通常の脆弱性として取り込まない。未収録候補999件（撤回73件）は保持。MyJVNの前回成功時刻−24時間に基づく10月10〜12日JSTの変更日窓は0件で、再読でも一致。以前の241製品/CPEレコードは履歴として保持。JVN/JPCERTの3フィードと2告知は保存済み本文と同一。CISA KEVは1回の取得が403となり、未知の状態と成功時刻を維持した。

GitHub Advisory Databaseは2026-10-11T21:37:10Zの`1a82fa36dc17212972ccb4a5ed7d564c9c377e4f`まで照合し、固定コミット以降の変更227ファイルはすべてunreviewed。Reviewed本文の差分がないため、再現可能な固定コミット・元の確認日時を維持する。

## 2026-10-11の更新記録

確認：2026-10-11（JST）。[今回の更新監査](data/publication-update-2026-10-11.json)と[補助ソース取得状況](data/supplemental-source-status-2026-10-11.json)を参照。以前の更新記録と以下の初回照合は当時の履歴として保持する。

主ソースはコミット `2a957af1aac1c931d1e50224421d1549e6da4ae9`（2026-10-11T00:35:13Z）。全36,780件のReviewedを読み、対象18,851件と固定範囲外の個別確認22件を合わせ18,873件、撤回履歴849件、未撤回18,024件。前回公開から74件増え、16件は過去公表の撤回済み履歴、有効な追加は58件。既存5件は別名・参照等の更新。既に確認したf9cc010・bf7e586からReviewed JSONの内容は変わっていない。新しい確認日時やスナップショットを新規脆弱性数にはしない。

個別確認79記録（固定範囲への重ね合わせ57、範囲外22）を保持。Langflowの参照・更新日時の差は既存のconflictとして残す。DBの全件照合を全開発元資料の個別再確認とは表現しない。

OSVの7エクスポートは新しい全本文を取得し、283,549件をCRC検証。旧版も固定generationと保持済みSHA-256の一致で回収し、283,529件の前回と全内容比較した。非MALは追加14・変更10、MALは追加6、削除0。変更24 IDのうち17件はReviewed、別の2件は個別確認済みに一致。残る5件は既存Go候補の関連参照・更新日時のみの変更。新しい補助ソース収録提案は0件で、候補999件（撤回73件含む）は独立した有効脆弱性数ではない。

PYSEC-2025-102のdagster-geの明示版0.29.26追加と、Reviewedのdagster／修正版1.10.16との差は原文・監査に保存し、パッケージや範囲を自動的に上書きしない。

MyJVNは5ページ・241製品/CPEレコードを取得し、保存済みの比較可能フィールドに新規・変更なし。以前の完全な本文がないため全項目不変とは主張しない。JVN/JPCERTのフィード・選定告知も再取得してハッシュを照合。全JVNのライブラリ網羅を意味しない。

CISA KEV公式JSONは今回もHTTP403のため、未知の状態と成功checkpointを維持した。関連情報やPoCだけから実悪用、被害企業、特定CVEとの関連を推定しない。

## 2026-10-08初回照合の記録

確認日：2026-10-08（UTC）。「全世界の脆弱性を網羅」とは表現しない。ソース、日時、対象エコシステム、除外理由を固定した検証結果を示す。

## 収録範囲と追加分

主対象は [GitHub Advisory Database](https://github.com/github/advisory-database/tree/ccd4868bd8cfbed178f5ada1194b4fe30674c25b/advisories/github-reviewed) の固定コミット `ccd4868bd8cfbed178f5ada1194b4fe30674c25b`（コミット日時 `2026-10-08T00:36:29Z`）。

- `github-reviewed` 全36,576レコードを列挙し、`published` が `2022-11-01T00:00:00Z` 以上 `2026-10-08T00:36:29Z` 以下、npm / PyPI / RubyGems / Go / crates.io / Maven / NuGet のいずれかを含む18,657件が対象
- 撤回済み810件も履歴として保持。日付範囲前13,864件、対象外エコシステム4,055件を除外
- 既存の個別確認50件は重複統合する。別途、固定コミットに存在しないBunの2件を公式APIと開発元資料で確認し追加したため、合計は18,659件（固定範囲18,657＋範囲外の個別追加2）
- この数は固定リポジトリの対象範囲＋明記した追加分である。GitHubの現行API全体についても全件取得した、という意味ではない

## OSV：7エコシステムの全エクスポートを照合

[OSV公式データ配布仕様](https://google.github.io/osv.dev/data/#data-dumps) に従い、7種類の `all.zip` を全件読んだ。サンプルや任意の件数上限は使っていない。ZIP合計は287,338,881バイト。各ファイルのSHA-256を照合し、ZIP内の全JSONをCRC検証付きで読んだ。

[OSVスキーマ](https://ossf.github.io/osv-schema/#aliases-field) の `id` / `aliases` だけで対称・推移的に同一性を判定する。`related` / `upstream` やパッケージ名の一致を同一脆弱性と見なさない。パッケージのバージョン該当判定やユーザーの依存関係スキャンは実行していない。

OSVの比較窓は `2022-11-01T00:00:00Z`〜`2026-10-08T02:00:00Z`。主データのコミット時刻（00:36:29）とは区別する。固定リポジトリの最終公表は前日であり、この上限差で対象Reviewedの18,657件の集合は変わらない。エクスポート自体の取得・最終更新時刻も下表に別記する。

### 実測結果（固定リポジトリへの照合）

| エコシステム | ZIP内全レコード | 日付範囲内 | 対象Reviewedに一致 | 範囲外Reviewedに一致 | Reviewedに別名一致なし |
|---|---:|---:|---:|---:|---:|
| npm | 230,127 | 219,972 | 4,978 | 0 | 214,994 |
| PyPI | 26,126 | 21,328 | 8,424 | 705 | 12,199 |
| RubyGems | 5,438 | 4,747 | 467 | 0 | 4,280 |
| Go | 9,528 | 8,401 | 7,736 | 451 | 214 |
| crates.io | 2,896 | 1,864 | 1,448 | 0 | 416 |
| Maven | 7,179 | 3,361 | 3,359 | 0 | 2 |
| NuGet | 1,922 | 1,438 | 656 | 0 | 782 |

エコシステム別の行には複数エコシステムにまたがる同一IDが重複する。全体は次の集合で数える。

- ZIP内総数283,216件、同じIDの重複406件を除いた282,810件。エクスポート間で同一IDの内容差は0件
- 日付範囲内260,875件（撤回済み1,268件を含む）。範囲前21,935件を除外。公開日欠損・範囲後・対象エコシステムなしによる除外は今回0件
- 対象Reviewedに一致26,832件、古い公開日など対象範囲外のReviewedに一致1,156件、Reviewedに別名一致なし232,887件
- 対象Reviewed18,657件のうち、7エクスポートのいずれにも別名一致がないものは0件
- 一致しない232,887ソースレコードは別名でまとめると232,651グループ。ただし別名欠落や誤記があると結果は変わるため、独立した脆弱性数とは断定しない

### 一致しないレコードの扱い

| 接頭辞 | レコード数 | 扱い |
|---|---:|---|
| MAL | 231,886 | 悪意あるパッケージの報告。通常のライブラリ実装の脆弱性とは範囲が異なるため、一括取り込みしない |
| PYSEC | 401 | 個別確認候補。46件はOSV上で撤回済み |
| RUSTSEC | 392 | 個別確認候補。`affected[].database_specific.informational` 等に unmaintained 184件、unsound 57件、notice 2件、指定なし149件。未保守通知を自動的に脆弱性へ変換しない |
| GO | 194 | 個別確認候補。10件はOSV上で撤回済み |
| OSV | 7 | OSS-Fuzz由来の個別確認候補。1件は撤回済み |
| GHSA | 7 | 下記で公式APIを追加確認。2件を追加、5件は404のため保留 |

MAL以外の1,001件は確認候補であり、1,001件の新規・有効な脆弱性があるという意味ではない。この集合にはOSV上で撤回済み73件も含む。同じ別名グループ内の重複やMALとの別名一致もある。2件のBun以外は自動収録していない。追加2件を除く残り999ソースレコードは引き続き未収録候補であり、重複排除済みの新規脆弱性数ではない。

### 7件のGHSA差分を検証

7IDとも固定コミットの全リポジトリツリーに存在しないことを確認した。以下は後続の公式API確認であり、ZIP取得時点や固定コミットと同時点のスナップショットではない。

| ID | 公式APIの応答 | 判定 | checkedAt（UTC） |
|---|---|---|---|
| [GHSA-4j66-8f4r-3pjx](https://api.github.com/advisories/GHSA-4j66-8f4r-3pjx) | HTTP 200 | reviewed、撤回済み。撤回日時を優先して履歴として追加 | 2026-10-08T02:34:56Z |
| [GHSA-v9mx-4pqq-h232](https://api.github.com/advisories/GHSA-v9mx-4pqq-h232) | HTTP 200 | reviewed、有効。個別確認して追加 | 2026-10-08T02:34:56Z |
| [GHSA-3wxx-jxwc-mg39](https://api.github.com/advisories/GHSA-3wxx-jxwc-mg39) | HTTP 404 | Not Found。非公開化・削除などの原因は未確定のため保留 | 2026-10-08T02:34:56Z |
| [GHSA-j79x-vvgm-w73w](https://api.github.com/advisories/GHSA-j79x-vvgm-w73w) | HTTP 404 | Not Found。非公開化・削除などの原因は未確定のため保留 | 2026-10-08T02:34:56Z |
| [GHSA-j859-pmrq-9q6c](https://api.github.com/advisories/GHSA-j859-pmrq-9q6c) | HTTP 404 | Not Found。非公開化・削除などの原因は未確定のため保留 | 2026-10-08T02:35:05Z |
| [GHSA-pj34-fpw3-83qj](https://api.github.com/advisories/GHSA-pj34-fpw3-83qj) | HTTP 404 | Not Found。非公開化・削除などの原因は未確定のため保留 | 2026-10-08T02:35:05Z |
| [GHSA-qf87-q4gg-cg43](https://api.github.com/advisories/GHSA-qf87-q4gg-cg43) | HTTP 404 | Not Found。非公開化・削除などの原因は未確定のため保留 | 2026-10-08T02:35:05Z |

`GHSA-4j66-8f4r-3pjx`（CVE-2025-8022）はAPI上で `2025-08-11T21:15:20Z` に撤回済み。取得したOSV ZIPには撤回日時がなく、単純なエクスポート採用では古い状態になる。理由はBun自体の脆弱性を示す内容ではなく、呼び出すアプリケーションの引数検証に依存するため。[Bun公式Shell資料](https://bun.com/docs/runtime/shell#security-in-the-bun-shell) も実際に確認した。表示では撤回を明記し、残存する影響範囲・CVSSは過去の評価として保持する。

`GHSA-v9mx-4pqq-h232`（CVE-2024-21548）はAPI上で有効。APIの修正版は1.1.30。[開発元の実装変更](https://github.com/oven-sh/bun/commit/a234e067a5dc7837602df3fb5489e826920cc65a) を確認した。APIのseverityはmediumだが、CVSS v3.1は7.5、v4.0は6.8のため、その違いも保持した。

固定リポジトリに存在しない理由は2件とも未確定。固定コミットより後に新規公開されたものではなく、どちらもAPIの最終更新は2025年である。5件の404も削除理由を推測しない。

#### API応答の保存とハッシュ

追加した2件は取得したJSONのバイト列を加工せず保存した。`src/data/vulnerabilities/` のレコードはAPI出典と確認日時を持つ個別確認データであり、固定Gitコミット由来の検証済みレコードを装う `sourceSnapshot` は付けていない。

| 保存ファイル | checkedAt（UTC） | SHA-256 |
|---|---|---|
| [GHSA-4j66-8f4r-3pjx.github-api.json](advisory-source-snapshots/GHSA-4j66-8f4r-3pjx.github-api.json) | 2026-10-08T02:34:56Z | `dedc1152d5dc46fb8dde400bf29e52aa0afe83125550f6729a1e18b5bffe788c` |
| [GHSA-v9mx-4pqq-h232.github-api.json](advisory-source-snapshots/GHSA-v9mx-4pqq-h232.github-api.json) | 2026-10-08T02:34:56Z | `82b64cee16b01509f39182849ac8b339bc5528dbdd9749d2af020bdc383e0b27` |

5件の404応答のSHA-256はいずれも `2218b50c8a811e2f609d256cc18fa9a5c1ecabca78a58f10ea7977e8a8392684`。API照合スクリプトは応答本体と照合時刻をローカルのレポートキャッシュへ保存する。

## OSV取得物の識別情報

エクスポートはエコシステムごとに更新時刻が異なる。以下の `downloadedAt` を取得時の `checkedAt` として扱い、源泉の `Last-Modified` と区別する。ETag・generationが取得できたものは版識別情報として記録した。同じURLの将来の内容は変わりうる。 generationの追補確認は `2026-10-08T02:39:02Z`～`2026-10-08T02:39:12Z` のHEADリクエストで行い、取得済みファイルのETag・サイズと一致する場合だけ関連付けた。

### osv-npm.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/npm/all.zip](https://storage.googleapis.com/osv-vulnerabilities/npm/all.zip)
- bytes: 217,952,812
- downloadedAt / checkedAt: `2026-10-08T02:30:34Z`
- Last-Modified: `Thu, 08 Oct 2026 01:02:47 GMT`
- ETag: `"18bfba69ced1b44b114f9f2756427369"`
- generation: `1791421367089391`
- SHA-256: `0cd4ad25f0b24f40e1d37239c6e44da90a5581fd84ffada49b1493cb4f00b774`

### osv-PyPI.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/PyPI/all.zip](https://storage.googleapis.com/osv-vulnerabilities/PyPI/all.zip)
- bytes: 35,674,361
- downloadedAt / checkedAt: `2026-10-08T02:30:30Z`
- Last-Modified: `Wed, 07 Oct 2026 21:02:57 GMT`
- ETag: `"0eee11c4ae407a16a8d0a9d6e58953d2"`
- generation: `1791406977772672`
- SHA-256: `a65212018b6bd4544bf4ae2c2f04254157575bc12c74f4aa02dc51738c036738`

### osv-RubyGems.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/RubyGems/all.zip](https://storage.googleapis.com/osv-vulnerabilities/RubyGems/all.zip)
- bytes: 5,143,941
- downloadedAt / checkedAt: `2026-10-08T02:30:29Z`
- Last-Modified: `Tue, 06 Oct 2026 20:17:50 GMT`
- ETag: `"6b43aefd99449eb3304c4f01306ede08"`
- generation: `1791317870658794`
- SHA-256: `a5af8080bbb0884fdf20ef44eb1b57830d33b568f18d152df0f329f16516f169`

### osv-Go.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/Go/all.zip](https://storage.googleapis.com/osv-vulnerabilities/Go/all.zip)
- bytes: 12,095,190
- downloadedAt / checkedAt: `2026-10-08T02:30:35Z`
- Last-Modified: `Wed, 07 Oct 2026 20:33:08 GMT`
- ETag: `"dfec75f290bcde8e277935f44f9be5f3"`
- generation: `1791405188584764`
- SHA-256: `c9c95eb5fabca91c445246fba401a28c13ce6409b845439b7091dde0159b86f8`

### osv-crates.io.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/crates.io/all.zip](https://storage.googleapis.com/osv-vulnerabilities/crates.io/all.zip)
- bytes: 3,552,048
- downloadedAt / checkedAt: `2026-10-08T02:30:35Z`
- Last-Modified: `Wed, 07 Oct 2026 14:47:45 GMT`
- ETag: `"2ac3243c52cede93dd2129cfae371f09"`
- generation: `1791384465457120`
- SHA-256: `0f4a8099c9ab549a05a96727a5bba50722d646450224d90b984bba72e85255c1`

### osv-Maven.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/Maven/all.zip](https://storage.googleapis.com/osv-vulnerabilities/Maven/all.zip)
- bytes: 10,379,428
- downloadedAt / checkedAt: `2026-10-08T02:30:35Z`
- Last-Modified: `Wed, 07 Oct 2026 21:02:57 GMT`
- ETag: `"c9cf336de39160ff6003b681fa786c8d"`
- generation: `1791406977314603`
- SHA-256: `2f98fbd706669130ca4a68ac3ab0f9c8144bbd48075788508e6439b3d3785b02`

### osv-NuGet.zip

- URL: [https://storage.googleapis.com/osv-vulnerabilities/NuGet/all.zip](https://storage.googleapis.com/osv-vulnerabilities/NuGet/all.zip)
- bytes: 2,541,101
- downloadedAt / checkedAt: `2026-10-08T02:30:42Z`
- Last-Modified: `Wed, 07 Oct 2026 20:33:08 GMT`
- ETag: `"6209d6c5047d55ebd13d513d96a55057"`
- generation: `1791405188500350`
- SHA-256: `b590e301e245c9920a9f696fa91039d685ddbb788f4c27475adcd53372490b35`

### OSVの限界

この検査で保証できるのは上記の保存済み7 ZIPを漏れなく読んだことまで。全OSVデータベースの同一時刻のスナップショットではない。対象外エコシステム、エコシステムを持たないレコード（撤回等で `[EMPTY]` にあるもの）、後から追加・修正されるものはこの分母に入らない。公開日は各ソースの登録日で、開発元の最初の公表日とは限らない。別名一致だけでは影響範囲・修正範囲・撤回状態が一致するとは限らない。

## JVN / JVN iPedia：分母の取得まで

[MyJVN API](https://jvndb.jvn.jp/apis/getVulnOverviewList_api_hnd.html) は製品/CPE中心の情報で、npm等の7パッケージエコシステムへ直接限定する条件はない。JVN iPediaはJVNに加え、国内外の脆弱性情報を収集するデータベースである（[公式説明](https://jvndb.jvn.jp/nav/jvndb.html)）。

実行したクエリは `getVulnOverviewList` / `feed=hnd`、発行日2022-11-01～2026-10-08。見つけた日・更新日によるデフォルトの週次制限を避けるため `rangeDatePublic=n`、`rangeDatePublished=n`、`rangeDateFirstPublished=n` を明示した。

- 応答生成日時：`2026-10-08T11:30:33+09:00`（`2026-10-08T02:30:33Z`）
- `retCd=0`、`totalRes=155174`、`totalResRet=1`、`firstRes=1`
- 応答SHA-256：`1896cc9fb9fb61bbc2a2345ab3a0d7dd854e32451657cbf22ad1f39a0619e9e5`
- 155,174件は全製品の検索分母。取得したのは分母確認用の1レコードだけであり、全件取得・GitHubとの全件比較・ライブラリ判定は未実施
- APIは1回最大50件。全件ページングなら3,104ページとなり、更新中の取りこぼし・重複も検証する必要がある
- APIの日付条件はサービス側の暦日で、GitHub/OSVの正確なUTC日時範囲とは同一ではない

[公式フィード一覧](https://jvndb.jvn.jp/ja/feed/) と [チェックサム一覧](https://jvndb.jvn.jp/ja/feed/checksum.txt) も確認した。2022～2026年の概要RDFだけで287,407,187バイト（最終更新2026-10-04）。年別ファイルをすべて読めば、CVE等との全件比較は可能だが、各年の区分とUTC公開日条件を同一視してはならない。新着・更新フィードで後続更新を補完し、スナップショット差も記録する必要がある。今回このRDF本体はダウンロードしていない。

未実施の理由は容量不足やAPI障害ではなく、CPE製品情報から対象パッケージを根拠付きで判別する作業が残るため。155,174件からGitHub件数を引いて「未収録ライブラリ数」とすることはできない。公式仕様ページの取得には成功、RDF本体のweb表示は `Unsupported content-type: application/rdf+xml` だったが、フィードの配布不能を意味しない。

## 再実行

`scripts/advisory-supplemental-coverage.mjs` はNode.js、Python 3標準ライブラリ、gitだけを使う読み取り専用の検査。アプリに候補データを自動投入しない。

```sh
node scripts/advisory-supplemental-coverage.mjs \
  --github-snapshot /path/to/pinned-advisory-database \
  --cache /path/to/retained-export-cache \
  --from 2022-11-01T00:00:00Z \
  --through 2026-10-08T02:00:00Z \
  --output /path/to/coverage.json
```

初めて取得する場合は `--download`、OSVだけにあるGHSA IDを現行GitHub APIで検証する場合は `--verify-github` を付ける。再取得は新しい観測なので、以前のレポート/キャッシュを別途残す。単に最新URLへ再アクセスしても、この報告と同じバイト列が得られる保証はない。

レポートは全候補ID・除外集計・エコシステム別件数・ソースハッシュ・API検証結果を保存する。巨大な候補一覧はブラウザのデータやビルド成果物に含めず、この文書には集計と重要な差分のみ掲載する。今回の検査ではコード・依存情報・認証情報を外部へ送信せず、脆弱性スキャンやライブラリ更新も行っていない。

## 検証結果

- 全7 ZIPの再解析、正規化JSONの全内容比較、件数の保存則チェックに成功
- SHA-256を改変したキャッシュではエラーとなり、部分レポートを生成しないことを確認
- 小さいHTTP応答でも書き込み完了後のサイズ・ハッシュ・generationが保存されることを確認
- 追加2件のAPI応答ハッシュ、日時、撤回、影響範囲、修正版、severity、CVSSが個別確認JSONと一致
- 個別確認データ52件のバリデーションに成功。アプリ全体のビルド・UI検証は統合後の検証結果を参照


### 2026-10-24 の識別子追補

Wasmtime GHSA-897f-g5gm-fmxmにCVE-2026-115889を明示された別名として追加した。開発元GHSA・CNA・公開OSVで同一性を確認し、既存の公表日・影響範囲は保持。固定Reviewed snapshotと成功取得点は変更せず、件数は19,376件のまま。[確認記録](data/bind-wasmtime-gap-review-2026-10-24.json)
