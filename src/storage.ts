import type { ConfigPartita } from './components/Partita';
import type { Livello } from './engine/ai';

const KEY_CONFIG = 'draghicarte.config';
const KEY_STATS = 'draghicarte.stats';

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
};

export function caricaConfig(): ConfigPartita {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    return raw ? { ...CONFIG_DEFAULT, ...JSON.parse(raw) } : CONFIG_DEFAULT;
  } catch {
    return CONFIG_DEFAULT;
  }
}

export function salvaConfig(c: ConfigPartita) {
  try { localStorage.setItem(KEY_CONFIG, JSON.stringify(c)); } catch { /* ignora */ }
}

export function caricaStats(): Statistiche {
  try {
    const raw = localStorage.getItem(KEY_STATS);
    return raw ? JSON.parse(raw) : { vittorie: 0, sconfitte: 0, perLivello: {} };
  } catch {
    return { vittorie: 0, sconfitte: 0, perLivello: {} };
  }
}

export function registraEsito(stats: Statistiche, livello: Livello, vinto: boolean): Statistiche {
  const pl = { ...(stats.perLivello[livello] ?? { v: 0, s: 0 }) };
  if (vinto) pl.v++; else pl.s++;
  const ns: Statistiche = {
    vittorie: stats.vittorie + (vinto ? 1 : 0),
    sconfitte: stats.sconfitte + (vinto ? 0 : 1),
    perLivello: { ...stats.perLivello, [livello]: pl },
  };
  try { localStorage.setItem(KEY_STATS, JSON.stringify(ns)); } catch { /* ignora */ }
  return ns;
}
