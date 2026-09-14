import type { Element } from './types';
import { DRAGHI } from './cards';

export interface DeckDef {
  id: string;
  nome: string;
  elemento: Element | 'misto';
  descrizione: string;
  carte: string[]; // id delle carte (con ripetizioni)
}

function mono(el: Element, prefisso: string): string[] {
  const draghi = DRAGHI.filter((d) => d.elemento === el);
  const carte: string[] = [];
  for (const d of draghi) {
    carte.push(d.id);
    if (d.costo <= 5) carte.push(d.id); // due copie dei draghi piccoli e medi
  }
  for (let i = 1; i <= 4; i++) carte.push(`${prefisso}${i}`, `${prefisso}${i}`);
  carte.push('sn1');
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
    descrizione: 'Un drago per ogni costo di ciascun elemento: sfrutta i vantaggi a triangolo.',
    carte: [
      // un drago per ogni costo da 1 a 7 di ciascun elemento (il primo del catalogo)
      ...DRAGHI.filter((d, i, arr) => d.costo <= 7 && arr.findIndex((x) => x.elemento === d.elemento && x.costo === d.costo) === i).map((d) => d.id),
      'sf1', 'sg1', 'st1', 'sf4', 'sg2', 'st2', 'sn1', 'sn3', 'sn4',
    ],
  },
];

export function mazzo(id: string): DeckDef {
  const m = MAZZI.find((x) => x.id === id);
  if (!m) throw new Error(`Mazzo sconosciuto: ${id}`);
  return m;
}
