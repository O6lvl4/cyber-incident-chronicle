# ライブラリの脆弱性：収録・更新契約

企業のサイバーインシデントとは独立したカテゴリー。脆弱性の公開だけで、企業の被害や実悪用を推定しない。企業事案と件数・影響分類を合算しない。

## 網羅性の境界

選定した数十件だけの収録から、**指定した公開データソース・期間・エコシステム内の全件収録**へ移行する。世界中のすべての脆弱性を網羅した、という意味ではない。

- 主ソースはGitHub Advisory Databaseの `advisories/github-reviewed`。公式リポジトリの特定コミットを固定し、全JSONファイルを走査する。APIの先頭ページだけで終了しない
- 公開日時が2022-11-01T00:00:00Z以上、固定スナップショットのコミット日時以下のレコードを対象とする。更新日で代用しない
- npm / PyPI / RubyGems / Go / crates.io（Rust）/ Maven / NuGetのいずれかを影響パッケージに含むアドバイザリが対象。選定された同一アドバイザリの他エコシステムのパッケージ関係も捨てない
- 深刻度、CVSSの有無、撤回、人気、英語表記を理由に除外しない。撤回済みも履歴として保存し、未撤回の件数と明確に分ける
- 期間外・対象エコシステム外・取得/変換失敗・重複集約を別々に集計する。失敗を対象外として隠さない
- `src/data/vulnerability-coverage.json` が実際の固定コミット、厳密な期間、取得・収録・除外・失敗の件数とハッシュを保持する。件数の分母は「対象アドバイザリ」、重複統合後の表示記録数とは区別する
- OSVの各エコシステム全件エクスポートと別名を比較し、GitHub Reviewed以外の候補を別集計する。悪性パッケージ報告と通常の脆弱性アドバイザリを混同しない。JVNは製品/CPE中心であり、その全件数をライブラリの未収録件数にはしない

公開情報だけを取得する。スキャナーは実行せず、ユーザーの依存関係・ソースコード・非公開資料を送信しない。依存ライブラリや認証・収集スケジュールは変更しない。

## 保存先・再現性

- `src/data/vulnerabilities/<ID>.json`: 従来の50件と、固定ソースに存在しないAPI確認済みBunの2件を含む計52件の個別編集記録。手作業の日本語要約と資料上の訂正を保持する
- `src/data/vulnerability-imported.json`: 固定ソース全件を変換・別名統合し、個別確認済み記録を重ねた表示用正本。上記の個別編集記録を追加連結して二重計上しない
- `src/data/vulnerability-coverage.json`: 簡潔な公開カバレッジ・再実行コマンド・出力ハッシュ
- `docs/data/vulnerability-import-audit.json`: ファイル単位の収録/除外/失敗監査。ブラウザーに全量を同梱しない
- `src/data/vulnerability-meta.json`: タイムラインの公表日ウィンドウ。全件データと整合させる
- `src/vulnerabilityTypes.ts`, `scripts/vulnerability-status.mjs`: 構造・出典・日時・別名の検証
- `scripts/vulnerability-coverage.mjs`: 分母と収録ID集合、成果物ハッシュの整合性検証

大容量の表示用JSON・監査JSON・検索索引・詳細シャードはGitに重複保存せず、CIの `pnpm data:prepare` で固定ソースから再生成する。コミット済みmanifestの期待ハッシュや分母と一致しなければ公開を停止する。開発でも同じ手順を使い、確認済みキャッシュだけ再利用する。初回には公開ソースを取得するネットワーク接続が必要。

具体的な固定コミット、再現コマンドと取得手順はカバレッジmanifest内の `source` / `reproduction` を参照。差分更新でも同じ選定規則で全件を再照合し、撤回やソースからの変更を取りこぼさない。未取得候補の説明文や修正版を推測で補わない。

## 確認の深さを分ける

- 個別編集記録では、実際に開発元資料を読んだ出典を `maintainer` として保存する
- 機械収録では `verification.level: database` を設定し、実際に取得した固定コミットの元JSONを引用する。データベースの参考リンクにあるだけで開発元を確認済みとはしない。全件のメンテナーページを人手で再検証したとの表示もしない
- 個別編集を重ねた記録は `mixed`。日本語の説明、開発元根拠に基づく修正範囲・パッケージ名などを保持し、データベース由来の情報と出典を分ける
- 原文のタイトル・要約は英語のまま保存できる。未検証の翻訳を大量生成して事実記述としない
- データベースとの相違や、新しい更新に対して個別編集の確認が追いついていない場合は `provenance.conflicts` に明示。個別訂正を機械的に上書きしない

