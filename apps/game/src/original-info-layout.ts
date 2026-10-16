import type { VisualAsset } from './presentation.js';
export interface OriginalInfoProfile {
  pages: { width: number; height: number; rows: number[][] }[];
  fields: { page: number; row: number; column: number; kind: 'score' | 'percentage' }[];
  mapping: number[];
  glyphs: VisualAsset[];
  maximumScore: number;
  advanceX: number;
  advanceY: number;
  insetX: number;
  insetY: number;
}
export function originalInfoPage(profile: OriginalInfoProfile, page: number, score: number) {
  const source = profile.pages[page];
  const rows = source.rows.map((row) => row.slice());
  for (const field of profile.fields.filter((field) => field.page === page)) {
    const value = field.kind === 'score' ? score : Math.floor((score * 100) / profile.maximumScore);
    const digits = String(Math.trunc(value)).padStart(3, ' ').slice(-3);
    rows[field.row].splice(field.column, 3, ...Array.from(digits, (char) => char.charCodeAt(0)));
  }
  return {
    ...source,
    rows,
    x: Math.floor((320 - source.width) / 2),
    y: Math.floor((200 - source.height) / 2),
  };
}
