# ライブラリの脆弱性：収録・更新契約

企業のサイバーインシデントとは別のカテゴリー。公開ライブラリの脆弱性が発表されただけでは、企業の被害や実悪用の証拠にしない。既存の `incidents` と件数・影響分類を混ぜない。

## 対象と出典

- 初期対象は npm / PyPI（GitHub API の ecosystem 表記は `npm` / `pip`）の公開ライブラリ。開発元資料を確認できる重要な公開、修正、影響範囲の変更、撤回を選定する。全件網羅や「すべての最新脆弱性」を保証しない
- 初期5件は2026年のAxios、urllib3（2件）、Werkzeug、Vite/vite-plusの公式アドバイザリ。収録時点は各ファイルの `lastVerifiedAt`
- GitHub Reviewed Advisory Database / OSV を発見・構造化の入口にできるが、開発元のアドバイザリ、公式リリース、影響範囲の一次資料まで確認する
- 脆弱性スキャナーは実行しない。ユーザーの依存関係、ソースコード、非公開資料を送信しない。ライブラリや依存関係を更新しない
- 公開API仕様を参考にした独立実装。非公開プロジェクトのコード・データ・説明文は含めない

## 保存先と識別子

`src/data/vulnerabilities/<ID>.json` が正本。公開日の収録範囲は `src/data/vulnerability-meta.json` の `windowStart` / `windowEnd`。範囲外の新規公開日を追加する場合はこの2日付も更新する（企業事案のmetadataは変更不要）。共有描画エンジンは両カテゴリの範囲を包含し、検証は窓の更新漏れを検出する。型は `src/vulnerabilityTypes.ts`、検証は `scripts/vulnerability-status.mjs`。ファイル名は大文字の GHSA/CVE ID と一致させる。

- `kind` は `vulnerability` 固定
- `id` は安定した GHSA または CVE。初期データはGHSAを採用
- `aliases` は同一脆弱性のCVE/GHSA別名だけ。`id` 自身は重複して入れない。追加前に全ファイルの `[id, ...aliases]` と照合する。複数レコードに交差した場合は既存レコードへ統合する必要があり、そのまま新規追加しない
- OSV `related` / `upstream` は同一性を保証しないので別名として統合しない。続報を別イベントに水増ししない。撤回記録も消さない

## JSON フィールド

- `title`, `summary`: 日本語の短い事実記述。攻撃成立の前提や対象プラットフォームを残す
- `publishedAt`, `modifiedAt`, `withdrawnAt`: 収録元データベースの公開・最終更新・撤回のUTC ISO 8601日時。撤回なしは `null`。タイムラインは `publishedAt` のUTC日付。開発元の最初の公表日とは限らない
- `dateSourceUrl`: この3日時の根拠となる公開API/資料。必ず `sources` に含める
- `lastVerifiedAt`: 実際に資料を確認したUTC日時。公表・更新・撤回日時と混同しない。確認だけで `modifiedAt` を進めない
- `affected[]`: `ecosystem`, `packageName`, `ranges[]`。各rangeは `affected`（出典の影響範囲表記）、`fixed`（その範囲に対応する修正版、または `null`）、`sourceUrl`。同一パッケージの複数系列を同じ配列に保持する。別パッケージも潰さない。出典間で違いがあれば出典と留保を明記する
- `severity`: `label`（`critical` / `high` / `medium` / `low` / `unknown`）、`sourceUrl`（未評価なら `null`）、`cvss[]`。CVSS要素は `version`, `score`, `vector`, `sourceUrl`。スコア・ベクトルの一方は `null` 可。公表元の値だけを保存し、推計・再計算しない。APIのnull vector + 0.0プレースホルダーは未評価であり0点と扱わない
- `exploitation`: `status` は `unknown` / `reported`。`reported` には具体的な実悪用の根拠 `sourceUrl` が必要。PoCの公開だけでは実悪用としない
- `kev`: `status` は `unknown` / `listed` / `notListed`。確認済みならCISA公式資料の `sourceUrl` と `checkedAt` が必要。未照合なら両方 `null`。未掲載は実悪用なしの証明ではない。取得失敗時は前回の確認結果を勝手に更新しない
- `sources[]`: `type`（`maintainer` / `advisoryDatabase` / `release` / `kev` / `exploitation`）、`title`, HTTPS `url`, `publishedDate`（日付または `null`）。最低1件の開発元出典が必要。提供されている場合は出典固有の `publishedAt`, `modifiedAt`, `withdrawnAt` も保持する
- `caveats[]`: 前提条件、情報源の差異、不明な範囲。推測で埋めない

OSVを利用する場合、`fixed` はその版を影響範囲から除外する境界、`last_affected` はその版を含む境界。`limit` は修正版の根拠ではない。異なるエコシステムの版比較を独自の文字列比較で行わない。本アプリは版の該当判定を行わず、根拠付き範囲を表示する。

## 更新手順と品質

1. 最新main・この契約・既存ID/別名を読む。公式資料を取得できなければ記録を捏造せず、未確認候補として報告する
2. 新規/更新/撤回を判別。既存の同一脆弱性を更新し、出典ごとの日時・影響範囲・修正版・留保を保存する
3. `pnpm check` で両カテゴリを検証。初回UI変更は `pnpm quality` / `pnpm test:ui` / `pnpm perf` も確認する
4. レビュー可能な差分を作る。公開・マージ権限は依頼範囲に従う。PRだけではmainへ公開されない

SQLは `vulnerabilities` を独立テーブルとして提供する。既存の `incidents` / `events` / `threads` の意味は維持する。

参考：[OSV schema](https://ossf.github.io/osv-schema/)、[OSV data](https://google.github.io/osv.dev/data/)、[GitHub global advisory API](https://docs.github.com/en/rest/security-advisories/global-advisories)
