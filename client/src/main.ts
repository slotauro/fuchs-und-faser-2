import './style.css';
import { ANIMAL_IDS, MAPS, isMapId, type AnimalId, type LobbyState, type Snapshot } from '@ff/shared';
import { AssetManager } from './assets/AssetManager';
import { LocalController } from './controller/LocalController';
import { NetworkController } from './controller/NetworkController';
import { GameSession } from './game/GameSession';
import { loadSettings, saveSettings } from './game/settings';
import { NetworkGateway } from './net/NetworkGateway';
import { showAssetPreview } from './ui/assetPreview';
import { h } from './ui/dom';
import { LobbyView } from './ui/lobby';
import { Menu } from './ui/menu';
import { renderPortraits } from './ui/portraits';

const stage = document.getElementById('stage')!;
const overlay = document.getElementById('overlay')!;

interface CoopState {
  playerId: string;
  lobby: LobbyState;
  view: LobbyView;
}

class App {
  private readonly assets = new AssetManager();
  private readonly settings = loadSettings();
  private portraits!: Record<AnimalId, string>;
  private menu!: Menu;
  private session: GameSession | null = null;
  private net: NetworkGateway | null = null;
  private coop: CoopState | null = null;
  /** Letzte bekannte Kacheln: Beim Wiederbeitritt kommt der volle Zustand vor der Bestätigung an. */
  private cachedCells: Snapshot['cells'];

  async start(): Promise<void> {
    const bar = h('div', { class: 'loading-bar' });
    overlay.replaceChildren(
      h(
        'div',
        { class: 'screen' },
        h('div', { class: 'loading' }, h('p', {}, 'Baustelle wird eingerichtet …'), h('div', { class: 'loading-track' }, bar)),
      ),
    );
    try {
      await this.assets.loadAll((loaded, total) => (bar.style.width = `${(loaded / total) * 100}%`));
    } catch (error) {
      overlay.replaceChildren(
        h('div', { class: 'screen' }, h('p', { class: 'menu-message' }, `Modelle konnten nicht geladen werden: ${String(error)}`)),
      );
      return;
    }
    this.portraits = renderPortraits(this.assets);
    this.menu = new Menu(overlay, this.portraits, this.settings, {
      playSolo: (animal, mapId) => this.playSolo(animal, mapId),
      createRoom: (animal, mapId) => void this.createRoom(animal, mapId),
      joinRoom: (code, animal) => void this.joinRoom(code, animal),
      saveSettings: (s) => saveSettings(s),
    });

    const params = new URLSearchParams(location.search);
    // Direktstart über URL, z. B. ?map=test&animal=fox (für Tests und Links).
    const mapId = params.get('map');
    const animal = params.get('animal') as AnimalId | null;
    if (mapId && isMapId(mapId)) {
      this.playSolo(animal && ANIMAL_IDS.includes(animal) ? animal : 'fox', mapId);
      return;
    }
    // Nach Neuladen im selben Tab automatisch wieder in den Raum.
    const stored = NetworkGateway.stored();
    if (stored && (await this.rejoin(stored))) return;
    const room = params.get('room');
    if (room) {
      this.menu.showJoin(room.toUpperCase());
      return;
    }
    this.menu.showMain();
  }

  private endSession(): void {
    this.session?.dispose();
    this.session = null;
  }

  private playSolo(animal: AnimalId, mapId: string): void {
    this.endSession();
    overlay.replaceChildren();
    const controller = new LocalController(mapId, animal, this.settings.name);
    const index = MAPS.findIndex((m) => m.id === mapId);
    const next = MAPS[index + 1];
    this.session = new GameSession(stage, overlay, this.assets, controller, this.settings, {
      onExit: () => {
        this.endSession();
        this.menu.showMain();
      },
      onRestart: () => this.playSolo(animal, mapId),
      onNext: next ? () => this.playSolo(animal, next.id) : undefined,
    });
  }

  // ---------- Koop ----------

