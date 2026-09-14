import { useCallback, useState } from 'react';
import { Menu } from './components/Menu';
import { Partita, type ConfigPartita } from './components/Partita';
import { MAZZI } from './engine/decks';
import { caricaConfig, caricaStats, registraEsito, salvaConfig, type Statistiche } from './storage';

export default function App() {
  const [config, setConfig] = useState<ConfigPartita>(caricaConfig);
  const [stats, setStats] = useState<Statistiche>(caricaStats);
  const [inGioco, setInGioco] = useState(false);
  const [configPartita, setConfigPartita] = useState<ConfigPartita | null>(null);
  const [numero, setNumero] = useState(0);

  const cambia = (c: ConfigPartita) => { setConfig(c); salvaConfig(c); };

  const gioca = () => {
    const mazzoIA = config.mazzoIA === 'casuale' ? MAZZI[Math.floor(Math.random() * MAZZI.length)].id : config.mazzoIA;
    setConfigPartita({ ...config, mazzoIA });
    setNumero((n) => n + 1);
    setInGioco(true);
  };

  const onFine = useCallback((vinto: boolean) => {
    setStats((s) => registraEsito(s, config.livello, vinto));
  }, [config.livello]);

  if (inGioco && configPartita) {
    return <Partita key={numero} config={configPartita} onFine={onFine} onEsci={() => setInGioco(false)} />;
  }
  return <Menu config={config} stats={stats} onCambia={cambia} onGioca={gioca} />;
}