## 識別子と重複

`kind` は `vulnerability` 固定。主IDは安定したGHSA/CVE。`aliases` は元ソースが同一性を示すCVE/GHSA/OSV等の別名で、主ID自体は入れない。推移的に重なる別名は連結成分として統合する。

OSVの `related` / `upstream` は同一性を保証しないので別名として統合しない。続報を別イベントに水増ししない。元レコードごとのID・別名・日時・撤回・固定ソースURLは `provenance.advisories` に残す。統合記録の公表日は最初、更新日は最後。撤回はすべての元レコードが撤回された場合だけ記録全体の状態にする。

## 日時・パッケージ・版

- `publishedAt`, `modifiedAt`, `withdrawnAt`: 引用したデータベースのUTC日時。開発元の初回公表日時とは区別する。撤回なしはnull
- `dateSourceUrl`: 日時の根拠。必ず `sources` に含める
- `lastVerifiedAt`: 実際に資料/DBレコードを確認したUTC日時。データの最終更新日を確認日で進めない
- `verification.checkedAt`, `sourceSnapshot`: データベース収録の確認日時と固定コミット
- `affected[]`: パッケージごとにecosystem/packageName、影響範囲とそれに対応する修正境界・出典を持つ。複数パッケージや複数系列を平坦化しない
- `rawRanges`, `explicitVersions`, `packageUrl`: OSV原文のイベント、列挙版、purlを必要に応じてそのまま保持。版比較や安全版の推定はしない
- OSVの `fixed` は除外境界、`last_affected` は含む境界。同じrange内で両者を混在させない。変換は導入・終了イベントが交互に並ぶ `ECOSYSTEM` / `SEMVER` の表示用投影に限定し、版比較や順序の推測は行わない。修正版不明はnullのままにする
- `GIT` のコミットグラフ、range全体を制限する `limit`（複数指定・`*` を含む）は、この変換では未対応。遭遇したら全インポートを失敗させ、単純な修正境界に読み替えたり対象外として捨てたりしない。今回の固定対象は全33,988 rangeが `ECOSYSTEM` で、`GIT` / `limit` は0件
- 個別編集との相違は、元DBの `provenance.databaseAffected` と相違理由も保持する

修正版はその脆弱性に対応する最初の修正境界であり、後続の別脆弱性も含めた「現在の最新安全版」を保証しない。アプリはインストール済み版の脆弱性該当判定をしない。

## 評価・実悪用・出典

- severityはcritical/high/medium/low/unknown。公表されたラベル・CVSSスコア/ベクトルのみを保存し、独自計算しない。未評価のnullベクトル+0点プレースホルダーは除く
- exploitationはunknown/reported。reportedには具体的な実悪用報告の出典が必要。重大度やPoC公開だけでは実悪用としない
- kevはunknown/listed/notListed。確認済みにはCISA公式資料とcheckedAtが必要。未掲載は悪用なしの証明ではない。取得失敗で前回結果を勝手に更新しない
- sourcesには資料種別、タイトル、HTTPS URL、公表日、提供される出典固有の日時を保存する
- 未訪問の参照先を確認済み資料として扱わない。機械収録は固定JSONへの直接リンクが必須

2026-10-08の個別50件拡充ではCISA公式カタログがHTTP403で取得できなかったためKEV未確認を維持した。React Server Componentsの実悪用試行はAWSの独立した一次観測報告を引用している。

## 品質・公開

1. 最新main、固定ソース、前回manifest、個別編集記録を読む
2. 選定・除外・重複・失敗の分母と対象IDを確定し、保存済み出力と照合する
3. `pnpm check` で構造、カバレッジ整合、単体テスト、型、production buildを確認
4. `pnpm quality`、全UIテスト、実際の全件データを使った性能予算を通す。件数増加を理由に品質ゲートを弱めない
5. レビュー可能なPRで差分・収録件数・限界を示す。権限に従いマージし、対象コミットのCI/Pagesと公開データを確認する

GitHub Advisory DatabaseのデータはCC-BY-4.0。GitHub Advisory Databaseと各貢献者に帰属する。選定、形式変換、重複統合、個別編集の重ね合わせを行っており、元資料と変更点を保持する。[公式リポジトリ](https://github.com/github/advisory-database)、[ライセンス](https://github.com/github/advisory-database/blob/ccd4868bd8cfbed178f5ada1194b4fe30674c25b/LICENSE.md)。

参考：[OSV schema](https://ossf.github.io/osv-schema/)、[OSV data](https://google.github.io/osv.dev/data/)、[GitHub global advisory API](https://docs.github.com/en/rest/security-advisories/global-advisories)
