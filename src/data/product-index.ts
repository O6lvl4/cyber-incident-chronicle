import type { ProductAdvisory } from '../productTypes';
import type { Thread } from '../types';
import { projectProducts } from '../lib/products';
import meta from './product-meta.json';
export const PRODUCT_META = meta;
export const PRODUCTS = Object.values(import.meta.glob<ProductAdvisory>('./products/*.json', { eager: true, import: 'default' }))
  .sort((a, b) => b.listedDate.localeCompare(a.listedDate) || a.id.localeCompare(b.id));
export const PRODUCTS_BY_ID = new Map(PRODUCTS.map(item => [item.id, item]));
export const PRODUCT_EVENTS = projectProducts(PRODUCTS);
export const PRODUCT_KEYS = [...new Map(PRODUCTS.map(item => [item.productKey, item.product])).entries()].sort(([a], [b]) => a.localeCompare(b));
export const PRODUCT_YEARS = [...new Set(PRODUCTS.map(item => item.listedDate.slice(0, 4)))].sort().reverse();
export const PRODUCT_LANES: Thread[] = [
  { id: 'products', name: '製品・ランタイムの注意喚起', shortName: '製品', en: 'PRODUCT ADVISORIES', color: '#A9531C', darkColor: '#F2B079' },
];
export const PRODUCT_START = Date.parse(PRODUCT_META.windowStart) - 14 * 86400000;
export const PRODUCT_END = Date.parse(PRODUCT_META.windowEnd) + 14 * 86400000;
