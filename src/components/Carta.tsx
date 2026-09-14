import { useState } from 'react';
import type { CardDef, DragonOnBoard, Element } from '../engine/types';
import { ELEMENTI, KEYWORD_INFO } from '../engine/cards';
import { Icon } from './Icon';

export const COLORE_ELEMENTO: Record<Element | 'neutro', string> = {
  fuoco: '#ff6b35', ghiaccio: '#5cc8ff', terra: '#7ac74f', neutro: '#c9a7ff',
};

interface Props {
  def: CardDef;
  suCampo?: DragonOnBoard; // se presente, mostra i valori correnti
  selezionata?: boolean;
  bersagliabile?: boolean;
  disabilitata?: boolean;
  piccola?: boolean;
  faccia?: boolean; // mostra retro
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Carta con illustrazione: immagine in public/draghi/<id>.jpg se presente, altrimenti icona vettoriale. */
export function Carta({ def, suCampo, selezionata, bersagliabile, disabilitata, piccola, onClick, className = '', style }: Props) {
  const el = def.elemento;
  const colore = COLORE_ELEMENTO[el];
  const [imgOk, setImgOk] = useState(true);
  const src = `${import.meta.env.BASE_URL}draghi/${def.id}.jpg`;

  const attacco = suCampo ? suCampo.attacco : def.kind === 'drago' ? def.attacco : null;
  const vita = suCampo ? suCampo.vita : def.kind === 'drago' ? def.vita : null;
  const vitaMax = suCampo ? suCampo.vitaMax : vita;
  const kw = suCampo ? suCampo.keywords : def.kind === 'drago' ? def.keywords ?? [] : [];

  const classi = [
    'carta', `el-${el}`, def.kind,
    piccola ? 'piccola' : '',
    selezionata ? 'selezionata' : '',
    bersagliabile ? 'bersagliabile' : '',
    disabilitata ? 'disabilitata' : '',
    suCampo?.congelato ? 'congelata' : '',
    suCampo?.scudo ? 'con-scudo' : '',
    className,
  ].join(' ');

  return (
    <div className={classi} style={{ ['--el' as string]: colore, ...style }} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="carta-testa">
        <span className="costo">{def.costo}</span>
        <span className="nome">{def.nome}</span>
        <span className="elemento" title={el === 'neutro' ? 'Neutro' : ELEMENTI[el].nome}>
          <Icon nome={el === 'neutro' ? 'crystal-shine' : ELEMENTI[el].simbolo} size="1em" />
        </span>
      </div>
      <div className="carta-arte">
        {imgOk ? (
          <img src={src} alt="" onError={() => setImgOk(false)} loading="lazy" draggable={false} />
        ) : (
          <div className="arte-icona">
            <Icon nome={def.icona} size="78%" color="rgba(255,255,255,0.92)" />
          </div>
        )}
        {suCampo?.scudo && <span className="badge-scudo" title="Scudo"><Icon nome="shield" size="1em" /></span>}
        {suCampo?.congelato && <span className="badge-congelato" title="Congelato"><Icon nome="snowflake-2" size="1em" /></span>}
      </div>
      {!piccola && (
        <div className="carta-testo">
          {def.kind === 'drago' ? (
            kw.length > 0 ? kw.map((k) => KEYWORD_INFO[k].nome).join(' · ') : (def.testo ?? '')
          ) : def.testo}
        </div>
      )}
      {piccola && kw.length > 0 && (
        <div className="carta-kw">{kw.map((k) => KEYWORD_INFO[k].nome[0]).join('')}</div>
      )}
      {def.kind === 'drago' && (
        <div className="carta-stats">
          <span className="att"><Icon nome="crossed-swords" size="0.9em" /> {attacco}</span>
          <span className={`vit ${vita !== null && vitaMax !== null && vita < vitaMax ? 'ferito' : ''}`}>
            <Icon nome="heart-plus" size="0.9em" /> {vita}
          </span>
        </div>
      )}
    </div>
  );
}

export function CartaRetro({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`carta retro ${className}`} style={style}>
      <div className="retro-logo"><Icon nome="dragon-head" size="60%" color="rgba(255,255,255,0.25)" /></div>
    </div>
  );
}
