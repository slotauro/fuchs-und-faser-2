import { ANIMALS, ANIMAL_IDS, MAPS, MIN_PLAYERS, type AnimalId, type LobbyState } from '@ff/shared';
import { ANIMAL_COLORS } from '../rendering/ActorView';
import { formatTime, h, icon } from './dom';
import { ICONS } from './icons';

export interface LobbyActions {
  pickAnimal(animal: AnimalId): void;
  pickMap(mapId: string): void;
  start(): void;
  leave(): void;
}

/** Lobby eines Koop-Raums: Code und Link, Spielerliste, Tier- und Kartenwahl, Start durch den Host. */
export class LobbyView {
  private message = '';

  constructor(
    private readonly container: HTMLElement,
    private readonly portraits: Record<AnimalId, string>,
    private readonly selfId: string,
    private readonly actions: LobbyActions,
  ) {}

  setMessage(message: string): void {
    this.message = message;
  }

  render(lobby: LobbyState): void {
    const self = lobby.players.find((p) => p.id === this.selfId);
    const isHost = self?.isHost ?? false;
    const taken = new Set(lobby.players.filter((p) => p.id !== this.selfId).map((p) => p.animal));
    const connected = lobby.players.filter((p) => p.connected).length;
    const link = `${location.origin}${location.pathname}?room=${lobby.code}`;
    const copyButton = h(
      'button',
      {
        class: 'btn',
        onclick: () => {
          void navigator.clipboard?.writeText(link).then(() => (copyButton.lastChild!.textContent = 'Kopiert!'));
        },
      },
      icon(ICONS.copy),
      h('span', {}, 'Einladungslink kopieren'),
    );

    const screen = h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'menu-card wide lobby', 'data-testid': 'lobby' },
        h('button', { class: 'back-btn', onclick: () => this.actions.leave() }, icon(ICONS.back), 'Raum verlassen'),
        h(
          'div',
          { class: 'lobby-head' },
          h('div', {}, h('h2', {}, 'Koop-Lobby'), h('p', { class: 'muted' }, 'Teile den Code mit deinen Freunden.')),
          h('div', { class: 'room-code', 'data-testid': 'lobby-code' }, lobby.code),
          copyButton,
        ),
        h(
          'div',
          { class: 'lobby-players' },
          ...lobby.players.map((p) =>
            h(
              'div',
              { class: `lobby-player ${p.connected ? '' : 'offline'}`, style: `--animal: ${ANIMAL_COLORS[p.animal]}` },
              h('img', { src: this.portraits[p.animal], alt: '' }),
              h('strong', {}, p.name, p.id === this.selfId ? ' (du)' : ''),
              h('span', {}, ANIMALS[p.animal].name, p.isHost ? ' · Host' : '', p.connected ? '' : ' · getrennt'),
            ),
          ),
          ...Array.from({ length: Math.max(0, 4 - lobby.players.length) }, () =>
            h('div', { class: 'lobby-player empty' }, h('span', {}, 'Freier Platz')),
          ),
        ),
        h('h3', {}, 'Dein Tier'),
        h(
          'div',
          { class: 'animal-grid compact' },
          ...ANIMAL_IDS.map((id) =>
            h(
              'button',
              {
                class: `animal-card ${self?.animal === id ? 'selected' : ''}`,
                disabled: taken.has(id),
                'data-testid': `lobby-animal-${id}`,
                onclick: () => this.actions.pickAnimal(id),
              },
              h('img', { src: this.portraits[id], alt: '' }),
              h('strong', {}, ANIMALS[id].name),
              h('span', { class: 'ability-tag' }, ANIMALS[id].ability),
            ),
          ),
        ),
        h('h3', {}, isHost ? 'Baustelle wählen' : 'Baustelle'),
        h(
          'div',
          { class: 'map-list' },
          ...MAPS.map((m, i) =>
            h(
              'button',
              {
                class: `map-card ${m.id === lobby.mapId ? 'selected' : ''}`,
                disabled: !isHost && m.id !== lobby.mapId,
                onclick: () => isHost && this.actions.pickMap(m.id),
              },
              h('span', { class: 'map-num' }, String(i + 1)),
              h('span', { class: 'map-info' }, h('strong', {}, m.name), h('span', {}, m.order)),
              h('span', { class: 'map-time' }, formatTime(m.timeLimit)),
            ),
          ),
        ),
        this.message ? h('p', { class: 'menu-message', role: 'alert' }, this.message) : null,
        isHost
          ? h(
              'button',
              {
                class: 'btn primary big',
                'data-testid': 'lobby-start',
                disabled: connected < MIN_PLAYERS,
                onclick: () => this.actions.start(),
              },
              icon(ICONS.play),
              connected < MIN_PLAYERS ? 'Warte auf Mitspieler …' : 'Runde starten',
            )
          : h('p', { class: 'waiting' }, 'Warte, bis der Host die Runde startet …'),
      ),
    );
    this.container.replaceChildren(screen);
  }
}
