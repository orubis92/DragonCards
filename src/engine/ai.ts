import type { Action, DragonOnBoard, GameState, PlayerId } from './types';
import { azioniLegali, applica, other, puoAttaccare, clona, rand } from './rules';
import { carta, dannoElementale, vantaggio } from './cards';

export type Livello = 1 | 2 | 3;

/** Personalità dell'IA: pesi dell'euristica. */
export interface Profilo {
  nome: string;
  aggressione: number; // peso del danno alla vita avversaria (1 = neutro)
  prudenza: number; // peso della propria vita e della minaccia subita
  campo: number; // peso del valore del proprio tabellone
}
export const PROFILI: Record<'fuoco' | 'ghiaccio' | 'terra' | 'misto', Profilo> = {
  fuoco: { nome: 'aggressivo', aggressione: 1.5, prudenza: 0.7, campo: 0.9 },
  ghiaccio: { nome: 'controllo', aggressione: 0.9, prudenza: 1.1, campo: 1.2 },
  terra: { nome: 'difensivo', aggressione: 0.7, prudenza: 1.5, campo: 1.1 },
  misto: { nome: 'equilibrato', aggressione: 1, prudenza: 1, campo: 1 },
};
export const LIVELLI: Record<Livello, { nome: string; descrizione: string }> = {
  1: { nome: 'Facile', descrizione: 'Gioca a caso, adatto per imparare le regole.' },
  2: { nome: 'Medio', descrizione: 'Valuta ogni mossa singolarmente: scambi favorevoli e vantaggi elementali.' },
  3: { nome: 'Difficile', descrizione: 'Pianifica l\'intero turno cercando la sequenza migliore e i colpi letali.' },
};

// ---------------------------------------------------------------------------
// Valutazione euristica di uno stato dal punto di vista di `pid`
// ---------------------------------------------------------------------------
function valoreDrago(d: DragonOnBoard): number {
  let v = d.attacco * 1.3 + d.vita * 1.0;
  if (d.keywords.includes('guardiano')) v += 1.5;
  if (d.keywords.includes('rigenerazione')) v += 1.5;
  if (d.scudo) v += 1.5;
  if (d.congelato) v -= d.attacco * 0.6;
  return v;
}

export function valuta(state: GameState, pid: PlayerId, profondo = false, profilo: Profilo = PROFILI.misto): number {
  const io = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  if (state.vincitore === pid) return 10000;
  if (state.vincitore === other(pid)) return -10000;

  let s = 0;
  if (profondo) s -= rispostaAvversario(state, pid) * 0.7 * profilo.prudenza;
  // Vita: pesa di più quando è bassa (pericolo)
  s += vitaScore(io.vita) * profilo.prudenza - vitaScore(avv.vita) * profilo.aggressione;
  // Campo
  for (const d of io.campo) s += valoreDrago(d) * profilo.campo;
  for (const d of avv.campo) s -= valoreDrago(d);
  // Mano e risorse
  s += io.mano.length * 0.8 - avv.mano.length * 0.8;
  // Minaccia dell'avversario nel suo prossimo turno
  const minaccia = avv.campo.reduce((t, d) => t + (d.congelato ? 0 : d.attacco), 0);
  if (minaccia >= io.vita) s -= 400; // letale in vista, se non ci sono guardiani
  else if (io.vita - minaccia < 6) s -= (6 - (io.vita - minaccia)) * 2 * profilo.prudenza;
  return s;
}

/**
 * Stima di quanto l'avversario potrà guadagnare nel suo prossimo turno
 * attaccando con i draghi che ha già sul campo (ogni attaccante sceglie
 * indipendentemente la mossa migliore). Usata solo dal livello Difficile.
 */
function rispostaAvversario(state: GameState, pid: PlayerId): number {
  const io = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  const guardiani = io.campo.filter((d) => d.keywords.includes('guardiano'));
  const bersagli = guardiani.length > 0 ? guardiani : io.campo;
  let tot = 0;
  for (const a of avv.campo) {
    if (a.congelato || a.attacco <= 0) continue;
    let best = guardiani.length > 0 ? 0 : a.attacco * 1.6; // danno in faccia
    for (const d of bersagli) {
      const inflitto = d.scudo ? 0 : dannoElementale(a.attacco, vantaggio(a.elemento, d.elemento));
      const subito = a.scudo ? 0 : d.attacco;
      let g = 0;
      if (inflitto >= d.vita) g += valoreDrago(d);
      else g += inflitto * 0.6;
      if (subito >= a.vita) g -= valoreDrago(a);
      else g -= subito * 0.6;
      if (g > best) best = g;
    }
    tot += best;
  }
  return tot;
}

function vitaScore(v: number): number {
  // concava: perdere vita quando se ne ha poca costa di più
  if (v <= 0) return -500;
  return v * 2 + Math.min(v, 10) * 1.5;
}

// ---------------------------------------------------------------------------
// Livello 1: casuale (ma non completamente stupido: finisce il turno solo
// quando non ha più nulla da fare oppure con probabilità bassa)
// ---------------------------------------------------------------------------
function scegliCasuale(state: GameState, rnd: () => number): Action {
  const azioni = azioniLegali(state);
  const utili = azioni.filter((a) => a.tipo !== 'fineTurno');
  if (utili.length === 0 || rnd() < 0.15) return { tipo: 'fineTurno' };
  return utili[Math.floor(rnd() * utili.length)];
}

