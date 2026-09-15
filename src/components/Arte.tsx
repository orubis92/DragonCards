import { useMemo } from 'react';
import type { Element } from '../engine/types';
import { ICONE } from '../icons';

// ---------------------------------------------------------------------------
// Illustrazione procedurale: ogni carta ha uno sfondo diverso (forme a tema
// per elemento, seminate dall'id della carta) con l'icona in primo piano.
// Serve quando non c'è un'immagine in public/draghi/<id>.jpg.
// ---------------------------------------------------------------------------

function rng(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  s = s || 7;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PALETTE: Record<Element | 'neutro', { cielo: string; cielo2: string; forma: string; forma2: string; luce: string }> = {
  fuoco: { cielo: '#3a0d05', cielo2: '#0d0507', forma: '#ff6b1c', forma2: '#7a1d05', luce: '#ffd166' },
  ghiaccio: { cielo: '#0b2e4a', cielo2: '#050a16', forma: '#8fe3ff', forma2: '#1f5f8a', luce: '#e8fbff' },
  terra: { cielo: '#12301a', cielo2: '#050b07', forma: '#6fae3f', forma2: '#3b2a17', luce: '#c8f09a' },
  neutro: { cielo: '#2a1a4a', cielo2: '#0a0714', forma: '#b78cff', forma2: '#4a2a8a', luce: '#f1e3ff' },
};

interface Props { id: string; elemento: Element | 'neutro'; icona: string; incantesimo?: boolean }

export function ArteProcedurale({ id, elemento, icona, incantesimo }: Props) {
  const pal = PALETTE[elemento];
  const scena = useMemo(() => {
    const r = rng(id);
    const forme: React.ReactNode[] = [];
    const W = 100, H = 72;
    if (elemento === 'fuoco') {
      // fiamme dal basso + braci
      for (let i = 0; i < 5; i++) {
        const x = 8 + r() * 84, w = 14 + r() * 22, h = 18 + r() * 34;
        forme.push(<path key={`f${i}`} d={`M${x - w / 2},${H} Q${x - w / 3},${H - h * 0.5} ${x},${H - h} Q${x + w / 3},${H - h * 0.5} ${x + w / 2},${H} Z`} fill={i % 2 ? pal.forma : pal.forma2} opacity={0.55} />);
      }
      for (let i = 0; i < 9; i++) forme.push(<circle key={`b${i}`} cx={r() * W} cy={10 + r() * 45} r={0.6 + r() * 1.4} fill={pal.luce} opacity={0.5 + r() * 0.5} />);
    } else if (elemento === 'ghiaccio') {
      // cristalli appuntiti + fiocchi
      for (let i = 0; i < 6; i++) {
        const x = 6 + r() * 88, w = 6 + r() * 14, h = 16 + r() * 40, lean = (r() - 0.5) * 14;
        forme.push(<polygon key={`c${i}`} points={`${x - w / 2},${H} ${x + lean},${H - h} ${x + w / 2},${H}`} fill={i % 2 ? pal.forma : pal.forma2} opacity={0.6} />);
        forme.push(<polygon key={`cl${i}`} points={`${x - w / 2},${H} ${x + lean},${H - h} ${x + lean * 0.4},${H}`} fill={pal.luce} opacity={0.25} />);
      }
      for (let i = 0; i < 10; i++) forme.push(<circle key={`s${i}`} cx={r() * W} cy={r() * 50} r={0.5 + r() * 1.2} fill="#fff" opacity={0.4 + r() * 0.6} />);
    } else if (elemento === 'terra') {
      // colline/rocce + foglie
      for (let i = 0; i < 4; i++) {
        const x = r() * W, rx = 20 + r() * 30, ry = 10 + r() * 22;
        forme.push(<ellipse key={`h${i}`} cx={x} cy={H + 4} rx={rx} ry={ry} fill={i % 2 ? pal.forma2 : '#2f5a25'} opacity={0.9} />);
      }
      for (let i = 0; i < 3; i++) {
        const x = 10 + r() * 80, y = H - 14 - r() * 14, s = 5 + r() * 8;
        forme.push(<path key={`r${i}`} d={`M${x - s},${y + s} L${x - s * 0.6},${y - s * 0.4} L${x + s * 0.3},${y - s} L${x + s},${y + s * 0.2} L${x + s * 0.7},${y + s} Z`} fill="#4e3a22" opacity={0.9} />);
      }
      for (let i = 0; i < 7; i++) {
        const x = r() * W, y = 8 + r() * 40, a = r() * 360;
        forme.push(<ellipse key={`l${i}`} cx={x} cy={y} rx={2.6} ry={1.2} transform={`rotate(${a} ${x} ${y})`} fill={pal.forma} opacity={0.6 + r() * 0.4} />);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const x = r() * W, y = r() * H, s = 1 + r() * 2.5;
        forme.push(<path key={`st${i}`} d={`M${x},${y - s} L${x + s * 0.3},${y - s * 0.3} L${x + s},${y} L${x + s * 0.3},${y + s * 0.3} L${x},${y + s} L${x - s * 0.3},${y + s * 0.3} L${x - s},${y} L${x - s * 0.3},${y - s * 0.3} Z`} fill={pal.luce} opacity={0.4 + r() * 0.6} />);
      }
      forme.push(<circle key="halo" cx={50} cy={40} r={26} fill="none" stroke={pal.forma} strokeWidth={1.2} opacity={0.5} />);
      forme.push(<circle key="halo2" cx={50} cy={40} r={20} fill="none" stroke={pal.luce} strokeWidth={0.6} opacity={0.4} />);
    }
    return forme;
  }, [id, elemento, pal]);

  const gid = `g-${id}`;
  const d = ICONE[icona] ?? ICONE['dragon-head'];
  return (
    <svg className="arte-svg" viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${gid}-cielo`} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor={pal.cielo} />
          <stop offset="100%" stopColor={pal.cielo2} />
        </radialGradient>
        <linearGradient id={`${gid}-icona`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={pal.luce} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="72" fill={`url(#${gid}-cielo)`} />
      {scena}
      <circle cx="50" cy="36" r="32" fill={`url(#${gid}-glow)`} />
      <circle cx="50" cy="36" r="27" fill="none" stroke={pal.forma} strokeWidth="0.8" opacity="0.5" />
      <g transform={incantesimo ? 'translate(27 13) scale(0.09)' : 'translate(22 8) scale(0.1094)'} style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.9))' }}>
        <path d={d} fill={`url(#${gid}-icona)`} />
      </g>
    </svg>
  );
}
