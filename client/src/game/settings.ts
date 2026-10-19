export interface Settings {
  name: string;
  sound: boolean;
  reduceMotion: boolean;
  /** Schonende Grafik: keine Schatten, keine Kantenglättung, einfache Pixeldichte. */
  lowGraphics: boolean;
}

const KEY = 'fiber-frenzy-settings';

export function loadSettings(): Settings {
  const defaults: Settings = {
    name: 'Spieler',
    sound: true,
    reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    lowGraphics: false,
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Speicher nicht verfügbar (privates Fenster): Einstellungen gelten nur für diese Sitzung.
  }
}
