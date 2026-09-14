import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, GameState, PlayerId, SpellDef, CardDef } from '../engine/types';
import { MAX_CAMPO, VITA_INIZIALE } from '../engine/types';
import { applica, azioniLegali, bersagliIncantesimo, nuovaPartita, puoAttaccare } from '../engine/rules';
import { scegliAzione, type Livello, LIVELLI } from '../engine/ai';
import { carta, ELEMENTI, KEYWORD_INFO, vantaggio } from '../engine/cards';
import { mazzo } from '../engine/decks';
import { Carta, CartaRetro, COLORE_ELEMENTO } from './Carta';
import { Icon } from './Icon';
import { suona } from '../audio';
import { LivelloEffetti, SfondoVivo, useEffetti, type NuovoEffetto, type Punto } from './Effetti';

export interface ConfigPartita {
  nomeGiocatore: string;
  mazzoGiocatore: string;
  mazzoIA: string;
  livello: Livello;
  suoni: boolean;
}

interface Props {
  config: ConfigPartita;
  onFine: (vinto: boolean) => void;
  onEsci: () => void;
}

type Selezione = { tipo: 'mano'; uid: number } | { tipo: 'campo'; uid: number } | null;

interface Fx { id: number; evento: GameState['ultimoEvento']; chi: PlayerId; affondo?: { uid: number; dx: number; dy: number } }

const IO: PlayerId = 0;
const IA: PlayerId = 1;

