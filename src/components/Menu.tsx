import { useState } from 'react';
import { MAZZI } from '../engine/decks';
import { LIVELLI, type Livello } from '../engine/ai';
import { DRAGHI, INCANTESIMI, ELEMENTI, carta } from '../engine/cards';
import type { ConfigPartita } from './Partita';
import { Carta, COLORE_ELEMENTO } from './Carta';
import { DescrizioneCarta } from './Partita';
import { Icon } from './Icon';
import { AUTORI_ICONE } from '../icons';
import type { Statistiche } from '../storage';

interface Props {
  config: ConfigPartita;
  stats: Statistiche;
  onCambia: (c: ConfigPartita) => void;
  onGioca: () => void;
}

type Vista = 'menu' | 'mazzi' | 'regole' | 'carte' | 'crediti';

export function Menu({ config, stats, onCambia, onGioca }: Props) {
  const [vista, setVista] = useState<Vista>('menu');
  const [mazzoVisto, setMazzoVisto] = useState<string | null>(null);
  const [cartaVista, setCartaVista] = useState<string | null>(null);

  const set = <K extends keyof ConfigPartita>(k: K, v: ConfigPartita[K]) => onCambia({ ...config, [k]: v });

  if (vista === 'regole') return <Pannello titolo="Regole" onChiudi={() => setVista('menu')}><Regole /></Pannello>;
  if (vista === 'crediti') return <Pannello titolo="Crediti" onChiudi={() => setVista('menu')}><Crediti /></Pannello>;
  if (vista === 'carte') {
    return (
      <Pannello titolo="Tutte le carte" onChiudi={() => setVista('menu')}>
        {(['fuoco', 'ghiaccio', 'terra'] as const).map((el) => (
          <div key={el}>
            <h3 style={{ color: COLORE_ELEMENTO[el] }}><Icon nome={ELEMENTI[el].simbolo} size="1em" /> {ELEMENTI[el].nome} <small>batte {ELEMENTI[ELEMENTI[el].batte].nome}</small></h3>
            <div className="griglia-carte">
              {DRAGHI.filter((d) => d.elemento === el).map((d) => <Carta key={d.id} def={d} onClick={() => setCartaVista(d.id)} />)}
              {INCANTESIMI.filter((s) => s.elemento === el).map((s) => <Carta key={s.id} def={s} onClick={() => setCartaVista(s.id)} />)}
            </div>
          </div>
        ))}
        <h3 style={{ color: COLORE_ELEMENTO.neutro }}><Icon nome="crystal-shine" size="1em" /> Neutri</h3>
        <div className="griglia-carte">
          {INCANTESIMI.filter((s) => s.elemento === 'neutro').map((s) => <Carta key={s.id} def={s} onClick={() => setCartaVista(s.id)} />)}
        </div>
        {cartaVista && (
          <div className="overlay" onClick={() => setCartaVista(null)}>
            <div className="pannello dettaglio" onClick={(e) => e.stopPropagation()}>
              <Carta def={carta(cartaVista)} className="grande" />
              <DescrizioneCarta def={carta(cartaVista)} />
              <button className="btn" onClick={() => setCartaVista(null)}>Chiudi</button>
            </div>
          </div>
        )}
      </Pannello>
    );
  }
  if (vista === 'mazzi') {
    const m = MAZZI.find((x) => x.id === mazzoVisto);
    return (
      <Pannello titolo="Mazzi" onChiudi={() => { setVista('menu'); setMazzoVisto(null); }}>
        {!m && MAZZI.map((mz) => (
          <button key={mz.id} className={`scelta-mazzo el-${mz.elemento}`} onClick={() => setMazzoVisto(mz.id)}>
            <Icon nome={mz.elemento === 'misto' ? 'dragon-orb' : ELEMENTI[mz.elemento].simbolo} size={36} />
            <div><b>{mz.nome}</b><small>{mz.descrizione}</small></div>
          </button>
        ))}
        {m && (
          <>
            <button className="btn" onClick={() => setMazzoVisto(null)}>← Tutti i mazzi</button>
            <h3>{m.nome} <small>{m.carte.length} carte</small></h3>
            <p className="muted">{m.descrizione}</p>
            <div className="griglia-carte">
              {conteggio(m.carte).map(([id, n]) => (
                <div key={id} className="con-copie" onClick={() => setCartaVista(id)}>
                  <Carta def={carta(id)} />
                  {n > 1 && <span className="copie">×{n}</span>}
                </div>
              ))}
            </div>
            {cartaVista && (
              <div className="overlay" onClick={() => setCartaVista(null)}>
                <div className="pannello dettaglio" onClick={(e) => e.stopPropagation()}>
                  <Carta def={carta(cartaVista)} className="grande" />
                  <DescrizioneCarta def={carta(cartaVista)} />
                  <button className="btn" onClick={() => setCartaVista(null)}>Chiudi</button>
                </div>
              </div>
            )}
          </>
        )}
      </Pannello>
    );
  }

  const tot = stats.vittorie + stats.sconfitte;
  return (
    <div className="menu">
      <div className="titolo">
        <Icon nome="double-dragon" size={72} color="#ffb347" />
        <h1>Draghi<span>Carte</span></h1>
        <p className="muted">Duello di carte elementali contro l'IA</p>
      </div>

      <label className="campo-form">
        <span>Il tuo nome</span>
        <input value={config.nomeGiocatore} maxLength={16} onChange={(e) => set('nomeGiocatore', e.target.value || 'Giocatore')} />
      </label>

      <div className="campo-form">
        <span>Il tuo mazzo</span>
        <div className="scelte">
          {MAZZI.map((m) => (
            <button key={m.id} className={`chip el-${m.elemento} ${config.mazzoGiocatore === m.id ? 'on' : ''}`} onClick={() => set('mazzoGiocatore', m.id)}>
              <Icon nome={m.elemento === 'misto' ? 'dragon-orb' : ELEMENTI[m.elemento].simbolo} size="1.1em" /> {m.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="campo-form">
        <span>Mazzo dell'IA</span>
        <div className="scelte">
          <button className={`chip ${config.mazzoIA === 'casuale' ? 'on' : ''}`} onClick={() => set('mazzoIA', 'casuale')}>
            <Icon nome="card-draw" size="1.1em" /> Casuale
          </button>
          {MAZZI.map((m) => (
            <button key={m.id} className={`chip el-${m.elemento} ${config.mazzoIA === m.id ? 'on' : ''}`} onClick={() => set('mazzoIA', m.id)}>
              <Icon nome={m.elemento === 'misto' ? 'dragon-orb' : ELEMENTI[m.elemento].simbolo} size="1.1em" /> {m.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="campo-form">
        <span>Difficoltà</span>
        <div className="scelte">
          {([1, 2, 3] as Livello[]).map((l) => (
            <button key={l} className={`chip ${config.livello === l ? 'on' : ''}`} onClick={() => set('livello', l)} title={LIVELLI[l].descrizione}>
              {LIVELLI[l].nome}
            </button>
          ))}
        </div>
        <small className="muted">{LIVELLI[config.livello].descrizione}</small>
      </div>

      <label className="campo-form riga">
        <input type="checkbox" checked={config.suoni} onChange={(e) => set('suoni', e.target.checked)} /> <span>Suoni</span>
      </label>

      <button className="btn primario grande-btn" onClick={onGioca}>Gioca</button>

      <div className="riga-btn">
        <button className="btn" onClick={() => setVista('mazzi')}>Mazzi</button>
        <button className="btn" onClick={() => setVista('carte')}>Carte</button>
        <button className="btn" onClick={() => setVista('regole')}>Regole</button>
        <button className="btn" onClick={() => setVista('crediti')}>Crediti</button>
      </div>

      {tot > 0 && (
        <p className="muted statistiche">
          {stats.vittorie} vittorie · {stats.sconfitte} sconfitte ({Math.round((stats.vittorie / tot) * 100)}%)
          {' · '}per livello: {([1, 2, 3] as Livello[]).map((l) => `${LIVELLI[l].nome} ${stats.perLivello[l]?.v ?? 0}-${stats.perLivello[l]?.s ?? 0}`).join(', ')}
        </p>
      )}
    </div>
  );
}

function conteggio(ids: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => carta(a[0]).costo - carta(b[0]).costo);
}

function Pannello({ titolo, onChiudi, children }: { titolo: string; onChiudi: () => void; children: React.ReactNode }) {
  return (
    <div className="pagina">
      <header className="pagina-testa">
        <button className="btn-icona" onClick={onChiudi}>←</button>
        <h2>{titolo}</h2>
      </header>
      <div className="pagina-corpo">{children}</div>
    </div>
  );
}

function Regole() {
  return (
    <div className="prosa">
      <h3>Obiettivo</h3>
      <p>Porta a zero i 25 punti vita dell'avversario evocando draghi e lanciando incantesimi.</p>
      <h3>Il turno</h3>
      <p>All'inizio di ogni tuo turno peschi una carta e ottieni un cristallo in più (fino a 10). Ogni carta costa cristalli. Puoi evocare draghi (massimo 4 sul campo), lanciare incantesimi e attaccare con i draghi che erano già sul campo all'inizio del turno. Quando hai finito, premi <b>Fine turno</b>.</p>
      <h3>Combattimento</h3>
      <p>Un drago può attaccare un drago avversario oppure direttamente l'avversario. Quando due draghi combattono si infliggono danno a vicenda; un drago con vita a zero viene distrutto. Se l'avversario ha un <b>Guardiano</b>, devi attaccare prima lui.</p>
      <h3>Il triangolo degli elementi</h3>
      <p className="triangolo">
        <span style={{ color: COLORE_ELEMENTO.fuoco }}>Fuoco</span> batte <span style={{ color: COLORE_ELEMENTO.ghiaccio }}>Ghiaccio</span>,{' '}
        <span style={{ color: COLORE_ELEMENTO.ghiaccio }}>Ghiaccio</span> batte <span style={{ color: COLORE_ELEMENTO.terra }}>Terra</span>,{' '}
        <span style={{ color: COLORE_ELEMENTO.terra }}>Terra</span> batte <span style={{ color: COLORE_ELEMENTO.fuoco }}>Fuoco</span>.
      </p>
      <p>Con il vantaggio elementale il danno è moltiplicato per <b>1,5</b> (arrotondato per eccesso); in svantaggio è ridotto a <b>0,75</b> (per difetto, minimo 1). Vale anche per gli incantesimi di danno.</p>
      <h3>Abilità</h3>
      <p><b>Guardiano</b>: i draghi avversari devono attaccarlo per primo. <b>Carica</b>: può attaccare nel turno in cui viene evocato. <b>Rigenerazione</b>: recupera 2 vita alla fine del tuo turno. <b>Scudo</b>: ignora il primo danno subito. <b>Congelato</b>: salta il prossimo attacco.</p>
      <h3>Fatica</h3>
      <p>Se devi pescare a mazzo vuoto subisci danni crescenti. Con 7 carte in mano, la carta pescata viene scartata.</p>
    </div>
  );
}

function Crediti() {
  return (
    <div className="prosa">
      <p>Le icone delle carte e dell'interfaccia provengono da <b>game-icons.net</b>, licenza CC BY 3.0. Autori: {Object.entries(AUTORI_ICONE).map(([a, n]) => `${a} (${n.length})`).join(', ')}.</p>
      <p>Le illustrazioni dei draghi, se presenti nella cartella <code>public/draghi/</code>, sono aggiunte dal proprietario dell'app: vedi il file <code>public/draghi/README.md</code> per le fonti consigliate.</p>
      <p>Suoni sintetizzati con WebAudio. Nessun dato lascia il dispositivo: la partita e le statistiche sono salvate localmente.</p>
    </div>
  );
}