  private gateway(): NetworkGateway {
    if (!this.net) {
      this.net = new NetworkGateway();
      this.net.socket.on('lobby', (lobby) => this.onLobby(lobby));
      this.net.socket.on('snapshot', (snapshot) => this.onSnapshot(snapshot));
      this.net.socket.on('connect', () => {
        // Nach einem Verbindungsabbruch automatisch wieder einsteigen.
        const stored = NetworkGateway.stored();
        if (stored && this.coop) void this.net!.rejoin(stored);
      });
    }
    return this.net;
  }

  private async createRoom(animal: AnimalId, mapId: string): Promise<void> {
    const r = await this.gateway().create(this.settings.name, animal, mapId);
    if (!r.ok) return this.menu.showMain(r.error.message);
    this.enterLobby(r.data.playerId, r.data.lobby);
  }

  private async joinRoom(code: string, animal: AnimalId): Promise<void> {
    if (!/^[A-Z0-9]{6}$/.test(code)) return this.menu.showJoin(code, 'Der Raumcode hat sechs Zeichen.');
    const r = await this.gateway().join(code, this.settings.name, animal);
    if (!r.ok) return this.menu.showJoin(code, r.error.message);
    this.enterLobby(r.data.playerId, r.data.lobby);
  }

  private async rejoin(stored: { code: string; token: string }): Promise<boolean> {
    const r = await this.gateway().rejoin(stored);
    if (!r.ok) return false;
    this.enterLobby(r.data.playerId, r.data.lobby);
    return true;
  }

  private enterLobby(playerId: string, lobby: LobbyState): void {
    const net = this.gateway();
    const view = new LobbyView(overlay, this.portraits, playerId, {
      pickAnimal: (animal) =>
        void net.update({ animal }).then((r) => {
          if (!r.ok) this.showLobbyMessage(r.error.message);
        }),
      pickMap: (mapId) => void net.update({ mapId }),
      start: () =>
        void net.start().then((r) => {
          if (!r.ok) this.showLobbyMessage(r.error.message);
        }),
      leave: () => this.leaveRoom(),
    });
    this.coop = { playerId, lobby, view };
    // Raumcode in der Adresse, damit ein Neuladen oder Teilen funktioniert.
    history.replaceState(null, '', `?room=${lobby.code}`);
    if (lobby.phase === 'lobby') view.render(lobby);
  }

  private showLobbyMessage(message: string): void {
    if (!this.coop) return;
    this.coop.view.setMessage(message);
    this.coop.view.render(this.coop.lobby);
  }

  private onLobby(lobby: LobbyState): void {
    if (!this.coop || lobby.code !== this.coop.lobby.code) return;
    this.coop.lobby = lobby;
    if (lobby.phase === 'lobby') {
      this.cachedCells = undefined;
      if (this.session) this.endSession();
      this.coop.view.setMessage('');
      this.coop.view.render(lobby);
    }
  }

  /** Die erste Momentaufnahme mit Kacheln startet die Koop-Runde auf diesem Client. */
  private onSnapshot(snapshot: Snapshot): void {
    if (snapshot.cells) this.cachedCells = snapshot.cells;
    const cells = this.cachedCells;
    if (!this.coop || this.session || !cells || this.coop.lobby.phase !== 'playing') return;
    if (!snapshot.players.some((p) => p.id === this.coop!.playerId)) return;
    const net = this.gateway();
    overlay.replaceChildren();
    const controller = new NetworkController(net, this.coop.playerId, { ...snapshot, cells });
    this.session = new GameSession(stage, overlay, this.assets, controller, this.settings, {
      onExit: () => this.leaveRoom(),
      onRestart: () => void net.backToLobby(),
    });
  }

  private leaveRoom(): void {
    this.endSession();
    this.cachedCells = undefined;
    this.net?.leave();
    this.coop = null;
    history.replaceState(null, '', location.pathname);
    this.menu.showMain();
  }
}

if (new URLSearchParams(location.search).get('view') === 'assets') void showAssetPreview(stage, overlay);
else void new App().start();