// ---------------------------------------------------------------------------
// Livello 2: greedy — valuta ogni singola azione e prende la migliore se
// migliora lo stato; altrimenti passa
// ---------------------------------------------------------------------------
function scegliGreedy(state: GameState, rnd: () => number, profilo: Profilo): Action {
  const pid = state.attivo;
  const azioni = azioniLegali(state);
  const base = valuta(state, pid, false, profilo);
  let best: Action = { tipo: 'fineTurno' };
  let bestScore = base - 0.01; // piccola tolleranza: passa se nulla migliora
  for (const a of azioni) {
    if (a.tipo === 'fineTurno') continue;
    const s = valuta(applica(state, a), pid, false, profilo) + rnd() * 1.5; // un po' di rumore: non è perfetto
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Livello 3: ricerca a fascio sull'intero turno. Esplora sequenze di azioni
// fino a fine turno, tiene le migliori `AMPIEZZA` a ogni passo, e restituisce
// la prima azione della sequenza migliore.
// ---------------------------------------------------------------------------
const AMPIEZZA = 8;
const PROFONDITA = 10;

interface Nodo { state: GameState; prima: Action | null; score: number; finito: boolean }

function scegliRicerca(state: GameState, profilo: Profilo): Action {
  const pid = state.attivo;
  let fascio: Nodo[] = [{ state, prima: null, score: valuta(state, pid, true, profilo), finito: false }];
  let migliore: Nodo | null = null;

  for (let passo = 0; passo < PROFONDITA; passo++) {
    const prossimi: Nodo[] = [];
    for (const n of fascio) {
      if (n.finito) continue;
      const azioni = ordinaAzioni(n.state, azioniLegali(n.state));
      for (const a of azioni) {
        if (a.tipo === 'fineTurno') {
          // valutazione dello stato a fine turno (senza far avanzare il turno, che pescherebbe)
          const cand: Nodo = { state: n.state, prima: n.prima ?? a, score: n.score, finito: true };
          if (!migliore || cand.score > migliore.score) migliore = cand;
          continue;
        }
        const ns = applica(n.state, a);
        const sc = valuta(ns, pid, true, profilo);
        const cand: Nodo = { state: ns, prima: n.prima ?? a, score: sc, finito: ns.vincitore !== null };
        if (cand.finito) {
          if (!migliore || cand.score > migliore.score) migliore = cand;
        } else {
          prossimi.push(cand);
        }
      }
    }
    if (prossimi.length === 0) break;
    prossimi.sort((a, b) => b.score - a.score);
    fascio = dedup(prossimi).slice(0, AMPIEZZA);
  }
  // Se la ricerca è stata troncata, considera anche i nodi ancora aperti
  for (const n of fascio) if (!migliore || n.score > migliore.score) migliore = n;
  return migliore?.prima ?? { tipo: 'fineTurno' };
}

/** Ordina le azioni per esplorare prima quelle promettenti (draghi costosi, attacchi con vantaggio). */
function ordinaAzioni(state: GameState, azioni: Action[]): Action[] {
  const p = state.giocatori[state.attivo];
  const prio = (a: Action): number => {
    if (a.tipo === 'giocaDrago') return 10 + carta(p.mano.find((c) => c.uid === a.uid)!.defId).costo;
    if (a.tipo === 'giocaIncantesimo') return 8;
    if (a.tipo === 'attacca') return a.a === 'giocatore' ? 5 : 6;
    return 0;
  };
  return azioni.slice().sort((a, b) => prio(b) - prio(a));
}

/** Elimina stati equivalenti (stessa firma) per non sprecare ampiezza del fascio. */
function dedup(nodi: Nodo[]): Nodo[] {
  const visti = new Set<string>();
  const out: Nodo[] = [];
  for (const n of nodi) {
    const f = firma(n.state);
    if (visti.has(f)) continue;
    visti.add(f);
    out.push(n);
  }
  return out;
}

function firma(s: GameState): string {
  return s.giocatori
    .map((p) => `${p.vita}|${p.cristalli}|${p.mano.map((c) => c.uid).sort().join(',')}|${p.campo
      .map((d) => `${d.uid}:${d.attacco}/${d.vita}${d.haAttaccato ? 'a' : ''}${d.scudo ? 's' : ''}${d.congelato ? 'c' : ''}`)
      .sort()
      .join(',')}`)
    .join('#');
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export function scegliAzione(state: GameState, livello: Livello, rnd: () => number = Math.random, profilo: Profilo = PROFILI.misto): Action {
  if (state.vincitore !== null) return { tipo: 'fineTurno' };
  // Se nessun drago può attaccare e non ci sono carte giocabili, passa subito
  const azioni = azioniLegali(state);
  if (azioni.length === 1) return azioni[0];
  if (livello === 1) return scegliCasuale(state, rnd);
  // L'IA ragiona su una copia in cui il proprio mazzo è rimescolato: così non
  // "vede" le carte che pescherebbe davvero (informazione che non dovrebbe avere).
  const copia = anonimizza(state, rnd);
  return livello === 2 ? scegliGreedy(copia, rnd, profilo) : scegliRicerca(copia, profilo);
}

function anonimizza(state: GameState, rnd: () => number): GameState {
  const s = clona(state);
  s.seed = Math.floor(rnd() * 2 ** 31);
  for (const p of s.giocatori) {
    const m = p.mazzo;
    for (let i = m.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [m[i], m[j]] = [m[j], m[i]];
    }
  }
  return s;
}

/** Utility per la UI: c'è almeno un drago che può ancora attaccare? */
export function haAttaccanti(state: GameState): boolean {
  return state.giocatori[state.attivo].campo.some(puoAttaccare);
}
