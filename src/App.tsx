import { useCallback, useEffect, useState } from 'react';
import { Menu } from './components/Menu';
import { Partita, type ConfigPartita, type SetupPartita } from './components/Partita';
import { MAZZI, mazzo, elementoDominante, registraMazziPersonalizzati, type DeckDef } from './engine/decks';
import { PROFILI, LIVELLI } from './engine/ai';
import { CAMPAGNA, registraVittoria, type Boss, type ProgressoCampagna } from './engine/campagna';
import {
  caricaCampagna, caricaConfig, caricaMazziPersonalizzati, caricaStats, registraEsito, salvaCampagna, salvaConfig, salvaMazziPersonalizzati, type Statistiche,
} from './storage';

export default function App() {
  const [config, setConfig] = useState<ConfigPartita>(caricaConfig);
  const [stats, setStats] = useState<Statistiche>(caricaStats);
  const [progresso, setProgresso] = useState<ProgressoCampagna>(caricaCampagna);
  const [mazziPersonalizzati, setMazziPersonalizzati] = useState<DeckDef[]>(caricaMazziPersonalizzati);
  const [setup, setSetup] = useState<SetupPartita | null>(null);
  const [numero, setNumero] = useState(0);
  const [vistaMenu, setVistaMenu] = useState<'menu' | 'campagna'>('menu');

  useEffect(() => { registraMazziPersonalizzati(mazziPersonalizzati); }, [mazziPersonalizzati]);

  const cambia = (c: ConfigPartita) => { setConfig(c); salvaConfig(c); };

  const mazzoGiocatore = (): string | string[] => {
    try { return mazzo(config.mazzoGiocatore).carte; } catch { return MAZZI[0].carte; }
  };

  const avvia = (s: SetupPartita) => { setSetup(s); setNumero((n) => n + 1); };

  const gioca = () => {
    const idIA = config.mazzoIA === 'casuale' ? MAZZI[Math.floor(Math.random() * MAZZI.length)].id : config.mazzoIA;
    const m = mazzo(idIA);
    avvia({
      nomeGiocatore: config.nomeGiocatore,
      nomeIA: `IA ${LIVELLI[config.livello].nome} · ${m.nome}`,
      mazzoIo: mazzoGiocatore(),
      mazzoIA: m.carte,
      livello: config.livello,
      profilo: PROFILI[m.elemento === 'misto' ? elementoDominante(m.carte) : m.elemento],
    });
  };

  const campagna = (boss: Boss) => {
    const m = mazzo(boss.mazzo);
    avvia({
      nomeGiocatore: config.nomeGiocatore,
      nomeIA: boss.nome,
      mazzoIo: mazzoGiocatore(),
      mazzoIA: m.carte,
      livello: boss.livello,
      profilo: PROFILI[m.elemento === 'misto' ? elementoDominante(m.carte) : m.elemento],
      vita: [boss.vitaGiocatore, boss.vitaIA],
      boss,
    });
  };

  const tutorial = () => {
    avvia({
      nomeGiocatore: config.nomeGiocatore,
      nomeIA: 'Maestro Pip',
      mazzoIo: 'fuoco',
      mazzoIA: mazzo('c-cuccioli').carte.filter((id) => !id.startsWith('f')), // solo cuccioli di Ghiaccio e Terra: il Fuoco del giocatore ha vantaggio
      livello: 1,
      profilo: PROFILI.misto,
      vita: [25, 15],
      tutorial: true,
    });
  };

  const onFine = useCallback((vinto: boolean) => {
    if (!setup) return;
    if (setup.tutorial) {
      cambiaSicuro({ tutorialFatto: true });
      return;
    }
    setStats((s) => registraEsito(s, setup.livello, vinto));
    if (setup.boss && vinto) {
      setProgresso((p) => { const np = registraVittoria(p, setup.boss!); salvaCampagna(np); return np; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  function cambiaSicuro(parziale: Partial<ConfigPartita>) {
    setConfig((c) => { const nc = { ...c, ...parziale }; salvaConfig(nc); return nc; });
  }

  if (setup) {
    return <Partita key={numero} setup={setup} suoni={config.suoni} veloce={config.veloce} onFine={onFine} onEsci={() => { setVistaMenu(setup.boss ? 'campagna' : 'menu'); setSetup(null); }} />;
  }
  return (
    <Menu
      config={config}
      stats={stats}
      progresso={progresso}
      mazziPersonalizzati={mazziPersonalizzati}
      onCambia={cambia}
      onGioca={gioca}
      onCampagna={campagna}
      onTutorial={tutorial}
      onSalvaMazzi={(m) => { setMazziPersonalizzati(m); salvaMazziPersonalizzati(m); }}
      vistaIniziale={vistaMenu}
    />
  );
}

export { CAMPAGNA };
