# Cyber Incident Chronicle

日本企業・海外子会社のサイバーインシデントを、企業の一次資料からたどるタイムラインです。

**サイト:** https://o6lvl4.github.io/cyber-incident-chronicle/

## 表示と考え方

- **3種類の影響**: 情報流出・可能性 / 業務・サービス影響 / 不正アクセス
- **別軸の確認状況**: 流出を確認 / 流出の可能性 / 流出状況を調査中 / 流出は確認されず
- **1事案をまとめて読む**: 複数の影響がある事案は該当レーンに表示しますが、企業数・事案数は重複しません。続報は同じ事案の詳細に集約します
- **日付を混同しない**: 時間軸は「収録した公表日」。事案の最初の発表日とは限りません。発生・検知、収録した公表、収録した最終公表、資料の最終確認を分けます
- **確定と可能性を分ける**: 件数や人数の単位、最大値、内数、重複や推計などの注意を残します。被害人数の横断合計や深刻度ランキングは作りません
- **元資料へ**: 企業の公表資料・FAQへのリンク、公表日、確認日、解釈上の注意を詳細に表示します

初期収録は2025-10-08〜2026-10-07に公表・更新された13事案、28資料です。国内企業を中心に、日本企業の海外子会社事案も対象地域を明記して含みます。全件網羅の統計ではなく、一次資料を確認できた選定事例です。未掲載であることは事案がないことを意味しません。

## 操作

- 企業名・概要・攻撃手法を検索し、影響と確認状況で絞り込み
- タイムラインを横ドラッグ・スワイプ、ピンチ、Ctrl/⌘+ホイール、ダブルクリックで移動・拡大
- `+` / `-` で拡大縮小、`0` で全期間、`←` / `→` で事案選択、`Esc` で閉じる
- 一覧のボタンから同じ内容にアクセスでき、スマホはタイムラインと一覧を切り替え
- 表示範囲、選択、影響、確認状況、検索、テーマはURLハッシュに保存。URLをコピーして同じ状態を再表示
- SQLコンソールは初回に開くときだけDuckDB-WASMを読み込み、端末内で照会

## 開発

Node.js 24 / pnpm 10.34.6を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check           # データ検証、単体テスト、型チェック、production build
pnpm quality         # codopsyによる品質検査（codopsyの導入が必要）
pnpm preview --host 127.0.0.1 --port 4173
pnpm test:ui         # 別ターミナルで実行
pnpm perf            # Pixel 5相当のフリック性能予算
```

システムのChromiumを使用する場合は`CHROMIUM_PATH=/usr/bin/chromium`を付けます。別ポートで動かすときは`UI_URL`と`PERF_URL`を指定します。

GitHub Actionsでデータ整合性・単体テスト・codopsy・ビルド・デスクトップ/モバイルUI・性能予算を確認した後、mainをGitHub Pagesへ公開します。Repository Settings → Pages → SourceはGitHub Actionsを選択します。PRではデプロイしません。

## データ更新

事案の正本は`src/data/incidents/<incident-id>.json`、収録方針は`src/data/meta.json`です。同一企業・同一事案の続報は同じファイルを更新します。別事案だけ新しいIDを作ります。

1. 企業の公表資料を読み、日付・確認状況・対象・範囲を確認
2. `sources`に資料URLと公表日、`timeline`に経過、`caveats`に留保を追加
3. `updatedDate` / `statusAsOfDate` / `lastVerifiedDate`を区別して更新
4. 影響は`leak` / `outage` / `unauthorizedAccess`の複数指定。ランサムウェアなどの手法は`attackMethod`へ
5. `meta.incidentCount`を合わせ、`pnpm check`を実行

生データの漏えいファイルや攻撃者の主張へのリンクは収録しません。確認状況は公表資料の時点のもので、確認日が解決日を意味するわけではありません。

SQLの`incidents`は重複なしの事案テーブル、`events`は影響レーンごとの表示用テーブル、`threads`は影響の定義です。事案数の集計には`incidents`を使用するか`COUNT(DISTINCT incidentId)`を使用してください。

## 技術・参照

React 19、TypeScript、Vite 8、Web Worker / OffscreenCanvasのタイル描画、DuckDB-WASM。外部フォントや分析サービスは使用しません。

タイムラインエンジンは[O6lvl4/chip-war-chronicle](https://github.com/O6lvl4/chip-war-chronicle)の`8678cec358f7dd528b5a2048691267407ba4d77a`を基に、独立したリポジトリとして実装しています。元リポジトリは変更していません。権利・来歴については[NOTICE.md](NOTICE.md)を参照してください。
