import type { Thread } from '../types';
export const THREADS: Thread[] = [
  { id: 'leak', name: '情報流出・可能性', en: 'DATA EXPOSURE', color: '#A53D67', darkColor: '#F3A5C2' },
  { id: 'outage', name: '業務・サービス影響', en: 'DISRUPTION', color: '#93600D', darkColor: '#F0C36A' },
  { id: 'unauthorizedAccess', name: '不正アクセス', en: 'UNAUTHORIZED', color: '#2868AC', darkColor: '#93C5FD' },
];
