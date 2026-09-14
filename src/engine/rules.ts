import {
  type Action, type CardInstance, type DragonOnBoard, type Element, type GameState, type LogEntry,
  type PlayerId, type PlayerState, type SpellDef, type DragonDef,
  MAX_CAMPO, MAX_MANO, VITA_INIZIALE, CRISTALLI_MAX, MANO_INIZIALE,
} from './types';
import { carta, vantaggio, dannoElementale, ELEMENTI } from './cards';
import { mazzo as mazzoDef } from './decks';

// ---------------------------------------------------------------------------
// RNG deterministico (mulberry32) — lo stato porta con sé il seme corrente
// ---------------------------------------------------------------------------
export function rand(state: GameState): number {
  let t = (state.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function mescola<T>(arr: T[], state: GameState): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Creazione partita
// ---------------------------------------------------------------------------
export function nuovaPartita(opts: {
  nomi: [string, string];
  mazzi: [string, string];
  seed?: number;
  iniziaPer?: PlayerId;
}): GameState {
  const state: GameState = {
    turno: 0,
    attivo: 0,
    giocatori: [creaGiocatore(0, opts.nomi[0]), creaGiocatore(1, opts.nomi[1])],
    vincitore: null,
    log: [],
    nextUid: 1,
    seed: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
    ultimoEvento: null,
  };
  for (const pid of [0, 1] as PlayerId[]) {
    const def = mazzoDef(opts.mazzi[pid]);
    const carte: CardInstance[] = def.carte.map((defId) => ({ uid: state.nextUid++, defId }));
    state.giocatori[pid].mazzo = mescola(carte, state);
    for (let i = 0; i < MANO_INIZIALE; i++) pesca(state, pid, false);
  }
  state.attivo = opts.iniziaPer ?? (rand(state) < 0.5 ? 0 : 1);
  // Chi inizia per secondo pesca una carta in più per compensare
  pesca(state, other(state.attivo), false);
  log(state, state.attivo, `${state.giocatori[state.attivo].nome} inizia la partita.`, 'sistema');
  inizioTurno(state);
  return state;
}

function creaGiocatore(id: PlayerId, nome: string): PlayerState {
  return { id, nome, vita: VITA_INIZIALE, cristalli: 0, cristalliMax: 0, mazzo: [], mano: [], campo: [], cimitero: [], fatica: 0 };
}

export function other(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

function log(state: GameState, chi: PlayerId, testo: string, tipo: LogEntry['tipo']) {
  state.log.push({ turno: state.turno, chi, testo, tipo });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

// ---------------------------------------------------------------------------
// Turni
// ---------------------------------------------------------------------------
function pesca(state: GameState, pid: PlayerId, conFatica = true) {
  const p = state.giocatori[pid];
  if (p.mazzo.length === 0) {
    if (conFatica) {
      p.fatica += 1;
      p.vita -= p.fatica;
      log(state, pid, `${p.nome} non ha più carte: subisce ${p.fatica} danni da fatica.`, 'danno');
      controllaVittoria(state);
    }
    return;
  }
  const c = p.mazzo.pop()!;
  if (p.mano.length >= MAX_MANO) {
    p.cimitero.push(c);
    log(state, pid, `${p.nome} ha la mano piena: ${carta(c.defId).nome} viene scartata.`, 'sistema');
  } else {
    p.mano.push(c);
  }
}

function inizioTurno(state: GameState) {
  state.turno += 1;
  const p = state.giocatori[state.attivo];
  p.cristalliMax = Math.min(CRISTALLI_MAX, p.cristalliMax + 1);
  p.cristalli = p.cristalliMax;
  for (const d of p.campo) {
    d.puoAttaccare = true;
    d.haAttaccato = false;
  }
  pesca(state, state.attivo);
  log(state, state.attivo, `Turno ${state.turno}: tocca a ${p.nome} (${p.cristalli} cristalli).`, 'sistema');
}

function fineTurno(state: GameState) {
  const p = state.giocatori[state.attivo];
  for (const d of p.campo) {
    if (d.keywords.includes('rigenerazione') && d.vita < d.vitaMax) {
      d.vita = Math.min(d.vitaMax, d.vita + 2);
    }
  }
  // Il congelamento scade alla fine del turno del proprietario che l'ha "subito"
  // (cioè il drago congelato salta esattamente una fase d'attacco)
  for (const d of p.campo) d.congelato = false;
  state.ultimoEvento = { tipo: 'fineTurno' };
  state.attivo = other(state.attivo);
  inizioTurno(state);
}

// ---------------------------------------------------------------------------
// Azioni legali
// ---------------------------------------------------------------------------
export function azioniLegali(state: GameState): Action[] {
  if (state.vincitore !== null) return [];
  const pid = state.attivo;
  const p = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  const azioni: Action[] = [];

  for (const c of p.mano) {
    const def = carta(c.defId);
    if (def.costo > p.cristalli) continue;
    if (def.kind === 'drago') {
      if (p.campo.length < MAX_CAMPO) azioni.push({ tipo: 'giocaDrago', uid: c.uid });
    } else {
      for (const b of bersagliIncantesimo(state, pid, def)) {
        azioni.push({ tipo: 'giocaIncantesimo', uid: c.uid, bersaglio: b });
      }
    }
  }

  const guardiani = avv.campo.filter((d) => d.keywords.includes('guardiano'));
  for (const d of p.campo) {
    if (!puoAttaccare(d)) continue;
    if (guardiani.length > 0) {
      for (const g of guardiani) azioni.push({ tipo: 'attacca', da: d.uid, a: g.uid });
    } else {
      for (const t of avv.campo) azioni.push({ tipo: 'attacca', da: d.uid, a: t.uid });
      azioni.push({ tipo: 'attacca', da: d.uid, a: 'giocatore' });
    }
  }
  azioni.push({ tipo: 'fineTurno' });
  return azioni;
}

export function puoAttaccare(d: DragonOnBoard): boolean {
  return d.puoAttaccare && !d.haAttaccato && !d.congelato && d.attacco > 0;
}

/** Bersagli validi per un incantesimo: uid di draghi, 'giocatore', oppure undefined se senza bersaglio. */
export function bersagliIncantesimo(state: GameState, pid: PlayerId, def: SpellDef): (number | 'giocatore' | undefined)[] {
  const p = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  const e = def.effetto;
  switch (e.tipo) {
    case 'danno':
      return e.bersaglio === 'drago' ? avv.campo.map((d) => d.uid) : ['giocatore'];
    case 'congela':
      return avv.campo.filter((d) => !d.congelato).map((d) => d.uid);
    case 'distruggi':
      return avv.campo.filter((d) => carta(d.defId).costo <= e.costoMax).map((d) => d.uid);
    case 'potenzia':
      return p.campo.map((d) => d.uid);
    case 'scudo':
      return p.campo.filter((d) => !d.scudo).map((d) => d.uid);
    case 'dannoTutti':
      return avv.campo.length > 0 ? [undefined] : [];
    case 'cura':
      return p.vita < VITA_INIZIALE ? [undefined] : [];
    case 'pesca':
      return p.mazzo.length > 0 ? [undefined] : [];
    case 'cristalli':
      return [undefined];
  }
}

// ---------------------------------------------------------------------------
// Applicazione azioni (muta lo stato passato: chiamare su una copia se serve)
// ---------------------------------------------------------------------------
export function clona(state: GameState): GameState {
  return structuredClone(state);
}

export function applica(state: GameState, azione: Action): GameState {
  const s = clona(state);
  applicaInPlace(s, azione);
  return s;
}

export function applicaInPlace(state: GameState, azione: Action): void {
  if (state.vincitore !== null) return;
  const pid = state.attivo;
  const p = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  state.ultimoEvento = null;

  switch (azione.tipo) {
    case 'giocaDrago': {
      const idx = p.mano.findIndex((c) => c.uid === azione.uid);
      if (idx < 0) throw new Error('Carta non in mano');
      const c = p.mano[idx];
      const def = carta(c.defId) as DragonDef;
      if (def.kind !== 'drago' || def.costo > p.cristalli || p.campo.length >= MAX_CAMPO) throw new Error('Mossa illegale');
      p.mano.splice(idx, 1);
      p.cristalli -= def.costo;
      const kw = def.keywords ?? [];
      p.campo.push({
        uid: c.uid, defId: c.defId, attacco: def.attacco, vita: def.vita, vitaMax: def.vita,
        puoAttaccare: kw.includes('carica'), haAttaccato: false, congelato: false,
        scudo: kw.includes('scudo'), keywords: kw.slice(), elemento: def.elemento,
      });
      state.ultimoEvento = { tipo: 'evoca', uid: c.uid };
      log(state, pid, `${p.nome} evoca ${def.nome} (${def.attacco}/${def.vita}).`, 'gioca');
      break;
    }
    case 'giocaIncantesimo': {
      const idx = p.mano.findIndex((c) => c.uid === azione.uid);
      if (idx < 0) throw new Error('Carta non in mano');
      const c = p.mano[idx];
      const def = carta(c.defId) as SpellDef;
      if (def.kind !== 'incantesimo' || def.costo > p.cristalli) throw new Error('Mossa illegale');
      p.mano.splice(idx, 1);
      p.cristalli -= def.costo;
      p.cimitero.push(c);
      risolviIncantesimo(state, pid, def, azione.bersaglio);
      break;
    }
    case 'attacca': {
      const att = p.campo.find((d) => d.uid === azione.da);
      if (!att || !puoAttaccare(att)) throw new Error('Attaccante non valido');
      const guardiani = avv.campo.filter((d) => d.keywords.includes('guardiano'));
      if (azione.a === 'giocatore') {
        if (guardiani.length > 0) throw new Error('Devi attaccare un Guardiano');
        att.haAttaccato = true;
        avv.vita -= att.attacco;
        state.ultimoEvento = { tipo: 'attacco', da: att.uid, a: 'giocatore', danno: att.attacco, vantaggio: 0 };
        log(state, pid, `${carta(att.defId).nome} attacca ${avv.nome}: ${att.attacco} danni.`, 'attacco');
      } else {
        const dif = avv.campo.find((d) => d.uid === azione.a);
        if (!dif) throw new Error('Bersaglio non valido');
        if (guardiani.length > 0 && !dif.keywords.includes('guardiano')) throw new Error('Devi attaccare un Guardiano');
        att.haAttaccato = true;
        const v = vantaggio(att.elemento, dif.elemento);
        const dannoA = dannoElementale(att.attacco, v);
        const dannoD = dannoElementale(dif.attacco, vantaggio(dif.elemento, att.elemento));
        const infl = infliggi(dif, dannoA);
        const sub = infliggi(att, dannoD);
        state.ultimoEvento = { tipo: 'attacco', da: att.uid, a: dif.uid, danno: infl, vantaggio: v };
        const vTxt = v === 1 ? ' (vantaggio!)' : v === -1 ? ' (svantaggio)' : '';
        log(state, pid, `${carta(att.defId).nome} attacca ${carta(dif.defId).nome}${vTxt}: infligge ${infl}, subisce ${sub}.`, 'attacco');
        rimuoviMorti(state);
      }
      break;
    }
    case 'fineTurno':
      fineTurno(state);
      return;
  }
  controllaVittoria(state);
}

/** Applica danno tenendo conto dello Scudo. Ritorna il danno effettivo. */
function infliggi(d: DragonOnBoard, danno: number): number {
  if (danno <= 0) return 0;
  if (d.scudo) {
    d.scudo = false;
    return 0;
  }
  d.vita -= danno;
  return danno;
}

function rimuoviMorti(state: GameState) {
  for (const p of state.giocatori) {
    const morti = p.campo.filter((d) => d.vita <= 0);
    for (const m of morti) {
      p.cimitero.push({ uid: m.uid, defId: m.defId });
      log(state, p.id, `${carta(m.defId).nome} viene distrutto.`, 'morte');
    }
    p.campo = p.campo.filter((d) => d.vita > 0);
  }
}

function risolviIncantesimo(state: GameState, pid: PlayerId, def: SpellDef, bersaglio: number | 'giocatore' | undefined) {
  const p = state.giocatori[pid];
  const avv = state.giocatori[other(pid)];
  const e = def.effetto;
  const nome = def.nome;
  const el = def.elemento;
  const trova = (lista: DragonOnBoard[]) => {
    const d = lista.find((x) => x.uid === bersaglio);
    if (!d) throw new Error('Bersaglio incantesimo non valido');
    return d;
  };
  state.ultimoEvento = { tipo: 'incantesimo', carta: def.id, a: bersaglio ?? (e.tipo === 'dannoTutti' ? 'tutti' : null) };

  switch (e.tipo) {
    case 'danno': {
      if (e.bersaglio === 'giocatore') {
        avv.vita -= e.valore;
        log(state, pid, `${p.nome} lancia ${nome}: ${e.valore} danni a ${avv.nome}.`, 'incantesimo');
      } else {
        const d = trova(avv.campo);
        const danno = dannoElementale(e.valore, vantaggio(el, d.elemento));
        const infl = infliggi(d, danno);
        log(state, pid, `${p.nome} lancia ${nome} su ${carta(d.defId).nome}: ${infl} danni.`, 'incantesimo');
        rimuoviMorti(state);
      }
      break;
    }
    case 'dannoTutti': {
      for (const d of avv.campo) infliggi(d, dannoElementale(e.valore, vantaggio(el, d.elemento)));
      log(state, pid, `${p.nome} lancia ${nome} su tutti i draghi avversari.`, 'incantesimo');
      rimuoviMorti(state);
      break;
    }
    case 'cura':
      p.vita = Math.min(VITA_INIZIALE, p.vita + e.valore);
      log(state, pid, `${p.nome} lancia ${nome} e recupera ${e.valore} vita.`, 'incantesimo');
      break;
    case 'potenzia': {
      const d = trova(p.campo);
      d.attacco += e.attacco;
      d.vita += e.vita;
      d.vitaMax += e.vita;
      log(state, pid, `${p.nome} lancia ${nome} su ${carta(d.defId).nome} (+${e.attacco}/+${e.vita}).`, 'incantesimo');
      break;
    }
    case 'pesca':
      for (let i = 0; i < e.valore; i++) pesca(state, pid);
      log(state, pid, `${p.nome} lancia ${nome} e pesca ${e.valore} carte.`, 'incantesimo');
      break;
    case 'distruggi': {
      const d = trova(avv.campo);
      d.vita = 0;
      log(state, pid, `${p.nome} lancia ${nome}: ${carta(d.defId).nome} viene distrutto.`, 'incantesimo');
      rimuoviMorti(state);
      break;
    }
    case 'congela': {
      const d = trova(avv.campo);
      d.congelato = true;
      log(state, pid, `${p.nome} lancia ${nome}: ${carta(d.defId).nome} è congelato.`, 'incantesimo');
      break;
    }
    case 'scudo': {
      const d = trova(p.campo);
      d.scudo = true;
      log(state, pid, `${p.nome} lancia ${nome} su ${carta(d.defId).nome}.`, 'incantesimo');
      break;
    }
    case 'cristalli':
      p.cristalli += e.valore;
      log(state, pid, `${p.nome} lancia ${nome}: +${e.valore} cristallo.`, 'incantesimo');
      break;
  }
}

function controllaVittoria(state: GameState) {
  if (state.vincitore !== null) return;
  const [a, b] = state.giocatori;
  if (a.vita <= 0 && b.vita <= 0) state.vincitore = other(state.attivo); // chi ha agito perde in caso di doppio KO
  else if (b.vita <= 0) state.vincitore = 0;
  else if (a.vita <= 0) state.vincitore = 1;
  if (state.vincitore !== null) {
    log(state, state.vincitore, `${state.giocatori[state.vincitore].nome} vince la partita!`, 'sistema');
  }
}

export function nomeElemento(e: Element | 'neutro'): string {
  return e === 'neutro' ? 'Neutro' : ELEMENTI[e].nome;
}
