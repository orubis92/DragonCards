import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, GameState, PlayerId, SpellDef, CardDef, Element } from '../engine/types';
import { MAX_CAMPO } from '../engine/types';
import { applica, azioniLegali, bersagliIncantesimo, nuovaPartita, puoAttaccare } from '../engine/rules';
import { scegliAzione, type Livello, type Profilo, PROFILI } from '../engine/ai';
import { carta, ELEMENTI, KEYWORD_INFO, vantaggio, testoTrigger } from '../engine/cards';
import type { Boss } from '../engine/campagna';
import { Carta, CartaRetro, COLORE_ELEMENTO } from './Carta';
import { Icon } from './Icon';
import { suona } from '../audio';
import { LivelloEffetti, SfondoVivo, useEffetti, type NuovoEffetto, type Punto } from './Effetti';

/** Impostazioni persistenti scelte nel menu. */
export interface ConfigPartita {
  nomeGiocatore: string;
  mazzoGiocatore: string;
  mazzoIA: string;
  livello: Livello;
  suoni: boolean;
  veloce: boolean;
  tutorialFatto: boolean;
}

/** Parametri di una singola partita (menu, campagna o tutorial). */
export interface SetupPartita {
  nomeGiocatore: string;
  nomeIA: string;
  mazzoIo: string | string[];
  mazzoIA: string | string[];
  livello: Livello;
  profilo: Profilo;
  vita?: [number, number];
  seed?: number;
  tutorial?: boolean;
  boss?: Boss;
}

interface Props {
  setup: SetupPartita;
  suoni: boolean;
  veloce: boolean;
  onFine: (vinto: boolean) => void;
  onEsci: () => void;
}

type Selezione = { tipo: 'mano'; uid: number } | { tipo: 'campo'; uid: number } | null;

interface Fx { id: number; evento: GameState['ultimoEvento']; chi: PlayerId; affondo?: { uid: number; dx: number; dy: number } }

const IO: PlayerId = 0;
const IA: PlayerId = 1;

/** Nel tutorial cerchiamo un seme in cui il giocatore inizia e ha un drago da 1 in mano. */
function semeTutorial(setup: SetupPartita): number {
  for (let seed = 1; seed < 500; seed++) {
    const s = nuovaPartita({ nomi: ['a', 'b'], mazzi: [setup.mazzoIo, setup.mazzoIA], seed, iniziaPer: 0 });
    const mano = s.giocatori[0].mano.map((c) => carta(c.defId));
    if (mano.some((c) => c.kind === 'drago' && c.costo === 1) && mano.some((c) => c.kind === 'drago' && c.costo === 2) && mano.some((c) => c.kind === 'incantesimo')) return seed;
  }
  return 1;
}

function creaPartita(setup: SetupPartita): GameState {
  const seed = setup.tutorial ? semeTutorial(setup) : setup.seed;
  return nuovaPartita({ nomi: [setup.nomeGiocatore, setup.nomeIA], mazzi: [setup.mazzoIo, setup.mazzoIA], vita: setup.vita, seed, iniziaPer: setup.tutorial ? 0 : undefined });
}

