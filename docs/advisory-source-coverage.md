# 脆弱性データのソース別カバレッジ検証

最新確認：2026-10-09（JST）。[日次差分・ソース取得状況](data/daily-update-2026-10-09.json)を参照。以下の2026-10-08初回全量照合は当時の履歴として保持する。

最新の主ソースはコミット `4d346ec8cec9ac2b5f8c602880f039a166679001`（2026-10-08T21:38:31Z）。Reviewed対象18,744件と固定範囲外の個別確認6件を合わせ18,750件、撤回履歴825件、未撤回17,925件。前回からReviewed内87件とOSV・開発元で個別確認した4件を追加し、Reviewed追加のうち14件は過去公表の撤回済み記録。追加件数を新規公開された有効な脆弱性数とはしない。開発元3件を追加確認し、AsyncHttpClientのHigh表記とDBのCritical表記の差を記録した。追加4件はAirflow Google／Snowflake provider、Docling／docling-slim、noyalib。OSV由来のID・原データ、開発元との評価差、GHSA全体APIの404を区別して保存する。

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
