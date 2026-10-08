import type { UrlRoute } from '../lib/urlNavigation';
export type Category = 'incident' | 'vulnerability';
export interface CategoryProps { category: Category; onCategoryChange: (category: Category) => void }
export interface CategoryRouteProps extends CategoryProps, Pick<UrlRoute, 'initialUrl' | 'onUrlChange'> {}
export default function CategoryNav({ category, onCategoryChange }: CategoryProps) {
  return <nav className="category-tabs" aria-label="記録のカテゴリー">
    <button aria-pressed={category === 'incident'} onClick={() => onCategoryChange('incident')}>企業のインシデント</button>
    <button aria-pressed={category === 'vulnerability'} onClick={() => onCategoryChange('vulnerability')}>ライブラリの脆弱性</button>
  </nav>;
}
