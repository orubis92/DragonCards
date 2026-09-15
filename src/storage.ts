import type { ConfigPartita } from './components/Partita';
import type { Livello } from './engine/ai';
import type { ProgressoCampagna } from './engine/campagna';
import type { DeckDef } from './engine/decks';

const KEY_CONFIG = 'draghicarte.config';
const KEY_STATS = 'draghicarte.stats';
const KEY_CAMPAGNA = 'draghicarte.campagna';
const KEY_MAZZI = 'draghicarte.mazzi';

export interface Statistiche {
  vittorie: number;
  sconfitte: number;
  perLivello: Partial<Record<Livello, { v: number; s: number }>>;
}

export const CONFIG_DEFAULT: ConfigPartita = {
  nomeGiocatore: 'Giocatore',
  mazzoGiocatore: 'fuoco',
  mazzoIA: 'casuale',
  livello: 2,
  suoni: true,
  veloce: false,
  tutorialFatto: false,
};

function leggi<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function scrivi(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignora */ }
}

export function caricaConfig(): ConfigPartita { return leggi(KEY_CONFIG, CONFIG_DEFAULT); }
export function salvaConfig(c: ConfigPartita) { scrivi(KEY_CONFIG, c); }

export function caricaStats(): Statistiche { return leggi(KEY_STATS, { vittorie: 0, sconfitte: 0, perLivello: {} }); }

export function registraEsito(stats: Statistiche, livello: Livello, vinto: boolean): Statistiche {
  const pl = { ...(stats.perLivello[livello] ?? { v: 0, s: 0 }) };
  if (vinto) pl.v++; else pl.s++;
  const ns: Statistiche = {
    vittorie: stats.vittorie + (vinto ? 1 : 0),
    sconfitte: stats.sconfitte + (vinto ? 0 : 1),
    perLivello: { ...stats.perLivello, [livello]: pl },
  };
  scrivi(KEY_STATS, ns);
  return ns;
}

export function caricaCampagna(): ProgressoCampagna { return leggi(KEY_CAMPAGNA, { battuti: [], sbloccate: [] }); }
export function salvaCampagna(p: ProgressoCampagna) { scrivi(KEY_CAMPAGNA, p); }

export function caricaMazziPersonalizzati(): DeckDef[] {
  try {
    const raw = localStorage.getItem(KEY_MAZZI);
    return raw ? (JSON.parse(raw) as DeckDef[]) : [];
  } catch {
    return [];
  }
}
export function salvaMazziPersonalizzati(m: DeckDef[]) { scrivi(KEY_MAZZI, m); }
