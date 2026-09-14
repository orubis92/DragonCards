import type { CardDef, DragonDef, SpellDef, Element } from './types';

// ---------------------------------------------------------------------------
// Catalogo carte. Ogni drago: costo in cristalli, attacco, vita, elemento.
// Budget indicativo: attacco + vita ≈ 2 × costo + 1; una parola chiave vale ~1.
// ---------------------------------------------------------------------------

const D = (
  id: string, nome: string, elemento: Element, costo: number, attacco: number, vita: number,
  icona: string, keywords: DragonDef['keywords'] = [], testo?: string,
): DragonDef => ({ kind: 'drago', id, nome, elemento, costo, attacco, vita, icona, keywords, testo });

export const DRAGHI: DragonDef[] = [
  // ---- FUOCO: attacco alto, vita bassa, Carica ----
  D('f01', 'Cucciolo di Brace', 'fuoco', 1, 2, 1, 'salamander'),
  D('f02', 'Salamandra Ardente', 'fuoco', 1, 1, 2, 'lizard-tongue'),
  D('f03', 'Viverna Rossa', 'fuoco', 2, 3, 2, 'wyvern'),
  D('f04', 'Drago di Cenere', 'fuoco', 2, 2, 2, 'dragon-spiral', ['carica']),
  D('f05', 'Sputafuoco', 'fuoco', 3, 4, 3, 'fire-breath'),
  D('f06', 'Drago della Fornace', 'fuoco', 3, 3, 3, 'dragon-head', ['carica']),
  D('f07', 'Serpe di Lava', 'fuoco', 4, 5, 4, 'sea-serpent'),
  D('f08', 'Drago Meteora', 'fuoco', 4, 4, 3, 'burning-meteor', ['carica']),
  D('f09', 'Signore delle Fiamme', 'fuoco', 5, 6, 5, 'spiked-dragon-head'),
  D('f10', 'Drago Vulcanico', 'fuoco', 6, 7, 6, 'volcano', [], ),
  D('f11', 'Fenice Draconica', 'fuoco', 7, 6, 7, 'spiky-wing', ['rigenerazione', 'carica']),
  D('f12', 'Ignis, Cuore del Vesuvio', 'fuoco', 8, 9, 8, 'double-dragon', ['carica']),

  // ---- GHIACCIO: equilibrati, Scudo ----
  D('g01', 'Cucciolo di Neve', 'ghiaccio', 1, 1, 2, 'snowflake-1'),
  D('g02', 'Lucertola Glaciale', 'ghiaccio', 1, 2, 1, 'horned-reptile'),
  D('g03', 'Viverna Bianca', 'ghiaccio', 2, 2, 3, 'wyvern'),
  D('g04', 'Drago di Brina', 'ghiaccio', 2, 2, 2, 'frozen-orb', ['scudo']),
  D('g05', 'Serpente dei Ghiacci', 'ghiaccio', 3, 3, 4, 'sea-dragon'),
  D('g06', 'Drago Cristallino', 'ghiaccio', 3, 3, 3, 'crystal-growth', ['scudo']),
  D('g07', 'Custode del Ghiacciaio', 'ghiaccio', 4, 3, 6, 'ice-golem', ['guardiano']),
  D('g08', 'Drago Stalattite', 'ghiaccio', 4, 5, 4, 'stalagtite'),
  D('g09', 'Signora della Tormenta', 'ghiaccio', 5, 5, 6, 'dragon-head', ['scudo']),
  D('g10', 'Drago Boreale', 'ghiaccio', 6, 6, 7, 'icicles-aura'),
  D('g11', 'Idra di Ghiaccio', 'ghiaccio', 7, 7, 8, 'hydra'),
  D('g12', 'Glacia, Regina Eterna', 'ghiaccio', 8, 8, 9, 'dragon-orb', ['scudo', 'guardiano']),

  // ---- TERRA: vita alta, Guardiano e Rigenerazione ----
  D('t01', 'Cucciolo di Roccia', 'terra', 1, 1, 3, 'rock'),
  D('t02', 'Geco di Pietra', 'terra', 1, 1, 2, 'reptile-tail', ['guardiano']),
  D('t03', 'Drago delle Radici', 'terra', 2, 2, 3, 'tree-roots'),
  D('t04', 'Drago Muschioso', 'terra', 2, 1, 4, 'seedling', ['rigenerazione']),
  D('t05', 'Golem Draconico', 'terra', 3, 2, 5, 'rock-golem', ['guardiano']),
  D('t06', 'Drago di Quarzo', 'terra', 3, 3, 4, 'crystal-cluster'),
  D('t07', 'Guardiano della Foresta', 'terra', 4, 3, 6, 'oak', ['guardiano']),
  D('t08', 'Drago Spinoso', 'terra', 4, 4, 5, 'thorny-vine'),
  D('t09', 'Drago delle Montagne', 'terra', 5, 4, 7, 'mountains', ['rigenerazione']),
  D('t10', 'Tirannodrago', 'terra', 6, 6, 7, 'dinosaur-rex'),
  D('t11', 'Colosso di Granito', 'terra', 7, 5, 10, 'golem-head', ['guardiano']),
  D('t12', 'Gaia, Madre della Terra', 'terra', 8, 7, 10, 'drakkar-dragon', ['guardiano', 'rigenerazione']),
];

const S = (
  id: string, nome: string, elemento: SpellDef['elemento'], costo: number,
  effetto: SpellDef['effetto'], icona: string, testo: string,
): SpellDef => ({ kind: 'incantesimo', id, nome, elemento, costo, effetto, icona, testo });

