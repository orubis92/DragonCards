import { useMemo, useState } from 'react';
import { MAZZI, DIM_MAZZO, MAX_COPIE, validaMazzo, elementoDominante, mazzo, type DeckDef } from '../engine/decks';
import { LIVELLI, type Livello } from '../engine/ai';
import { DRAGHI_BASE, DRAGHI_EFFETTO, INCANTESIMI, ELEMENTI, carta } from '../engine/cards';
import { CAMPAGNA, bossDisponibile, collezione, type Boss, type ProgressoCampagna } from '../engine/campagna';
import type { ConfigPartita } from './Partita';
import { Carta, COLORE_ELEMENTO } from './Carta';
import { DescrizioneCarta } from './Partita';
import { Icon } from './Icon';
import { AUTORI_ICONE } from '../icons';
import type { Statistiche } from '../storage';
import type { Element } from '../engine/types';

interface Props {
  config: ConfigPartita;
  stats: Statistiche;
  progresso: ProgressoCampagna;
  mazziPersonalizzati: DeckDef[];
  onCambia: (c: ConfigPartita) => void;
  onGioca: () => void;
  onCampagna: (boss: Boss) => void;
  onTutorial: () => void;
  onSalvaMazzi: (m: DeckDef[]) => void;
  vistaIniziale?: 'menu' | 'campagna';
}

type Vista = 'menu' | 'mazzi' | 'editor' | 'campagna' | 'regole' | 'carte' | 'crediti';

