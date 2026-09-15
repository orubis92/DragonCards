import type { Element } from './types';
import { DRAGHI_BASE, DRAGHI_EFFETTO, carta } from './cards';

export interface DeckDef {
  id: string;
  nome: string;
  elemento: Element | 'misto';
  descrizione: string;
  carte: string[]; // id delle carte (con ripetizioni)
}

export const DIM_MAZZO = 30;
export const MAX_COPIE = 2;

function mono(el: Element, prefisso: string): string[] {
  const base = DRAGHI_BASE.filter((d) => d.elemento === el);
  const effetto = DRAGHI_EFFETTO.filter((d) => d.elemento === el);
  const carte: string[] = [];
  for (const d of base) {
    carte.push(d.id);
    if (d.costo <= 4) carte.push(d.id); // due copie dei draghi da 1 a 4
  }
  for (const d of effetto) carte.push(d.id);
  for (let i = 1; i <= 4; i++) carte.push(`${prefisso}${i}`);
  carte.push('sn1', 'sn4');
  return carte;
}

export const MAZZI: DeckDef[] = [
  {
    id: 'fuoco',
    nome: 'Fiamme del Vesuvio',
    elemento: 'fuoco',
    descrizione: 'Aggressivo: draghi con attacco alto e Carica, incantesimi di danno diretto.',
    carte: mono('fuoco', 'sf'),
  },
  {
    id: 'ghiaccio',
    nome: 'Ghiacci Eterni',
    elemento: 'ghiaccio',
    descrizione: 'Controllo: Scudi, congelamenti e draghi equilibrati che resistono a lungo.',
    carte: mono('ghiaccio', 'sg'),
  },
  {
    id: 'terra',
    nome: 'Radici Antiche',
    elemento: 'terra',
    descrizione: 'Difensivo: Guardiani con molta vita, cure e rigenerazione.',
    carte: mono('terra', 'st'),
  },
  {
    id: 'misto',
    nome: 'Equilibrio dei Tre',
    elemento: 'misto',
    descrizione: 'Draghi di tutti gli elementi: sfrutta i vantaggi a triangolo.',
    carte: [
      // un drago base per ogni costo da 1 a 6 di ciascun elemento (il primo del catalogo)
      ...DRAGHI_BASE.filter((d, i, arr) => d.costo <= 6 && arr.findIndex((x) => x.elemento === d.elemento && x.costo === d.costo) === i).map((d) => d.id),
      // tre draghi con effetto per elemento
      ...DRAGHI_EFFETTO.filter((d) => d.costo <= 4).map((d) => d.id),
      'sf1', 'sg1', 'st1',
    ],
  },
];

