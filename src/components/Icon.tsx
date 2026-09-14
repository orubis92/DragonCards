import { ICONE } from '../icons';

interface Props { nome: string; size?: number | string; color?: string; className?: string; style?: React.CSSProperties }

export function Icon({ nome, size = 24, color = 'currentColor', className, style }: Props) {
  const d = ICONE[nome] ?? ICONE['dragon-head'];
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d={d} fill={color} />
    </svg>
  );
}