export function Menu({ config, stats, progresso, mazziPersonalizzati, onCambia, onGioca, onCampagna, onTutorial, onSalvaMazzi, vistaIniziale = 'menu' }: Props) {
  const [vista, setVista] = useState<Vista>(vistaIniziale);
  const [mazzoVisto, setMazzoVisto] = useState<string | null>(null);
  const [cartaVista, setCartaVista] = useState<string | null>(null);
  const [inModifica, setInModifica] = useState<DeckDef | null>(null);

  const set = <K extends keyof ConfigPartita>(k: K, v: ConfigPartita[K]) => onCambia({ ...config, [k]: v });
  const coll = useMemo(() => collezione(progresso), [progresso]);
  const tuttiMazzi = [...MAZZI, ...mazziPersonalizzati];

  const dettaglioCarta = cartaVista && (
    <div className="overlay" onClick={() => setCartaVista(null)}>
      <div className="pannello dettaglio" onClick={(e) => e.stopPropagation()}>
        <Carta def={carta(cartaVista)} className="grande" />
        <DescrizioneCarta def={carta(cartaVista)} />
        <button className="btn" onClick={() => setCartaVista(null)}>Chiudi</button>
      </div>
    </div>
  );

  if (vista === 'regole') return <Pannello titolo="Regole" onChiudi={() => setVista('menu')}><Regole /></Pannello>;
  if (vista === 'crediti') return <Pannello titolo="Crediti" onChiudi={() => setVista('menu')}><Crediti /></Pannello>;

  if (vista === 'campagna') {
    return (
      <Pannello titolo="Campagna" onChiudi={() => setVista('menu')}>
        <p className="muted">Dieci avversari, uno dopo l'altro. Ogni vittoria sblocca carte per il deck builder. Giochi con il mazzo scelto nel menu ({tuttiMazzi.find((m) => m.id === config.mazzoGiocatore)?.nome ?? config.mazzoGiocatore}).</p>
        <div className="lista-boss">
          {CAMPAGNA.map((b, i) => {
            const battuto = progresso.battuti.includes(b.id);
            const disponibile = bossDisponibile(progresso, b);
            return (
              <button key={b.id} className={`boss el-${mazzo(b.mazzo).elemento} ${battuto ? 'battuto' : ''} ${disponibile ? '' : 'bloccato'}`} disabled={!disponibile} onClick={() => onCampagna(b)}>
                <span className="boss-num">{i + 1}</span>
                <span className="boss-icona"><Icon nome={battuto ? 'checked-shield' : disponibile ? b.icona : 'padlock'} size={34} /></span>
                <span className="boss-testo">
                  <b>{b.nome}, {b.titolo}</b>
                  <small>{b.descrizione}</small>
                  <small className="boss-meta">IA {LIVELLI[b.livello].nome} · {b.vitaIA} vita{b.ricompensa.length ? ` · sblocca ${b.ricompensa.map((id) => carta(id).nome).join(', ')}` : ''}</small>
                </span>
              </button>
            );
          })}
        </div>
      </Pannello>
    );
  }

  if (vista === 'carte') {
    const sezione = (titolo: string, lista: { id: string }[], colore: string, icona: string) => (
      <div key={titolo}>
        <h3 style={{ color: colore }}><Icon nome={icona} size="1em" /> {titolo}</h3>
        <div className="griglia-carte">
          {lista.map((c) => (
            <div key={c.id} className={`con-copie ${coll.has(c.id) ? '' : 'bloccata'}`} onClick={() => setCartaVista(c.id)}>
              <Carta def={carta(c.id)} />
              {!coll.has(c.id) && <span className="lucchetto"><Icon nome="padlock" size="1em" /></span>}
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <Pannello titolo="Tutte le carte" onChiudi={() => setVista('menu')}>
        <p className="muted">Le carte con il lucchetto si sbloccano vincendo nella campagna ({coll.size}/{DRAGHI_BASE.length + DRAGHI_EFFETTO.length + INCANTESIMI.length} nella collezione).</p>
        {(['fuoco', 'ghiaccio', 'terra'] as const).map((el) =>
          sezione(`${ELEMENTI[el].nome} · batte ${ELEMENTI[ELEMENTI[el].batte].nome}`, [...DRAGHI_BASE, ...DRAGHI_EFFETTO, ...INCANTESIMI].filter((c) => c.elemento === el), COLORE_ELEMENTO[el], ELEMENTI[el].simbolo),
        )}
        {sezione('Neutri', INCANTESIMI.filter((s) => s.elemento === 'neutro'), COLORE_ELEMENTO.neutro, 'crystal-shine')}
        {dettaglioCarta}
      </Pannello>
    );
  }

  if (vista === 'editor' && inModifica) {
    return (
      <EditorMazzo
        iniziale={inModifica}
        collezione={coll}
        onAnnulla={() => { setVista('mazzi'); setInModifica(null); }}
        onSalva={(m) => {
          const altri = mazziPersonalizzati.filter((x) => x.id !== m.id);
          onSalvaMazzi([...altri, m]);
          setVista('mazzi'); setInModifica(null);
        }}
        onElimina={(id) => { onSalvaMazzi(mazziPersonalizzati.filter((x) => x.id !== id)); if (config.mazzoGiocatore === id) set('mazzoGiocatore', 'fuoco'); setVista('mazzi'); setInModifica(null); }}
        onCarta={setCartaVista}
      />
    );
  }

  if (vista === 'mazzi') {
    const m = tuttiMazzi.find((x) => x.id === mazzoVisto);
    const nuovo = () => {
      setInModifica({ id: `p-${Date.now().toString(36)}`, nome: `Mazzo ${mazziPersonalizzati.length + 1}`, elemento: 'misto', descrizione: 'Mazzo personalizzato', carte: [] });
      setVista('editor');
    };
    return (
      <Pannello titolo="Mazzi" onChiudi={() => { setVista('menu'); setMazzoVisto(null); }}>
        {!m && (
          <>
            <h3>Mazzi predefiniti</h3>
            {MAZZI.map((mz) => (
              <button key={mz.id} className={`scelta-mazzo el-${mz.elemento}`} onClick={() => setMazzoVisto(mz.id)}>
                <Icon nome={mz.elemento === 'misto' ? 'dragon-orb' : ELEMENTI[mz.elemento].simbolo} size={36} />
                <div><b>{mz.nome}</b><small>{mz.descrizione}</small></div>
              </button>
            ))}
            <h3>I tuoi mazzi</h3>
            {mazziPersonalizzati.length === 0 && <p className="muted">Nessun mazzo personalizzato. Creane uno con le carte della tua collezione: 30 carte, massimo 2 copie ciascuna.</p>}
            {mazziPersonalizzati.map((mz) => (
              <div key={mz.id} className={`scelta-mazzo el-${mz.elemento}`}>
                <Icon nome={mz.elemento === 'misto' ? 'dragon-orb' : ELEMENTI[mz.elemento].simbolo} size={36} />
                <div style={{ flex: 1 }} onClick={() => setMazzoVisto(mz.id)}><b>{mz.nome}</b><small>{mz.carte.length} carte · {mz.descrizione}</small></div>
                <button className="btn" onClick={() => { setInModifica(mz); setVista('editor'); }}>Modifica</button>
              </div>
            ))}
            <button className="btn primario" onClick={nuovo}>+ Nuovo mazzo</button>
          </>
        )}
        {m && (
          <>
            <button className="btn" onClick={() => setMazzoVisto(null)}>← Tutti i mazzi</button>
            <h3>{m.nome} <small>{m.carte.length} carte</small></h3>
            <p className="muted">{m.descrizione}</p>
            <CurvaCosti carte={m.carte} />
            <div className="griglia-carte">
              {conteggio(m.carte).map(([id, n]) => (
                <div key={id} className="con-copie" onClick={() => setCartaVista(id)}>
                  <Carta def={carta(id)} />
                  {n > 1 && <span className="copie">×{n}</span>}
                </div>
              ))}
            </div>
            {dettaglioCarta}
          </>
        )}
      </Pannello>
    );
  }

  const tot = stats.vittorie + stats.sconfitte;
  const bossBattuti = progresso.battuti.length;
  return (
    <div className="menu">
      <div className="titolo">
        <Icon nome="double-dragon" size={72} color="#ffb347" />
        <h1>Draghi<span>Carte</span></h1>
        <p className="muted">Duello di carte elementali contro l'IA</p>
      </div>

      {!config.tutorialFatto && (
        <button className="btn tutorial-btn" onClick={onTutorial}>
          <Icon nome="graduate-cap" size="1.3em" /> <span><b>Prima volta?</b> Gioca il tutorial guidato (5 minuti)</span>
        </button>
      )}

      <button className="btn campagna-btn" onClick={() => setVista('campagna')}>
        <Icon nome="trophy-cup" size="1.4em" />
        <span><b>Campagna</b><small>{bossBattuti === 0 ? 'Dieci avversari da battere, carte da sbloccare' : bossBattuti >= CAMPAGNA.length ? 'Completata!' : `${bossBattuti}/${CAMPAGNA.length} avversari battuti · prossimo: ${CAMPAGNA[bossBattuti].nome}`}</small></span>
      </button>

      <label className="campo-form">
        <span>Il tuo nome</span>
        <input value={config.nomeGiocatore} maxLength={16} onChange={(e) => set('nomeGiocatore', e.target.value || 'Giocatore')} />
      </label>

      <div className="campo-form">
        <span>Il tuo mazzo</span>
        <div className="scelte">
          {tuttiMazzi.map((m) => (
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
        <small className="muted">{LIVELLI[config.livello].descrizione} L'IA adatta lo stile al suo mazzo: Fuoco aggressivo, Terra difensivo, Ghiaccio di controllo.</small>
      </div>

      <div className="campo-form riga">
        <label className="riga-opzione"><input type="checkbox" checked={config.suoni} onChange={(e) => set('suoni', e.target.checked)} /> <span>Suoni</span></label>
        <label className="riga-opzione"><input type="checkbox" checked={config.veloce} onChange={(e) => set('veloce', e.target.checked)} /> <span>IA veloce</span></label>
      </div>

      <button className="btn primario grande-btn" onClick={onGioca}>Partita libera</button>

      <div className="riga-btn">
        <button className="btn" onClick={() => setVista('mazzi')}>Mazzi</button>
        <button className="btn" onClick={() => setVista('carte')}>Carte</button>
        <button className="btn" onClick={() => setVista('regole')}>Regole</button>
        <button className="btn" onClick={() => setVista('crediti')}>Crediti</button>
        {config.tutorialFatto && <button className="btn" onClick={onTutorial}>Tutorial</button>}
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

// ---------------------------------------------------------------------------
// Deck builder
// ---------------------------------------------------------------------------
interface EditorProps {
  iniziale: DeckDef;
  collezione: Set<string>;
  onSalva: (m: DeckDef) => void;
  onAnnulla: () => void;
  onElimina: (id: string) => void;
  onCarta: (id: string) => void;
}

function EditorMazzo({ iniziale, collezione, onSalva, onAnnulla, onElimina, onCarta }: EditorProps) {
  const [nome, setNome] = useState(iniziale.nome);
  const [carte, setCarte] = useState<string[]>(iniziale.carte);
  const [filtro, setFiltro] = useState<Element | 'neutro' | 'tutti'>('tutti');
  const [tipo, setTipo] = useState<'tutti' | 'drago' | 'incantesimo'>('tutti');
  const [errori, setErrori] = useState<string[]>([]);
  const [confermaElimina, setConfermaElimina] = useState(false);

  const conta = useMemo(() => { const m = new Map<string, number>(); for (const id of carte) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [carte]);
  const disponibili = useMemo(() => [...DRAGHI_BASE, ...DRAGHI_EFFETTO, ...INCANTESIMI]
    .filter((c) => collezione.has(c.id))
    .filter((c) => filtro === 'tutti' || c.elemento === filtro)
    .filter((c) => tipo === 'tutti' || c.kind === tipo)
    .sort((a, b) => a.costo - b.costo || a.nome.localeCompare(b.nome)), [collezione, filtro, tipo]);

  const aggiungi = (id: string) => { if ((conta.get(id) ?? 0) < MAX_COPIE && carte.length < DIM_MAZZO) setCarte([...carte, id]); };
  const togli = (id: string) => { const i = carte.lastIndexOf(id); if (i >= 0) setCarte([...carte.slice(0, i), ...carte.slice(i + 1)]); };
  const salva = () => {
    const problemi = validaMazzo(carte, collezione);
    if (problemi.length) { setErrori(problemi); return; }
    const el = elementoDominante(carte);
    onSalva({ ...iniziale, nome: nome.trim() || iniziale.nome, carte, elemento: el, descrizione: el === 'misto' ? 'Mazzo misto personalizzato' : `Mazzo ${ELEMENTI[el].nome} personalizzato` });
  };

  return (
    <div className="pagina editor">
      <header className="pagina-testa">
        <button className="btn-icona" onClick={onAnnulla}>←</button>
        <input className="nome-mazzo" value={nome} maxLength={24} onChange={(e) => setNome(e.target.value)} />
        <span className={`contatore ${carte.length === DIM_MAZZO ? 'ok' : ''}`}>{carte.length}/{DIM_MAZZO}</span>
      </header>
      <div className="pagina-corpo">
        <CurvaCosti carte={carte} />
        <div className="mazzo-corrente">
          {conteggio(carte).map(([id, n]) => (
            <button key={id} className={`riga-carta el-${carta(id).elemento}`} onClick={() => togli(id)} title="Tocca per togliere una copia">
              <span className="rc-costo">{carta(id).costo}</span>
              <span className="rc-nome">{carta(id).nome}</span>
              <span className="rc-n">×{n}</span>
              <span className="rc-meno">−</span>
            </button>
          ))}
          {carte.length === 0 && <p className="muted">Tocca le carte qui sotto per aggiungerle (massimo {MAX_COPIE} copie).</p>}
        </div>
        <div className="scelte">
          {(['tutti', 'fuoco', 'ghiaccio', 'terra', 'neutro'] as const).map((f) => (
            <button key={f} className={`chip ${f !== 'tutti' ? `el-${f}` : ''} ${filtro === f ? 'on' : ''}`} onClick={() => setFiltro(f)}>
              {f === 'tutti' ? 'Tutti' : f === 'neutro' ? 'Neutri' : ELEMENTI[f].nome}
            </button>
          ))}
          {(['drago', 'incantesimo'] as const).map((t) => (
            <button key={t} className={`chip ${tipo === t ? 'on' : ''}`} onClick={() => setTipo(tipo === t ? 'tutti' : t)}>{t === 'drago' ? 'Draghi' : 'Incantesimi'}</button>
          ))}
        </div>
        <div className="griglia-carte">
          {disponibili.map((c) => {
            const n = conta.get(c.id) ?? 0;
            return (
              <div key={c.id} className={`con-copie ${n >= MAX_COPIE ? 'piena' : ''}`}>
                <Carta def={c} onClick={() => aggiungi(c.id)} disabilitata={n >= MAX_COPIE || carte.length >= DIM_MAZZO} />
                {n > 0 && <span className="copie">×{n}</span>}
                <button className="info" onClick={(e) => { e.stopPropagation(); onCarta(c.id); }} title="Dettagli">i</button>
              </div>
            );
          })}
        </div>
        {errori.length > 0 && <div className="errori">{errori.map((e, i) => <div key={i}>{e}</div>)}</div>}
        <div className="riga-btn">
          {!confermaElimina && <button className="btn" onClick={() => setConfermaElimina(true)}>Elimina</button>}
          {confermaElimina && <button className="btn pericoloso" onClick={() => onElimina(iniziale.id)}>Conferma eliminazione</button>}
          <button className="btn" onClick={onAnnulla}>Annulla</button>
          <button className="btn primario" onClick={salva}>Salva</button>
        </div>
      </div>
    </div>
  );
}

function CurvaCosti({ carte }: { carte: string[] }) {
  const costi = Array.from({ length: 9 }, (_, i) => carte.filter((id) => Math.min(carta(id).costo, 8) === i).length);
  const max = Math.max(1, ...costi);
  const draghi = carte.filter((id) => carta(id).kind === 'drago').length;
  return (
    <div className="curva">
      <div className="curva-barre">
        {costi.map((n, i) => (
          <div key={i} className="curva-col" title={`${n} carte da ${i}`}>
            <span className="curva-n">{n || ''}</span>
            <div className="curva-barra" style={{ height: `${(n / max) * 100}%` }} />
            <span className="curva-costo">{i === 8 ? '8+' : i}</span>
          </div>
        ))}
      </div>
      <small className="muted">{draghi} draghi · {carte.length - draghi} incantesimi</small>
    </div>
  );
}

function conteggio(ids: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => carta(a[0]).costo - carta(b[0]).costo || carta(a[0]).nome.localeCompare(carta(b[0]).nome));
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
      <p>Porta a zero i punti vita dell'avversario evocando draghi e lanciando incantesimi.</p>
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
      <p>Chi <b>attacca</b> con vantaggio elementale infligge <b>+1 danno</b> (almeno +25%); in svantaggio infligge 1 danno in meno (minimo 1). Il contrattacco del difensore non è modificato: il triangolo premia chi prende l'iniziativa. Vale anche per gli incantesimi di danno e per gli effetti dei draghi.</p>
      <h3>Abilità</h3>
      <p><b>Guardiano</b>: i draghi avversari devono attaccarlo per primo. <b>Carica</b>: può attaccare nel turno in cui viene evocato. <b>Rigenerazione</b>: recupera 2 vita alla fine del tuo turno. <b>Scudo</b>: ignora il primo danno subito. <b>Congelato</b>: salta il prossimo attacco.</p>
      <p><b>Evocazione</b>: effetto che scatta quando il drago entra in campo. <b>Morte</b>: effetto che scatta quando viene distrutto. I bersagli sono automatici (il drago avversario più debole, il più forte, tutti…).</p>
      <h3>Campagna e mazzi</h3>
      <p>Nella campagna affronti dieci avversari con mazzi e difficoltà crescenti; ogni vittoria sblocca carte. Con il deck builder crei mazzi da 30 carte (massimo 2 copie ciascuna) usando la tua collezione.</p>
      <h3>Fatica</h3>
      <p>Se devi pescare a mazzo vuoto subisci danni crescenti. Con 7 carte in mano, la carta pescata viene scartata.</p>
    </div>
  );
}

function Crediti() {
  return (
    <div className="prosa">
      <p>Le icone delle carte e dell'interfaccia provengono da <b>game-icons.net</b>, licenza CC BY 3.0. Autori: {Object.entries(AUTORI_ICONE).map(([a, n]) => `${a} (${n.length})`).join(', ')}.</p>
      <p>Le illustrazioni delle carte sono generate proceduralmente; se nella cartella <code>public/draghi/</code> è presente un'immagine <code>&lt;id&gt;.jpg</code>, la carta la usa al posto dell'illustrazione generata (vedi <code>public/draghi/README.md</code>).</p>
      <p>Suoni sintetizzati con WebAudio. Nessun dato lascia il dispositivo: partite, progressi della campagna e mazzi sono salvati localmente.</p>
    </div>
  );
}