/** Mazzi degli avversari della campagna (non selezionabili dal menu). */
export const MAZZI_CAMPAGNA: DeckDef[] = [
  { id: 'c-cuccioli', nome: 'Nido di Cuccioli', elemento: 'misto', descrizione: 'Solo draghi piccoli.',
    carte: ripeti(['f01', 'f02', 'g01', 'g02', 't01', 't02', 'f03', 'g03', 't03', 'f04', 'g04', 't04'], 2).concat(['sn4', 'sn4', 'st2', 'st2', 'sn1', 'sn1']) },
  { id: 'c-brace', nome: 'Sentiero di Brace', elemento: 'fuoco', descrizione: 'Fuoco aggressivo.',
    carte: ripeti(['f01', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f13'], 2).concat(['f09', 'f09', 'f10', 'f14', 'f14', 'sf1', 'sf1', 'sf4', 'sf4', 'sf3', 'sf3', 'sn4', 'sn4', 'sn1']) },
  { id: 'c-ghiaccio', nome: 'Lago Ghiacciato', elemento: 'ghiaccio', descrizione: 'Ghiaccio di controllo.',
    carte: ripeti(['g02', 'g03', 'g04', 'g05', 'g06', 'g07', 'g08', 'g13'], 2).concat(['g09', 'g09', 'g10', 'g14', 'g14', 'sg1', 'sg1', 'sg2', 'sg2', 'sg3', 'sg3', 'sn1', 'sn1', 'sn4']) },
  { id: 'c-roccia', nome: 'Muraglia di Roccia', elemento: 'terra', descrizione: 'Guardiani ovunque.',
    carte: ripeti(['t02', 't03', 't04', 't05', 't06', 't07', 't08', 't15'], 2).concat(['t09', 't09', 't11', 't13', 't13', 'st1', 'st1', 'st2', 'st2', 'st3', 'st3', 'sn1', 'sn1', 'sn4']) },
  { id: 'c-tempesta', nome: 'Occhio della Tempesta', elemento: 'misto', descrizione: 'Incantesimi a raffica.',
    carte: ['f03', 'f05', 'g03', 'g05', 't03', 't06', 'f07', 'g08', 't08', 'f09', 'g09', 't09', 'g15', 'g15', 'f13', 'f13',
      'sf1', 'sf1', 'sf2', 'sg1', 'sg1', 'sg4', 'st1', 'st1', 'st4', 'sn1', 'sn1', 'sn3', 'sn4', 'sn4'] },
  { id: 'c-vulcano', nome: 'Cuore del Vulcano', elemento: 'fuoco', descrizione: 'Fuoco con effetti.',
    carte: ripeti(['f04', 'f06', 'f08', 'f13', 'f14', 'f15', 'f16'], 2).concat(['f09', 'f09', 'f10', 'f11', 'f12', 'sf1', 'sf1', 'sf2', 'sf3', 'sf3', 'sf4', 'sf4', 'sn1', 'sn1', 'sn4', 'sn4']) },
  { id: 'c-cristallo', nome: 'Cattedrale di Cristallo', elemento: 'ghiaccio', descrizione: 'Ghiaccio con effetti.',
    carte: ripeti(['g04', 'g06', 'g07', 'g13', 'g14', 'g15', 'g16'], 2).concat(['g09', 'g09', 'g10', 'g11', 'g12', 'sg1', 'sg1', 'sg2', 'sg2', 'sg3', 'sg4', 'sg4', 'sn1', 'sn1', 'sn3', 'sn4']) },
  { id: 'c-foresta', nome: 'Foresta Primordiale', elemento: 'terra', descrizione: 'Terra con effetti.',
    carte: ripeti(['t04', 't05', 't07', 't13', 't14', 't15', 't16'], 2).concat(['t09', 't09', 't10', 't11', 't12', 'st1', 'st1', 'st2', 'st2', 'st3', 'st3', 'st4', 'sn1', 'sn1', 'sn3', 'sn4']) },
  { id: 'c-triade', nome: 'Triade Elementale', elemento: 'misto', descrizione: 'Il meglio dei tre elementi.',
    carte: ['f04', 'f06', 'f08', 'f09', 'f13', 'f14', 'f16', 'g04', 'g06', 'g08', 'g09', 'g13', 'g15', 'g16', 't05', 't07', 't08', 't09', 't14', 't15', 't16',
      'sf1', 'sg1', 'st1', 'sg2', 'st2', 'sn1', 'sn3', 'sn4', 'sn4'] },
  { id: 'c-ignis', nome: 'Signori Antichi', elemento: 'misto', descrizione: 'I draghi leggendari, tutti insieme.',
    carte: ['f09', 'f10', 'f11', 'f12', 'f15', 'f16', 'g09', 'g10', 'g11', 'g12', 'g15', 'g16', 't09', 't10', 't11', 't12', 't15', 't16',
      'f08', 'g08', 't08', 'sf2', 'sg4', 'st4', 'sn3', 'sn3', 'sn1', 'sn1', 'sn2', 'sn2'] },
];

function ripeti(ids: string[], n: number): string[] {
  const out: string[] = [];
  for (const id of ids) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

// Mazzi personalizzati registrati a runtime (dal deck builder)
const personalizzati = new Map<string, DeckDef>();
export function registraMazziPersonalizzati(lista: DeckDef[]) {
  personalizzati.clear();
  for (const m of lista) personalizzati.set(m.id, m);
}

export function mazzo(id: string): DeckDef {
  const m = MAZZI.find((x) => x.id === id) ?? MAZZI_CAMPAGNA.find((x) => x.id === id) ?? personalizzati.get(id);
  if (!m) throw new Error(`Mazzo sconosciuto: ${id}`);
  return m;
}

/** Elemento dominante di una lista di carte (per la personalità dell'IA e il colore del mazzo). */
export function elementoDominante(carte: string[]): Element | 'misto' {
  const conta: Record<Element, number> = { fuoco: 0, ghiaccio: 0, terra: 0 };
  for (const id of carte) {
    const c = carta(id);
    if (c.elemento !== 'neutro') conta[c.elemento]++;
  }
  const ord = (Object.entries(conta) as [Element, number][]).sort((a, b) => b[1] - a[1]);
  return ord[0][1] >= carte.length * 0.6 ? ord[0][0] : 'misto';
}

/** Verifica un mazzo personalizzato: ritorna la lista dei problemi (vuota se valido). */
export function validaMazzo(carte: string[], collezione: Set<string>): string[] {
  const problemi: string[] = [];
  if (carte.length !== DIM_MAZZO) problemi.push(`Il mazzo deve avere ${DIM_MAZZO} carte (ne ha ${carte.length}).`);
  const conta = new Map<string, number>();
  for (const id of carte) conta.set(id, (conta.get(id) ?? 0) + 1);
  for (const [id, n] of conta) {
    if (n > MAX_COPIE) problemi.push(`${carta(id).nome}: massimo ${MAX_COPIE} copie.`);
    if (!collezione.has(id)) problemi.push(`${carta(id).nome} non è nella tua collezione.`);
  }
  return problemi;
}