export function Partita({ config, onFine, onEsci }: Props) {
  const [state, setState] = useState<GameState>(() =>
    nuovaPartita({ nomi: [config.nomeGiocatore, `IA ${LIVELLI[config.livello].nome}`], mazzi: [config.mazzoGiocatore, config.mazzoIA] }),
  );
  const [sel, setSel] = useState<Selezione>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [mostraLog, setMostraLog] = useState(false);
  const [dettaglio, setDettaglio] = useState<{ def: CardDef; campo?: GameState['giocatori'][0]['campo'][0] } | null>(null);
  const [pensa, setPensa] = useState(false);
  const fxId = useRef(0);
  const fineNotificata = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const contenitore = useRef<HTMLDivElement>(null);
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

    const ns = applica(s, azione);
    const ev = ns.ultimoEvento;
    const nuovi: NuovoEffetto[] = [];
    let affondo: Fx['affondo'];
    let ritardati: (() => NuovoEffetto[]) | null = null;
    const elDi = (uid: number) => s.giocatori.flatMap((g) => g.campo).find((d) => d.uid === uid)?.elemento ?? 'neutro';

    if (ev?.tipo === 'attacco') {
      const da = posizioni.get(ev.da);
      const a = ev.a === 'giocatore' ? ritratti[chi === IO ? IA : IO] : posizioni.get(ev.a)?.p ?? null;
      if (da && a) {
        affondo = { uid: ev.da, dx: (a.x - da.p.x) * 0.6, dy: (a.y - da.p.y) * 0.6 };
        nuovi.push({ tipo: 'esplosione', a, elemento: elDi(ev.da), forte: ev.vantaggio > 0 });
        if (ev.a !== 'giocatore' && ev.vantaggio !== 0) {
          const larg = contenitore.current?.clientWidth ?? 400;
          nuovi.push({ tipo: 'testo', a: { x: Math.min(Math.max(a.x, 80), larg - 80), y: a.y - 40 }, testo: ev.vantaggio > 0 ? 'Super efficace!' : 'Poco efficace…', classe: ev.vantaggio > 0 ? 'super' : 'poco' });
        }
        if (ev.a === 'giocatore' && chi === IA) setScossa(true);
      }
    } else if (ev?.tipo === 'incantesimo') {
      const def = carta(ev.carta);
      const el = def.elemento;
      const avvId = chi === IO ? IA : IO;
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
      } else if (effetto === 'pesca' || effetto === 'cristalli') {
        const r = ritratti[chi]; if (r) nuovi.push({ tipo: 'evocazione', a: r, elemento: 'ghiaccio' });
      } else {
        const benefico = effetto === 'potenzia' || effetto === 'scudo';
        for (const b of bersagli) {
          const a = posizioneDi(b);
          if (origineMano && a) nuovi.push({ tipo: 'proiettile', da: origineMano, a, elemento: el });
        }
        ritardati = () => bersagli.flatMap((b): NuovoEffetto[] => {
          const a = posizioneDi(b);
          if (!a) return [];
          return [benefico ? { tipo: 'cura', a } : { tipo: 'esplosione', a, elemento: el, forte: effetto === 'distruggi' }];
        });
        if (ev.a === 'giocatore' && chi === IA) setTimeout(() => setScossa(true), 380);
      }
    } else if (ev?.tipo === 'evoca') {
      // il drago non è ancora nel DOM: l'effetto viene posizionato nel prossimo frame
      const uid = ev.uid;
      const el = ns.giocatori[chi].campo.find((d) => d.uid === uid)?.elemento ?? 'fuoco';
      requestAnimationFrame(() => { const c = centro(`[data-uid="${uid}"]`); if (c) aggiungi([{ tipo: 'evocazione', a: c.p, elemento: el }]); });
    }
    // Draghi distrutti: fantasma che si frantuma nella posizione che avevano
    for (const g of s.giocatori) {
      for (const d of g.campo) {
        if (ns.giocatori[g.id].campo.some((x) => x.uid === d.uid)) continue;
        const c = posizioni.get(d.uid);
        if (c) nuovi.push({ tipo: 'fantasma', a: { x: c.p.x - c.w / 2, y: c.p.y - c.h / 2 }, w: c.w, h: c.h, def: carta(d.defId), drago: { ...d, vita: 0 } });
      }
    }
    // Il proiettile deve arrivare prima dell'impatto: gli effetti d'impatto vengono creati (e posizionati) dopo
    aggiungi(nuovi);
    if (ritardati) { const f = ritardati; setTimeout(() => aggiungi(f()), 380); }

    if (ev) {
      fxId.current += 1;
      setFx({ id: fxId.current, evento: ev, chi, affondo });
      if (config.suoni) suona(ev.tipo === 'attacco' ? 'attacco' : ev.tipo === 'incantesimo' ? 'incantesimo' : ev.tipo === 'evoca' ? 'evoca' : 'turno');
    }
    stateRef.current = ns;
    setState(ns);
    setSel(null);
  }, [config.suoni, centro, aggiungi]);

  useEffect(() => {
    if (!scossa) return;
    const t = setTimeout(() => setScossa(false), 500);
    return () => clearTimeout(t);
  }, [scossa]);

  // Turno dell'IA: una azione ogni ~800 ms
  useEffect(() => {
    if (state.vincitore !== null || state.attivo !== IA) { setPensa(false); return; }
    setPensa(true);
    const t = setTimeout(() => {
      const a = scegliAzione(state, config.livello);
      esegui(a, IA);
    }, state.ultimoEvento?.tipo === 'fineTurno' ? 900 : 750);
    return () => clearTimeout(t);
  }, [state, config.livello, esegui]);

  // Fine partita
  useEffect(() => {
    if (state.vincitore !== null && !fineNotificata.current) {
      fineNotificata.current = true;
      if (config.suoni) suona(state.vincitore === IO ? 'vittoria' : 'sconfitta');
      onFine(state.vincitore === IO);
    }
  }, [state.vincitore, onFine, config.suoni]);

  // Pulisci l'effetto dopo l'animazione
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx((f) => (f?.id === fx.id ? null : f)), 900);
    return () => clearTimeout(t);
  }, [fx]);

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

  return (
    <div ref={contenitore} className={`partita ${sel ? 'in-selezione' : ''} ${scossa ? 'scossa' : ''}`} onClick={() => sel && setSel(null)}>
      <SfondoVivo />
      {/* ---- Avversario ---- */}
      <header className="barra barra-ia">
        <button className="btn-icona" onClick={(e) => { e.stopPropagation(); onEsci(); }} title="Abbandona">✕</button>
        <Ritratto id={IA} nome={ia.nome} vita={ia.vita} cristalli={ia.cristalli} cristalliMax={ia.cristalliMax} mano={ia.mano.length} mazzo={ia.mazzo.length}
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
              {v !== 0 && <span className={`vantaggio ${v > 0 ? 'su' : 'giu'}`}>{v > 0 ? '×1.5' : '×0.75'}</span>}
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
        <Ritratto id={IO} nome={io.nome} vita={io.vita} cristalli={io.cristalli} cristalliMax={io.cristalliMax} mano={io.mano.length} mazzo={io.mazzo.length}
          attivo={mioTurno} colpito={fx?.chi === IA && ((fx.evento?.tipo === 'attacco' && fx.evento.a === 'giocatore') || (fx.evento?.tipo === 'incantesimo' && fx.evento.a === 'giocatore')) ? 1 : 0} />
        <button className={`btn fine-turno ${mioTurno && !haMosse ? 'lampeggia' : ''}`} disabled={!mioTurno} onClick={() => esegui({ tipo: 'fineTurno' }, IO)}>
          {mioTurno ? 'Fine turno' : 'Turno IA…'}
        </button>
      </footer>

      <section className="mano" data-mano="0" onClick={(e) => e.stopPropagation()}>
        {io.mano.map((c) => {
          const def = carta(c.defId);
          return (
            <Carta key={c.uid} def={def} selezionata={sel?.tipo === 'mano' && sel.uid === c.uid}
              disabilitata={mioTurno && !giocabile(c.uid)} onClick={() => tapMano(c.uid)} />
          );
        })}
        {io.mano.length === 0 && <div className="campo-vuoto">Mano vuota</div>}
      </section>

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
      {sel?.tipo === 'mano' && defSel && (
        <div className={`anteprima ${defSel.kind === 'incantesimo' && ['potenzia', 'scudo'].includes(defSel.effetto.tipo) ? 'alto' : ''}`} onClick={(e) => e.stopPropagation()}>
          <Carta def={defSel} className="grande" />
          <DescrizioneCarta def={defSel} />
        </div>
      )}
      {state.vincitore !== null && (
        <div className="overlay fine">
          <div className={`pannello risultato ${state.vincitore === IO ? 'vittoria' : 'sconfitta'}`}>
            <Icon nome={state.vincitore === IO ? 'trophy' : 'skull'} size={72} />
            <h2>{state.vincitore === IO ? 'Vittoria!' : 'Sconfitta'}</h2>
            <p>{state.vincitore === IO ? `Hai sconfitto ${ia.nome} in ${state.turno} turni.` : `${ia.nome} ha avuto la meglio dopo ${state.turno} turni.`}</p>
            <div className="riga-btn">
              <button className="btn" onClick={onEsci}>Menu</button>
              <button className="btn primario" onClick={() => { fineNotificata.current = false; setState(nuovaPartita({ nomi: [config.nomeGiocatore, ia.nome], mazzi: [config.mazzoGiocatore, config.mazzoIA] })); }}>Rivincita</button>
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
  nome: string; vita: number; cristalli: number; cristalliMax: number; mano: number; mazzo: number;
  attivo: boolean; bersagliabile?: boolean; colpito?: number; onClick?: (e: React.MouseEvent) => void; id: PlayerId;
}
function Ritratto({ nome, vita, cristalli, cristalliMax, mano, mazzo, attivo, bersagliabile, colpito, onClick, id }: RitrattoProps) {
  const pct = Math.max(0, Math.min(100, (vita / VITA_INIZIALE) * 100));
  return (
    <div data-ritratto={id} className={`ritratto ${attivo ? 'attivo' : ''} ${bersagliabile ? 'bersagliabile' : ''} ${colpito ? 'anim-colpito' : ''} ${vita <= 8 ? 'pericolo' : ''}`} onClick={onClick}>
      <div className="ritratto-nome">{nome}</div>
      <div className="vita-barra"><div className="vita-fill" style={{ width: `${pct}%` }} /><span>{Math.max(0, vita)} / {VITA_INIZIALE}</span></div>
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
  return (
    <div className="descrizione">
      <div className="descr-el" style={{ color: COLORE_ELEMENTO[el] }}>
        {el === 'neutro' ? 'Incantesimo neutro' : `${def.kind === 'drago' ? 'Drago' : 'Incantesimo'} di ${ELEMENTI[el].nome}`}
        {el !== 'neutro' && <span className="descr-triangolo"> · batte {ELEMENTI[ELEMENTI[el].batte].nome}</span>}
      </div>
      {def.kind === 'drago' && (def.keywords ?? []).map((k) => (
        <div key={k} className="descr-kw"><b>{KEYWORD_INFO[k].nome}</b>: {KEYWORD_INFO[k].testo}</div>
      ))}
      {def.kind === 'incantesimo' && <div className="descr-kw">{(def as SpellDef).testo}</div>}
      {def.kind === 'drago' && (def.keywords ?? []).length === 0 && <div className="descr-kw muted">Nessuna abilità speciale.</div>}
    </div>
  );
}

export function nomeMazzo(id: string) {
  return mazzo(id).nome;
}
