# Company classification evidence

Checked date: 2026-10-08. These are research classifications, not incident-time listing claims.

## Coverage

- 95 of 95 incidents have nonempty entity mappings
- 111 entity records, all with retrieved official company, IR, exchange, government, or company-authored release sources
- Listing: 38 listed, 22 unlisted, 49 unknown, 2 not applicable
- 30 manufacturing entities with a manufacturing subtype
- Sources may describe an earlier accounting period. `checkedDate` records when the source was reviewed, not a promise that the company updated its page that day

## Scope and normalization

- Classify the affected company or service operator, not the subject matter of its customers or the product attacked. A manufacturer remains a manufacturer for an e-commerce/cloud incident
- `listedParent` is contextual only. A parent's listing must not make its subsidiary match the listed filter
- Pure announcement parents are not separate victims. ApplyNow, Internet Disclosure, Nikkei Media Marketing, Times Mobility, Nipro's China subsidiary, and Zojirushi's Taiwan subsidiary retain their own identities
- Multiple directly involved entities are retained for the six ETC operators, KADOKAWA/Dwango, NTT cases, Tokyo Gas/TGES, Toyota/Toyota Connected, and Restar's seven expressly named affected entities
- Named data/service operators may be included when the immediate compromised contractor is not publicly identified (CTC); the note explains that distinction
- Listings are based on explicit official listing/delisting information or affirmative wholly-owned/full-shareholder ownership evidence. A missing IR page is never evidence of being unlisted
- Associations and committees have `notApplicable` classification. Unknown is a separate value and never means unlisted
- Wholesale/trading belongs to `retail`; machinery rental, hotels and professional support generally belong to `services`; real estate and agriculture belong to `other`
- Holding companies are classified by their primary group business, disclosed in the entity note. This is a compact research taxonomy, not a complete JPX industry table
- Conglomerates use one representative industry/subtype. HOYA is medical based on its life-care business share. Fujitsu remains electronics manufacturing based on its official market classification, with its large IT-services business noted
- Manufacturer subtypes describe products: plastic packaging is chemicals, not food. Kyusai's current sales company and Zojirushi's Taiwan wholesaler do not inherit manufacturing from separate group factories
- Stable IDs retain renamed legal entities. Absorbed historical entities are retained separately and conservatively marked unknown instead of inheriting their successor's listed status

## Explicit research gaps

- The TCI incident source identifies only an unnamed US subsidiary. Its legal identity, industry and listing remain unknown rather than assuming TCI America
- The six ETC operating companies have identified corporate operators and transport classification, but listing evidence is not completed
- Historic absorbed Restar entities and the business-transferred NTT Business Solutions entity need a fuller legal-status history before stronger current listing claims
- The following entity listings remain explicitly unknown:
- アフラック生命保険株式会社
- あいの風とやま鉄道株式会社
- あいざわアセットマネジメント株式会社
- 株式会社ApplyNow
- 株式会社アテックス
- ビルコム株式会社
- CRESS TECH株式会社
- 株式会社ギンポーパック
- 阪神高速道路株式会社
- 原田産業株式会社
- H.I.S. TOURS CO., LTD.（タイ）
- HJホールディングス株式会社
- ハウステンボス株式会社
- 株式会社イセトー
- 株式会社石川コンピュータ・センター
- 株式会社アイテス
- 本州四国連絡高速道路株式会社
- 株式会社紀伊國屋書店
- 倉敷帆布株式会社
- ローレルバンクマシン株式会社
- 株式会社浪速ポンプ製作所
- 中日本高速道路株式会社
- 東日本高速道路株式会社
- 西日本高速道路株式会社
- ニデックプレシジョン（ベトナム）会社
- 尼普洛医療器械（合肥）有限公司
- NTTビジネスソリューションズ株式会社
- 株式会社NTTネクシア
- レスターコミュニケーションズ（事案当時）
- セブンネット株式会社
- 株式会社審調社
- 首都高速道路株式会社
- 株式会社ソーゴー
- 株式会社ソルパック
- 株式会社倉業サービス
- タカラベルモント株式会社
- 東京化成工業の米国子会社（法人名非公表）
- 株式会社帝国データバンク
- 東光食品株式会社
- 株式会社巴商会
- トヨタコネクティッド株式会社
- トヨタモビリティサービス株式会社
- 株式会社Y4.com
- 台象股份有限公司
- 株式会社レスターエレクトロニクス（事案当時）
- 株式会社レスターデバイス
- 株式会社レスターソリューションサポート
- 株式会社バイテックエネスタ（事案当時）
- 株式会社バイテックベジタブルファクトリー