export const INCANTESIMI: SpellDef[] = [
  // Fuoco: danno diretto
  S('sf1', 'Palla di Fuoco', 'fuoco', 2, { tipo: 'danno', valore: 3, bersaglio: 'drago' }, 'fireball',
    'Infligge 3 danni di Fuoco a un drago.'),
  S('sf2', 'Pioggia di Meteore', 'fuoco', 5, { tipo: 'dannoTutti', valore: 2 }, 'meteor-impact',
    'Infligge 2 danni di Fuoco a tutti i draghi avversari.'),
  S('sf3', 'Soffio Infernale', 'fuoco', 4, { tipo: 'danno', valore: 4, bersaglio: 'giocatore' }, 'flame',
    'Infligge 4 danni all\'avversario.'),
  S('sf4', 'Furia Ardente', 'fuoco', 1, { tipo: 'potenzia', attacco: 2, vita: 0, bersaglio: 'drago' }, 'flame-claws',
    'Un drago alleato ottiene +2 attacco.'),
  // Ghiaccio: controllo
  S('sg1', 'Lancia di Ghiaccio', 'ghiaccio', 2, { tipo: 'danno', valore: 3, bersaglio: 'drago' }, 'ice-spear',
    'Infligge 3 danni di Ghiaccio a un drago.'),
  S('sg2', 'Congelamento', 'ghiaccio', 1, { tipo: 'congela', bersaglio: 'drago' }, 'snowflake-2',
    'Un drago avversario salta il suo prossimo attacco.'),
  S('sg3', 'Scudo di Brina', 'ghiaccio', 1, { tipo: 'scudo', bersaglio: 'drago' }, 'ice-shield',
    'Un drago alleato ottiene Scudo (ignora il primo danno).'),
  S('sg4', 'Tormenta', 'ghiaccio', 6, { tipo: 'dannoTutti', valore: 3 }, 'person-in-blizzard',
    'Infligge 3 danni di Ghiaccio a tutti i draghi avversari.'),
  // Terra: sostegno
  S('st1', 'Frana', 'terra', 3, { tipo: 'danno', valore: 4, bersaglio: 'drago' }, 'falling-boulder',
    'Infligge 4 danni di Terra a un drago.'),
  S('st2', 'Linfa Vitale', 'terra', 2, { tipo: 'cura', valore: 5 }, 'healing',
    'Recuperi 5 punti vita.'),
  S('st3', 'Crescita Selvaggia', 'terra', 2, { tipo: 'potenzia', attacco: 1, vita: 3, bersaglio: 'drago' }, 'tree-growth',
    'Un drago alleato ottiene +1 attacco e +3 vita.'),
  S('st4', 'Terremoto', 'terra', 4, { tipo: 'distruggi', costoMax: 4, bersaglio: 'drago' }, 'earth-crack',
    'Distrugge un drago avversario di costo 4 o inferiore.'),
  // Neutri
  S('sn1', 'Tomo del Sapere', 'neutro', 2, { tipo: 'pesca', valore: 2 }, 'spell-book',
    'Peschi 2 carte.'),
  S('sn2', 'Cristallo Antico', 'neutro', 0, { tipo: 'cristalli', valore: 1 }, 'crystal-shine',
    'Ottieni 1 cristallo per questo turno.'),
  S('sn3', 'Artiglio Sacrificale', 'neutro', 3, { tipo: 'distruggi', costoMax: 99, bersaglio: 'drago' }, 'claw-slashes',
    'Distrugge un drago avversario qualsiasi. Costa 3 cristalli.'),
  S('sn4', 'Clessidra del Drago', 'neutro', 1, { tipo: 'pesca', valore: 1 }, 'hourglass',
    'Peschi 1 carta.'),
];

export const CARTE: CardDef[] = [...DRAGHI, ...INCANTESIMI];
const byId = new Map(CARTE.map((c) => [c.id, c]));

export function carta(id: string): CardDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Carta sconosciuta: ${id}`);
  return c;
}

export const ELEMENTI: Record<Element, { nome: string; batte: Element; colore: string; simbolo: string }> = {
  fuoco: { nome: 'Fuoco', batte: 'ghiaccio', colore: '#ff6b35', simbolo: 'flame' },
  ghiaccio: { nome: 'Ghiaccio', batte: 'terra', colore: '#5cc8ff', simbolo: 'snowflake-1' },
  terra: { nome: 'Terra', batte: 'fuoco', colore: '#7ac74f', simbolo: 'oak-leaf' },
};

/** +1 se attaccante ha vantaggio, -1 se svantaggio, 0 se neutro. */
export function vantaggio(attaccante: Element | 'neutro', difensore: Element): -1 | 0 | 1 {
  if (attaccante === 'neutro') return 0;
  if (ELEMENTI[attaccante].batte === difensore) return 1;
  if (ELEMENTI[difensore].batte === attaccante) return -1;
  return 0;
}

/** Danno modificato dal vantaggio elementale: +50% (per eccesso) in vantaggio, -25% (per difetto, min 1) in svantaggio. */
export function dannoElementale(base: number, v: -1 | 0 | 1): number {
  if (v === 1) return Math.ceil(base * 1.5);
  if (v === -1) return Math.max(1, Math.floor(base * 0.75));
  return base;
}

export const KEYWORD_INFO: Record<NonNullable<DragonDef['keywords']>[number], { nome: string; testo: string }> = {
  guardiano: { nome: 'Guardiano', testo: 'I draghi avversari devono attaccare prima questo drago.' },
  carica: { nome: 'Carica', testo: 'Può attaccare nel turno in cui viene evocato.' },
  rigenerazione: { nome: 'Rigenerazione', testo: 'Recupera 2 vita alla fine di ogni tuo turno.' },
  scudo: { nome: 'Scudo', testo: 'Ignora il primo danno che subisce.' },
};