export function Partita({ setup, suoni, veloce, onFine, onEsci }: Props) {
  const [state, setState] = useState<GameState>(() => creaPartita(setup));
  const [sel, setSel] = useState<Selezione>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [mostraLog, setMostraLog] = useState(false);
  const [dettaglio, setDettaglio] = useState<{ def: CardDef; campo?: GameState['giocatori'][0]['campo'][0] } | null>(null);
  const [pensa, setPensa] = useState(false);
  const [confermaUscita, setConfermaUscita] = useState(false);
  const [suggerimentiChiusi, setSuggerimentiChiusi] = useState<Set<string>>(new Set());
  const [scrollMano, setScrollMano] = useState({ sx: false, dx: false });
  const fxId = useRef(0);
  const fineNotificata = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const contenitore = useRef<HTMLDivElement>(null);
  const manoRef = useRef<HTMLElement>(null);
  const { effetti, aggiungi } = useEffetti();
  const [scossa, setScossa] = useState(false);

  const io = state.giocatori[IO];
  const ia = state.giocatori[IA];
  const mioTurno = state.attivo === IO && state.vincitore === null;
  const legali = useMemo(() => azioniLegali(state), [state]);

  /** Centro di un elemento del tabellone in coordinate del contenitore. */
  const centro = useCallback((selettore: string): { p: Punto; w: number; h: number } | null => {
    const root = contenitore.current;
    const el = root?.querySelector<HTMLElement>(selettore);
    if (!root || !el) return null;
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return { p: { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }, w: r.width, h: r.height };
  }, []);

  const esegui = useCallback((azione: Action, chi: PlayerId) => {
    const s = stateRef.current;
    // Misura il tabellone PRIMA di applicare la mossa (i draghi distrutti spariscono dallo stato)
    const posizioni = new Map<number, { p: Punto; w: number; h: number }>();
    for (const g of s.giocatori) for (const d of g.campo) { const c = centro(`[data-uid="${d.uid}"]`); if (c) posizioni.set(d.uid, c); }
    const ritratti: Record<PlayerId, Punto | null> = { 0: centro('[data-ritratto="0"]')?.p ?? null, 1: centro('[data-ritratto="1"]')?.p ?? null };
    const origineMano = centro(`[data-mano="${chi}"]`)?.p ?? ritratti[chi];
    const avvId: PlayerId = chi === IO ? IA : IO;

    const ns = applica(s, azione);
    const ev = ns.ultimoEvento;
    const nuovi: NuovoEffetto[] = [];
    let affondo: Fx['affondo'];
    let ritardati: (() => NuovoEffetto[]) | null = null;
    const elDi = (uid: number): Element | 'neutro' => s.giocatori.flatMap((g) => g.campo).find((d) => d.uid === uid)?.elemento ?? 'neutro';
    const larg = contenitore.current?.clientWidth ?? 400;
    const clampX = (x: number) => Math.min(Math.max(x, 80), larg - 80);
    let elAzione: Element | 'neutro' = 'neutro';
    let bersaglioPrincipale: number | 'giocatore' | null = null;
    let ritardoDiff = 0;

    if (ev?.tipo === 'attacco') {
      elAzione = elDi(ev.da);
      bersaglioPrincipale = ev.a;
      const da = posizioni.get(ev.da);
      const a = ev.a === 'giocatore' ? ritratti[avvId] : posizioni.get(ev.a)?.p ?? null;
      if (da && a) {
        affondo = { uid: ev.da, dx: (a.x - da.p.x) * 0.6, dy: (a.y - da.p.y) * 0.6 };
        nuovi.push({ tipo: 'esplosione', a, elemento: elAzione, forte: ev.vantaggio > 0 });
        if (ev.a !== 'giocatore' && ev.vantaggio !== 0) {
          nuovi.push({ tipo: 'testo', a: { x: clampX(a.x), y: a.y - 40 }, testo: ev.vantaggio > 0 ? 'Super efficace!' : 'Poco efficace…', classe: ev.vantaggio > 0 ? 'super' : 'poco' });
        }
        if (ev.a === 'giocatore' && chi === IA) setScossa(true);
      }
      if (suoni) suona('attacco', elAzione);
      ritardoDiff = 250;
    } else if (ev?.tipo === 'incantesimo') {
      const def = carta(ev.carta);
      elAzione = def.elemento;
      bersaglioPrincipale = ev.a === 'tutti' ? null : ev.a;
      // bersagli come "riferimenti": rimisurati al momento dell'impatto, perché nel frattempo il layout può cambiare
      const bersagli: (number | 'giocatore')[] = [];
      if (ev.a === 'giocatore') bersagli.push('giocatore');
      else if (ev.a === 'tutti') for (const d of s.giocatori[avvId].campo) bersagli.push(d.uid);
      else if (typeof ev.a === 'number') bersagli.push(ev.a);
      const posizioneDi = (b: number | 'giocatore'): Punto | null =>
        b === 'giocatore' ? (centro(`[data-ritratto="${avvId}"]`)?.p ?? ritratti[avvId]) : (centro(`[data-uid="${b}"]`)?.p ?? posizioni.get(b)?.p ?? null);
      const effetto = def.kind === 'incantesimo' ? def.effetto.tipo : 'danno';
      if (effetto === 'cura') {
        const r = ritratti[chi]; if (r) nuovi.push({ tipo: 'cura', a: r });
        if (suoni) suona('cura');
      } else if (effetto === 'pesca' || effetto === 'cristalli') {
        const r = ritratti[chi]; if (r) nuovi.push({ tipo: 'evocazione', a: r, elemento: 'ghiaccio' });
        if (suoni) suona('turno');
      } else {
        const benefico = effetto === 'potenzia' || effetto === 'scudo';
        for (const b of bersagli) {
          const a = posizioneDi(b);
          if (origineMano && a) nuovi.push({ tipo: 'proiettile', da: origineMano, a, elemento: def.elemento });
        }
        ritardati = () => bersagli.flatMap((b): NuovoEffetto[] => {
          const a = posizioneDi(b);
          if (!a) return [];
          return [benefico ? { tipo: 'cura', a } : { tipo: 'esplosione', a, elemento: def.elemento, forte: effetto === 'distruggi' || effetto === 'dannoTutti' }];
        });
        if (ev.a === 'giocatore' && chi === IA) setTimeout(() => setScossa(true), 380);
        if (suoni) suona(benefico ? 'cura' : 'incantesimo', def.elemento);
        if (ev.a === 'tutti') bersaglioPrincipale = -1; // tutti i draghi avversari: già coperti
      }
      ritardoDiff = 400;
    } else if (ev?.tipo === 'evoca') {
      // il drago non è ancora nel DOM: l'effetto viene posizionato nel prossimo frame
      const uid = ev.uid;
      const evocato = ns.giocatori[chi].campo.find((d) => d.uid === uid);
      elAzione = evocato?.elemento ?? 'fuoco';
      requestAnimationFrame(() => { const c = centro(`[data-uid="${uid}"]`); if (c) aggiungi([{ tipo: 'evocazione', a: c.p, elemento: evocato?.elemento ?? 'fuoco' }]); });
      if (suoni) suona('evoca');
      ritardoDiff = 350;
    } else if (ev?.tipo === 'fineTurno') {
      if (suoni) suona('turno');
    }

    // ---- Effetti derivati dalle differenze di stato (trigger di Evocazione/Morte, contrattacchi) ----
    const derivati: NuovoEffetto[] = [];
    let morti = 0;
    for (const g of s.giocatori) {
      for (const d of g.campo) {
        const dopo = ns.giocatori[g.id].campo.find((x) => x.uid === d.uid);
        const c = posizioni.get(d.uid);
        if (!c) continue;
        if (!dopo) {
          // Drago distrutto: fantasma che si frantuma nella posizione che aveva
          nuovi.push({ tipo: 'fantasma', a: { x: c.p.x - c.w / 2, y: c.p.y - c.h / 2 }, w: c.w, h: c.h, def: carta(d.defId), drago: { ...d, vita: 0 } });
          morti++;
          continue;
        }
        const colpitoDaAzione = bersaglioPrincipale === d.uid || (bersaglioPrincipale === -1 && g.id === avvId) || (ev?.tipo === 'attacco' && ev.da === d.uid);
        if (dopo.vita < d.vita && !colpitoDaAzione) derivati.push({ tipo: 'esplosione', a: c.p, elemento: elAzione, forte: false });
        if ((dopo.attacco > d.attacco || dopo.vitaMax > d.vitaMax || (dopo.scudo && !d.scudo)) && bersaglioPrincipale !== d.uid) derivati.push({ tipo: 'cura', a: c.p });
        if (dopo.congelato && !d.congelato && bersaglioPrincipale !== d.uid) derivati.push({ tipo: 'esplosione', a: c.p, elemento: 'ghiaccio', forte: false });
      }
      // Vita del giocatore cambiata per un effetto non diretto
      const prima = g.vita, dopo = ns.giocatori[g.id].vita;
      const r = ritratti[g.id];
      if (r && dopo < prima && bersaglioPrincipale !== 'giocatore' && ev?.tipo !== 'fineTurno') {
        derivati.push({ tipo: 'esplosione', a: r, elemento: elAzione, forte: false });
        if (g.id === IO) setTimeout(() => setScossa(true), ritardoDiff);
      }
      if (r && dopo > prima && ev?.tipo !== 'incantesimo') derivati.push({ tipo: 'cura', a: r });
    }
    // Token evocati da un effetto: anello dopo il render
    for (const d of ns.giocatori[chi].campo) {
      if (!s.giocatori[chi].campo.some((x) => x.uid === d.uid) && !(ev?.tipo === 'evoca' && ev.uid === d.uid)) {
        const uid = d.uid, el = d.elemento;
        setTimeout(() => { const c = centro(`[data-uid="${uid}"]`); if (c) aggiungi([{ tipo: 'evocazione', a: c.p, elemento: el }]); }, 60);
      }
    }
    if (morti > 0 && suoni) setTimeout(() => suona('morte'), 150);

    // Il proiettile deve arrivare prima dell'impatto: gli effetti d'impatto vengono creati (e posizionati) dopo
    aggiungi(nuovi);
    if (ritardati) { const f = ritardati; setTimeout(() => aggiungi(f()), 380); }
    if (derivati.length) {
      const elSuono = elAzione;
      setTimeout(() => { aggiungi(derivati); if (suoni && derivati.some((d) => d.tipo === 'esplosione')) suona('colpo', elSuono); }, ritardoDiff);
    }

    if (ev) {
      fxId.current += 1;
      setFx({ id: fxId.current, evento: ev, chi, affondo });
    }
    stateRef.current = ns;
    setState(ns);
    setSel(null);
  }, [suoni, centro, aggiungi]);

  useEffect(() => {
    if (!scossa) return;
    const t = setTimeout(() => setScossa(false), 500);
    return () => clearTimeout(t);
  }, [scossa]);

  // Turno dell'IA: una azione ogni ~750 ms (250 in modalità veloce)
  useEffect(() => {
    if (state.vincitore !== null || state.attivo !== IA) { setPensa(false); return; }
    setPensa(true);
    const base = veloce ? 260 : 750;
    const t = setTimeout(() => {
      const a = scegliAzione(state, setup.livello, Math.random, setup.profilo);
      esegui(a, IA);
    }, state.ultimoEvento?.tipo === 'fineTurno' ? base + 150 : base);
    return () => clearTimeout(t);
  }, [state, setup.livello, setup.profilo, veloce, esegui]);

  // Fine partita
  useEffect(() => {
    if (state.vincitore !== null && !fineNotificata.current) {
      fineNotificata.current = true;
      if (suoni) suona(state.vincitore === IO ? 'vittoria' : 'sconfitta');
      onFine(state.vincitore === IO);
    }
  }, [state.vincitore, onFine, suoni]);

  // Pulisci l'effetto dopo l'animazione
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx((f) => (f?.id === fx.id ? null : f)), 900);
    return () => clearTimeout(t);
  }, [fx]);

  // Indicatori di scorrimento della mano
  useEffect(() => {
    const el = manoRef.current;
    if (!el) return;
    const agg = () => setScrollMano({ sx: el.scrollLeft > 4, dx: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    agg();
    el.addEventListener('scroll', agg, { passive: true });
    window.addEventListener('resize', agg);
    return () => { el.removeEventListener('scroll', agg); window.removeEventListener('resize', agg); };
  }, [io.mano.length]);

  // ---- Interazione ----
  const cartaSel = sel?.tipo === 'mano' ? io.mano.find((c) => c.uid === sel.uid) : undefined;
  const defSel = cartaSel ? carta(cartaSel.defId) : undefined;
  const dragoSel = sel?.tipo === 'campo' ? io.campo.find((d) => d.uid === sel.uid) : undefined;

  // Bersagli validi per la selezione corrente
  const bersagli = useMemo(() => {
    const set = new Set<number | 'giocatore'>();
    if (!mioTurno) return set;
    if (defSel?.kind === 'incantesimo') {
      for (const b of bersagliIncantesimo(state, IO, defSel)) if (b !== undefined) set.add(b);
    } else if (dragoSel && puoAttaccare(dragoSel)) {
      for (const a of legali) if (a.tipo === 'attacca' && a.da === dragoSel.uid) set.add(a.a);
    }
    return set;
  }, [defSel, dragoSel, legali, mioTurno, state]);

  const richiedeBersaglio = defSel?.kind === 'incantesimo' && bersagliIncantesimo(state, IO, defSel).some((b) => b !== undefined);

  function tapMano(uid: number) {
    if (!mioTurno) return;
    if (sel?.tipo === 'mano' && sel.uid === uid) { setSel(null); return; }
    setSel({ tipo: 'mano', uid });
  }

  function giocaSelezionata() {
    if (!cartaSel || !defSel) return;
    if (defSel.kind === 'drago') {
      if (legali.some((a) => a.tipo === 'giocaDrago' && a.uid === cartaSel.uid)) esegui({ tipo: 'giocaDrago', uid: cartaSel.uid }, IO);
    } else if (!richiedeBersaglio) {
      if (legali.some((a) => a.tipo === 'giocaIncantesimo' && a.uid === cartaSel.uid)) esegui({ tipo: 'giocaIncantesimo', uid: cartaSel.uid }, IO);
    }
  }

  function tapMioDrago(uid: number) {
    const d = io.campo.find((x) => x.uid === uid)!;
    if (defSel?.kind === 'incantesimo' && bersagli.has(uid)) {
      esegui({ tipo: 'giocaIncantesimo', uid: cartaSel!.uid, bersaglio: uid }, IO);
      return;
    }
    if (sel?.tipo === 'campo' && sel.uid === uid) { setSel(null); return; }
    if (mioTurno && puoAttaccare(d)) setSel({ tipo: 'campo', uid });
    else setDettaglio({ def: carta(d.defId), campo: d });
  }

  function tapDragoIA(uid: number) {
    if (bersagli.has(uid)) {
      if (dragoSel) esegui({ tipo: 'attacca', da: dragoSel.uid, a: uid }, IO);
      else if (cartaSel) esegui({ tipo: 'giocaIncantesimo', uid: cartaSel.uid, bersaglio: uid }, IO);
      return;
    }
    const d = ia.campo.find((x) => x.uid === uid)!;
    setDettaglio({ def: carta(d.defId), campo: d });
  }

  function tapGiocatoreIA() {
    if (!bersagli.has('giocatore')) return;
    if (dragoSel) esegui({ tipo: 'attacca', da: dragoSel.uid, a: 'giocatore' }, IO);
    else if (cartaSel) esegui({ tipo: 'giocaIncantesimo', uid: cartaSel.uid, bersaglio: 'giocatore' }, IO);
  }

  const giocabile = (uid: number) => legali.some((a) => (a.tipo === 'giocaDrago' || a.tipo === 'giocaIncantesimo') && a.uid === uid);
  const ultimoLog = state.log[state.log.length - 1];
  const haMosse = legali.some((a) => a.tipo !== 'fineTurno');

  // Anteprima del vantaggio quando si sta scegliendo un bersaglio
  const elSel = dragoSel?.elemento ?? (defSel?.kind === 'incantesimo' ? defSel.elemento : undefined);

  // ---- Tutorial: suggerimenti contestuali ----
  const suggerimento = useMemo(() => {
    if (!setup.tutorial || !mioTurno || state.vincitore !== null) return null;
    const puoAtt = io.campo.some(puoAttaccare);
    const haDrago = legali.some((a) => a.tipo === 'giocaDrago');
    const haInc = legali.some((a) => a.tipo === 'giocaIncantesimo');
    const guardiano = ia.campo.some((d) => d.keywords.includes('guardiano'));
    const lista: { id: string; testo: string; quando: boolean }[] = [
      { id: 'evoca', quando: haDrago && io.campo.length === 0, testo: 'Tocca un drago in mano e premi Evoca. Il numero nel cerchio viola è il costo in cristalli: ne ottieni uno in più a ogni turno.' },
      { id: 'guardiano', quando: puoAtt && guardiano, testo: 'Il drago avversario con "Guardiano" va attaccato per primo: finché è in campo protegge gli altri e il giocatore.' },
      { id: 'faccia', quando: puoAtt && ia.campo.length === 0, testo: 'Il campo avversario è vuoto: tocca il tuo drago con il pallino dorato, poi il ritratto dell\'IA per colpirla direttamente.' },
      { id: 'attacca', quando: puoAtt, testo: 'I draghi attaccano dal turno successivo all\'evocazione. Tocca quello con il pallino dorato, poi un bersaglio: Fuoco batte Ghiaccio, Ghiaccio batte Terra, Terra batte Fuoco (+1 danno, "Super efficace").' },
      { id: 'incantesimo', quando: haInc, testo: 'Le carte senza attacco e vita sono incantesimi: si usano subito. Tocca la carta e poi il bersaglio, se ne richiede uno.' },
      { id: 'fine', quando: !haMosse, testo: 'Non hai altre mosse: premi Fine turno. L\'IA giocherà il suo turno da sola.' },
    ];
    return lista.find((s) => s.quando && !suggerimentiChiusi.has(s.id)) ?? null;
  }, [setup.tutorial, mioTurno, state.vincitore, io.campo, ia.campo, legali, haMosse, suggerimentiChiusi]);

  const vinto = state.vincitore === IO;
  const vitaMaxIo = state.vitaMax[IO], vitaMaxIa = state.vitaMax[IA];

  return (
    <div ref={contenitore} className={`partita ${sel ? 'in-selezione' : ''} ${scossa ? 'scossa' : ''}`} onClick={() => sel && setSel(null)}>
      <SfondoVivo />
      {/* ---- Avversario ---- */}
      <header className="barra barra-ia">
        <button className="btn-icona" onClick={(e) => { e.stopPropagation(); if (state.vincitore !== null) onEsci(); else setConfermaUscita(true); }} title="Abbandona">✕</button>
        <Ritratto id={IA} nome={ia.nome} vita={ia.vita} vitaMax={vitaMaxIa} cristalli={ia.cristalli} cristalliMax={ia.cristalliMax} mano={ia.mano.length} mazzo={ia.mazzo.length}
          attivo={state.attivo === IA} bersagliabile={bersagli.has('giocatore')} colpito={fx?.evento?.tipo === 'attacco' && fx.evento.a === 'giocatore' && fx.chi === IO ? fx.evento.danno : (fx?.evento?.tipo === 'incantesimo' && fx.evento.a === 'giocatore' && fx.chi === IO) ? 1 : 0}
          onClick={(e) => { e.stopPropagation(); tapGiocatoreIA(); }} />
        <div className="mano-ia" data-mano="1" aria-label={`${ia.mano.length} carte in mano`}>
          {ia.mano.map((c, i) => <CartaRetro key={c.uid} className="mini" style={{ marginLeft: i ? -18 : 0 }} />)}
        </div>
      </header>

      <section className="campo campo-ia">
        {ia.campo.map((d) => {
          const v = elSel && bersagli.has(d.uid) ? vantaggio(elSel, d.elemento) : 0;
          return (
            <div key={d.uid} data-uid={d.uid} className={`slot el-${d.elemento} ${classiFx(fx, d.uid, IA)}`} style={stileAffondo(fx, d.uid)} onClick={(e) => { e.stopPropagation(); tapDragoIA(d.uid); }}>
              <Carta def={carta(d.defId)} suCampo={d} piccola bersagliabile={bersagli.has(d.uid)} />
              {v !== 0 && <span className={`vantaggio ${v > 0 ? 'su' : 'giu'}`}>{v > 0 ? '+1' : '−1'}</span>}
              <NumeroDanno fx={fx} uid={d.uid} />
            </div>
          );
        })}
        {ia.campo.length === 0 && <div className="campo-vuoto">Nessun drago</div>}
      </section>

      {/* ---- Centro ---- */}
      <div className="centro" onClick={(e) => e.stopPropagation()}>
        <button className="log-riga" onClick={() => setMostraLog(true)}>
          {pensa && <span className="pensa" />}
          <span>{ultimoLog?.testo}</span>
        </button>
        {sel && (
          <div className="suggerimento">
            {dragoSel && 'Tocca un drago avversario o il suo ritratto per attaccare'}
            {defSel?.kind === 'incantesimo' && richiedeBersaglio && 'Tocca il bersaglio dell\'incantesimo'}
            {defSel && !richiedeBersaglio && (
              <button className="btn primario" disabled={!giocabile(cartaSel!.uid)} onClick={giocaSelezionata}>
                {defSel.kind === 'drago' ? 'Evoca' : 'Lancia'} · {defSel.costo} <Icon nome="crystal-bars" size="1em" />
              </button>
            )}
          </div>
        )}
        {suggerimento && !sel && (
          <div className="tutorial-hint">
            <Icon nome="graduate-cap" size="1.2em" />
            <span>{suggerimento.testo}</span>
            <button className="btn" onClick={() => setSuggerimentiChiusi((s) => new Set(s).add(suggerimento.id))}>Ok</button>
          </div>
        )}
      </div>

      {/* ---- Io ---- */}
      <section className="campo campo-io">
        {io.campo.map((d) => (
          <div key={d.uid} data-uid={d.uid} className={`slot el-${d.elemento} ${classiFx(fx, d.uid, IO)} ${sel?.tipo === 'campo' && sel.uid === d.uid ? 'sel' : ''}`}
            style={stileAffondo(fx, d.uid)} onClick={(e) => { e.stopPropagation(); tapMioDrago(d.uid); }}>
            <Carta def={carta(d.defId)} suCampo={d} piccola selezionata={sel?.tipo === 'campo' && sel.uid === d.uid}
              bersagliabile={bersagli.has(d.uid)} disabilitata={mioTurno && !puoAttaccare(d) && !bersagli.has(d.uid)} />
            {mioTurno && puoAttaccare(d) && !sel && <span className="pronto" />}
            <NumeroDanno fx={fx} uid={d.uid} />
          </div>
        ))}
        {Array.from({ length: MAX_CAMPO - io.campo.length }).map((_, i) => <div key={`v${i}`} className="slot vuoto" />)}
      </section>

      <footer className="barra barra-io" onClick={(e) => e.stopPropagation()}>
        <Ritratto id={IO} nome={io.nome} vita={io.vita} vitaMax={vitaMaxIo} cristalli={io.cristalli} cristalliMax={io.cristalliMax} mano={io.mano.length} mazzo={io.mazzo.length}
          attivo={mioTurno} colpito={fx?.chi === IA && ((fx.evento?.tipo === 'attacco' && fx.evento.a === 'giocatore') || (fx.evento?.tipo === 'incantesimo' && fx.evento.a === 'giocatore')) ? 1 : 0} />
        <button className={`btn fine-turno ${mioTurno && !haMosse ? 'lampeggia' : ''}`} disabled={!mioTurno} onClick={() => esegui({ tipo: 'fineTurno' }, IO)}>
          {mioTurno ? 'Fine turno' : 'Turno IA…'}
        </button>
      </footer>

      <div className={`mano-contenitore ${scrollMano.sx ? 'scroll-sx' : ''} ${scrollMano.dx ? 'scroll-dx' : ''}`}>
        <section className="mano" data-mano="0" ref={manoRef} onClick={(e) => e.stopPropagation()}>
          {io.mano.map((c) => {
            const def = carta(c.defId);
            return (
              <Carta key={c.uid} def={def} selezionata={sel?.tipo === 'mano' && sel.uid === c.uid}
                disabilitata={mioTurno && !giocabile(c.uid)} onClick={() => tapMano(c.uid)} />
            );
          })}
          {io.mano.length === 0 && <div className="campo-vuoto">Mano vuota</div>}
        </section>
        {scrollMano.dx && <span className="mano-freccia dx" onClick={() => manoRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}>›</span>}
        {scrollMano.sx && <span className="mano-freccia sx" onClick={() => manoRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}>‹</span>}
      </div>

      <LivelloEffetti effetti={effetti} />

      {/* ---- Overlay ---- */}
      {mostraLog && (
        <div className="overlay" onClick={() => setMostraLog(false)}>
          <div className="pannello log" onClick={(e) => e.stopPropagation()}>
            <h3>Cronologia</h3>
            <ul>{state.log.slice().reverse().map((l, i) => <li key={i} className={`log-${l.tipo} chi-${l.chi}`}>{l.testo}</li>)}</ul>
            <button className="btn" onClick={() => setMostraLog(false)}>Chiudi</button>
          </div>
        </div>
      )}
      {dettaglio && (
        <div className="overlay" onClick={() => setDettaglio(null)}>
          <div className="pannello dettaglio" onClick={(e) => e.stopPropagation()}>
            <Carta def={dettaglio.def} suCampo={dettaglio.campo} className="grande" />
            <DescrizioneCarta def={dettaglio.def} />
            <button className="btn" onClick={() => setDettaglio(null)}>Chiudi</button>
          </div>
        </div>
      )}
      {confermaUscita && (
        <div className="overlay" onClick={() => setConfermaUscita(false)}>
          <div className="pannello risultato" onClick={(e) => e.stopPropagation()}>
            <h3>Abbandonare la partita?</h3>
            <p className="muted">La partita in corso andrà persa{setup.boss ? ' (la campagna non avanza)' : ''}.</p>
            <div className="riga-btn">
              <button className="btn" onClick={() => setConfermaUscita(false)}>Continua a giocare</button>
              <button className="btn primario" onClick={onEsci}>Abbandona</button>
            </div>
          </div>
        </div>
      )}
      {sel?.tipo === 'mano' && defSel && (
        <div className={`anteprima ${defSel.kind === 'incantesimo' && ['potenzia', 'scudo'].includes(defSel.effetto.tipo) ? 'alto' : ''}`} onClick={(e) => e.stopPropagation()}>
          <Carta def={defSel} className="grande" />
          <DescrizioneCarta def={defSel} />
        </div>
      )}
      {state.vincitore !== null && (
        <div className="overlay fine">
          <div className={`pannello risultato ${vinto ? 'vittoria' : 'sconfitta'}`}>
            <Icon nome={vinto ? 'trophy' : 'skull'} size={72} />
            <h2>{vinto ? 'Vittoria!' : 'Sconfitta'}</h2>
            <p>{vinto ? `Hai sconfitto ${ia.nome} in ${state.turno} turni.` : `${ia.nome} ha avuto la meglio dopo ${state.turno} turni.`}</p>
            {setup.boss && vinto && setup.boss.ricompensa.length > 0 && (
              <div className="ricompensa">
                <div className="muted">Carte sbloccate per il deck builder</div>
                <div className="griglia-carte">{setup.boss.ricompensa.map((id) => <Carta key={id} def={carta(id)} piccola />)}</div>
              </div>
            )}
            {setup.boss && vinto && setup.boss.ricompensa.length === 0 && <p className="oro">Hai completato la campagna! Tutte le carte sono sbloccate.</p>}
            {setup.tutorial && <p className="muted">Tutorial completato: ora conosci le basi. Nel menu trovi la campagna e il deck builder.</p>}
            <div className="riga-btn">
              <button className="btn" onClick={onEsci}>{setup.boss ? 'Campagna' : 'Menu'}</button>
              {!setup.tutorial && <button className="btn primario" onClick={() => { fineNotificata.current = false; setSuggerimentiChiusi(new Set()); setState(creaPartita({ ...setup, seed: undefined })); }}>{vinto ? 'Rigioca' : 'Riprova'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function classiFx(fx: Fx | null, uid: number, lato: PlayerId): string {
  if (!fx?.evento) return '';
  const e = fx.evento;
  const cls: string[] = [];
  if (e.tipo === 'attacco' && e.da === uid) cls.push('anim-affondo');
  if (e.tipo === 'attacco' && e.a === uid) cls.push('anim-colpito');
  if (e.tipo === 'incantesimo' && (e.a === uid || (e.a === 'tutti' && lato !== fx.chi))) cls.push('anim-incantesimo');
  if (e.tipo === 'evoca' && e.uid === uid) cls.push('anim-evoca');
  return cls.join(' ');
}

function stileAffondo(fx: Fx | null, uid: number): React.CSSProperties | undefined {
  if (!fx?.affondo || fx.affondo.uid !== uid) return undefined;
  return { ['--dx' as string]: `${fx.affondo.dx}px`, ['--dy' as string]: `${fx.affondo.dy}px` };
}

function NumeroDanno({ fx, uid }: { fx: Fx | null; uid: number }) {
  if (!fx?.evento || fx.evento.tipo !== 'attacco' || fx.evento.a !== uid) return null;
  return <span key={fx.id} className={`danno-num ${fx.evento.vantaggio > 0 ? 'crit' : ''}`}>-{fx.evento.danno}</span>;
}

interface RitrattoProps {
  nome: string; vita: number; vitaMax: number; cristalli: number; cristalliMax: number; mano: number; mazzo: number;
  attivo: boolean; bersagliabile?: boolean; colpito?: number; onClick?: (e: React.MouseEvent) => void; id: PlayerId;
}
function Ritratto({ nome, vita, vitaMax, cristalli, cristalliMax, mano, mazzo, attivo, bersagliabile, colpito, onClick, id }: RitrattoProps) {
  const pct = Math.max(0, Math.min(100, (vita / vitaMax) * 100));
  return (
    <div data-ritratto={id} className={`ritratto ${attivo ? 'attivo' : ''} ${bersagliabile ? 'bersagliabile' : ''} ${colpito ? 'anim-colpito' : ''} ${vita <= 8 ? 'pericolo' : ''}`} onClick={onClick}>
      <div className="ritratto-nome">{nome}</div>
      <div className="vita-barra"><div className="vita-fill" style={{ width: `${pct}%` }} /><span>{Math.max(0, vita)} / {vitaMax}</span></div>
      <div className="ritratto-info">
        <span title="Cristalli"><Icon nome="crystal-bars" size="1em" /> {cristalli}/{cristalliMax}</span>
        <span title="Carte in mano"><Icon nome="card-draw" size="1em" /> {mano}</span>
        <span title="Carte nel mazzo"><Icon nome="swap-bag" size="1em" /> {mazzo}</span>
      </div>
      <div className="cristalli">
        {Array.from({ length: cristalliMax }).map((_, i) => <span key={i} className={i < cristalli ? 'pieno' : ''} />)}
      </div>
    </div>
  );
}

export function DescrizioneCarta({ def }: { def: CardDef }) {
  const el = def.elemento;
  const senzaAbilita = def.kind === 'drago' && (def.keywords ?? []).length === 0 && !def.evocazione && !def.morte;
  return (
    <div className="descrizione">
      <div className="descr-el" style={{ color: COLORE_ELEMENTO[el] }}>
        {el === 'neutro' ? 'Incantesimo neutro' : `${def.kind === 'drago' ? 'Drago' : 'Incantesimo'} di ${ELEMENTI[el].nome}`}
        {el !== 'neutro' && <span className="descr-triangolo"> · batte {ELEMENTI[ELEMENTI[el].batte].nome}</span>}
      </div>
      {def.kind === 'drago' && (def.keywords ?? []).map((k) => (
        <div key={k} className="descr-kw"><b>{KEYWORD_INFO[k].nome}</b>: {KEYWORD_INFO[k].testo}</div>
      ))}
      {def.kind === 'drago' && def.evocazione && <div className="descr-kw"><b>Evocazione</b>: {testoTrigger(def.evocazione)}.</div>}
      {def.kind === 'drago' && def.morte && <div className="descr-kw"><b>Morte</b>: {testoTrigger(def.morte)}.</div>}
      {def.kind === 'incantesimo' && <div className="descr-kw">{(def as SpellDef).testo}</div>}
      {senzaAbilita && <div className="descr-kw muted">Nessuna abilità speciale.</div>}
    </div>
  );
}

export { PROFILI };
