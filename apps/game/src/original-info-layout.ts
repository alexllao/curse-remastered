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

/** Página propia del port; conserva intactas las cuatro páginas del juego de 1992. */
export function withPortCredits(profile: OriginalInfoProfile): OriginalInfoProfile {
  const columns = 22;
  const rows = ['WEB Y REMASTER', '', 'ÀLEX LLAÓ', '', 'CURSE REMASTERED'].map((line) =>
    Array.from(
      line.padStart(line.length + Math.floor((columns - line.length) / 2), ' '),
      (character) => character.charCodeAt(0),
    ),
  );
  return { ...profile, pages: [...profile.pages, { width: 192, height: 70, rows }] };
}

/** Dos acentos añadidos con píxeles del mismo estilo que FONT.SPR. */
export function originalInfoGlyph(code: number) {
  if (code === 192) return { code: 65, accent: 'grave' as const };
  if (code === 211) return { code: 79, accent: 'acute' as const };
  return { code, accent: null };
}
