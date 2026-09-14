import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { CardDef, DragonOnBoard, Element } from '../engine/types';
import { Carta } from './Carta';

// ---------------------------------------------------------------------------
// Effetti visivi a tema elementale: particelle, proiettili, fantasmi dei draghi
// distrutti. Tutto in CSS (nessun canvas), posizionato in coordinate relative
// al contenitore `.partita`.
// ---------------------------------------------------------------------------

export type ElementoFx = Element | 'neutro';

export interface Punto { x: number; y: number }

export type Effetto =
  | { id: number; tipo: 'esplosione'; a: Punto; elemento: ElementoFx; forte: boolean }
  | { id: number; tipo: 'proiettile'; da: Punto; a: Punto; elemento: ElementoFx }
  | { id: number; tipo: 'fantasma'; a: Punto; w: number; h: number; def: CardDef; drago: DragonOnBoard }
  | { id: number; tipo: 'cura'; a: Punto }
  | { id: number; tipo: 'evocazione'; a: Punto; elemento: Element }
  | { id: number; tipo: 'testo'; a: Punto; testo: string; classe: string };

/** Effetto senza id (tipo distributivo sull'unione). */
export type NuovoEffetto = Effetto extends infer E ? (E extends Effetto ? Omit<E, 'id'> : never) : never;

export const DURATA: Record<Effetto['tipo'], number> = {
  esplosione: 900,
  proiettile: 420,
  fantasma: 800,
  cura: 900,
  evocazione: 800,
  testo: 1000,
};

/** Generatore pseudo-casuale deterministico per particelle stabili tra i render. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const N_PARTICELLE: Record<ElementoFx, number> = { fuoco: 16, ghiaccio: 12, terra: 12, neutro: 12 };

export function Esplosione({ fx }: { fx: Extract<Effetto, { tipo: 'esplosione' }> }) {
  const parts = useMemo(() => {
    const r = rng(fx.id * 7919);
    const n = N_PARTICELLE[fx.elemento] * (fx.forte ? 1.5 : 1);
    return Array.from({ length: Math.round(n) }, (_, i) => {
      const ang = r() * Math.PI * 2;
      const dist = 26 + r() * (fx.forte ? 70 : 46);
      return {
        i,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist - (fx.elemento === 'fuoco' ? 30 : fx.elemento === 'terra' ? -20 : 0),
        s: 0.5 + r() * 0.9,
        d: r() * 120,
        rot: (r() - 0.5) * 540,
      };
    });
  }, [fx]);
  return (
    <div className={`fx-esplosione el-${fx.elemento} ${fx.forte ? 'forte' : ''}`} style={{ left: fx.a.x, top: fx.a.y }}>
      <span className="fx-flash" />
      <span className="fx-anello" />
      {parts.map((p) => (
        <span key={p.i} className="fx-part" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--s': p.s, '--d': `${p.d}ms`, '--rot': `${p.rot}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

export function Proiettile({ fx }: { fx: Extract<Effetto, { tipo: 'proiettile' }> }) {
  const dx = fx.a.x - fx.da.x;
  const dy = fx.a.y - fx.da.y;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div className={`fx-proiettile el-${fx.elemento}`}
      style={{ left: fx.da.x, top: fx.da.y, '--dx': `${dx}px`, '--dy': `${dy}px`, '--ang': `${ang}deg` } as CSSProperties}>
      <span className="fx-scia" />
      <span className="fx-nucleo" />
    </div>
  );
}

export function Fantasma({ fx }: { fx: Extract<Effetto, { tipo: 'fantasma' }> }) {
  return (
    <div className={`fx-fantasma el-${fx.drago.elemento}`} style={{ left: fx.a.x, top: fx.a.y, width: fx.w, height: fx.h }}>
      <Carta def={fx.def} suCampo={fx.drago} piccola style={{ width: '100%', height: '100%' }} />
      <span className="fx-frantumi">
        {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
      </span>
    </div>
  );
}

export function Cura({ fx }: { fx: Extract<Effetto, { tipo: 'cura' }> }) {
  const parts = useMemo(() => {
    const r = rng(fx.id * 31);
    return Array.from({ length: 10 }, (_, i) => ({ i, x: (r() - 0.5) * 80, d: r() * 300, s: 0.6 + r() * 0.8 }));
  }, [fx]);
  return (
    <div className="fx-cura" style={{ left: fx.a.x, top: fx.a.y }}>
      {parts.map((p) => <span key={p.i} style={{ '--x': `${p.x}px`, '--d': `${p.d}ms`, '--s': p.s } as CSSProperties}>+</span>)}
    </div>
  );
}

export function Evocazione({ fx }: { fx: Extract<Effetto, { tipo: 'evocazione' }> }) {
  return (
    <div className={`fx-evocazione el-${fx.elemento}`} style={{ left: fx.a.x, top: fx.a.y }}>
      <span className="fx-anello" />
      <span className="fx-anello secondo" />
    </div>
  );
}

export function Testo({ fx }: { fx: Extract<Effetto, { tipo: 'testo' }> }) {
  return <div className={`fx-testo ${fx.classe}`} style={{ left: fx.a.x, top: fx.a.y }}>{fx.testo}</div>;
}

/** Livello che disegna tutti gli effetti attivi. */
export function LivelloEffetti({ effetti }: { effetti: Effetto[] }) {
  return (
    <div className="fx-livello" aria-hidden="true">
      {effetti.map((fx) => {
        switch (fx.tipo) {
          case 'esplosione': return <Esplosione key={fx.id} fx={fx} />;
          case 'proiettile': return <Proiettile key={fx.id} fx={fx} />;
          case 'fantasma': return <Fantasma key={fx.id} fx={fx} />;
          case 'cura': return <Cura key={fx.id} fx={fx} />;
          case 'evocazione': return <Evocazione key={fx.id} fx={fx} />;
          case 'testo': return <Testo key={fx.id} fx={fx} />;
        }
      })}
    </div>
  );
}

/** Hook: coda di effetti che si auto-eliminano dopo la loro durata. */
export function useEffetti() {
  const [effetti, setEffetti] = useState<Effetto[]>([]);
  useEffect(() => {
    if (effetti.length === 0) return;
    const t = setTimeout(() => {
      const ora = Date.now();
      setEffetti((e) => e.filter((x) => (nascite.get(x.id) ?? ora) + DURATA[x.tipo] > ora));
    }, 120);
    return () => clearTimeout(t);
  }, [effetti]);
  const aggiungi = useCallback((nuovi: NuovoEffetto[]) => {
    if (nuovi.length === 0) return;
    const ora = Date.now();
    const conId = nuovi.map((n) => {
      const id = ++contatore;
      nascite.set(id, ora);
      return { ...n, id } as Effetto;
    });
    setEffetti((e) => [...e, ...conId]);
  }, []);
  return { effetti, aggiungi };
}
let contatore = 0;
const nascite = new Map<number, number>();

/** Sfondo animato: motes/scintille che fluttuano lentamente. */
export function SfondoVivo() {
  const motes = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 18 }, (_, i) => ({ i, x: r() * 100, y: r() * 100, s: 2 + r() * 4, d: 8 + r() * 12, del: -r() * 20, o: 0.25 + r() * 0.4 }));
  }, []);
  return (
    <div className="sfondo-vivo" aria-hidden="true">
      {motes.map((m) => (
        <span key={m.i} style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s, '--d': `${m.d}s`, '--del': `${m.del}s`, '--o': m.o } as CSSProperties} />
      ))}
    </div>
  );
}
