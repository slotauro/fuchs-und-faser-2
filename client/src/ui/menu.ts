import { ANIMALS, ANIMAL_IDS, MAPS, MAX_NAME_LENGTH, type AnimalId } from '@ff/shared';
import type { Settings } from '../game/settings';
import { formatTime, h, icon } from './dom';
import { ICONS } from './icons';

export interface MenuActions {
  playSolo(animal: AnimalId, mapId: string): void;
  createRoom(animal: AnimalId, mapId: string): void;
  joinRoom(code: string, animal: AnimalId): void;
  saveSettings(settings: Settings): void;
}

/** Hauptmenü, Tier- und Kartenwahl, Einstellungen. Reines HTML/CSS. */
export class Menu {
  private animal: AnimalId = 'fox';
  private mapId = MAPS[0]!.id;

  constructor(
    private readonly container: HTMLElement,
    private readonly portraits: Record<AnimalId, string>,
    private readonly settings: Settings,
    private readonly actions: MenuActions,
  ) {}

  private screen(...children: (Node | null)[]): HTMLElement {
    const el = h('div', { class: 'screen' }, ...children);
    this.container.replaceChildren(el);
    return el;
  }

  showMain(message?: string): void {
    const name = h('input', {
      id: 'player-name',
      maxlength: MAX_NAME_LENGTH,
      value: this.settings.name,
      'aria-label': 'Dein Name',
      oninput: () => {
        this.settings.name = name.value.trim().slice(0, MAX_NAME_LENGTH) || 'Spieler';
        this.actions.saveSettings(this.settings);
      },
    });
    this.screen(
      h(
        'div',
        { class: 'menu-card main-menu' },
        h('div', { class: 'logo' }, h('span', { class: 'logo-name' }, 'Fuchs und Faser'), h('span', { class: 'logo-sequel' }, '2')),
        h('p', { class: 'tagline' }, 'Grabt Gräben, verlegt Glasfaser und bringt die Tierstadt online, bevor die Zeit abläuft.'),
        h(
          'div',
          { class: 'portrait-row' },
          ...ANIMAL_IDS.map((id) => h('img', { src: this.portraits[id], alt: ANIMALS[id].name, class: 'portrait-small' })),
        ),
        message ? h('p', { class: 'menu-message', role: 'alert' }, message) : null,
        h('label', { class: 'field' }, h('span', {}, 'Dein Name'), name),
        h('button', { class: 'btn primary big', 'data-testid': 'play', onclick: () => this.showSetup('solo') }, icon(ICONS.play), 'Spielen'),
        h(
          'div',
          { class: 'menu-row' },
          h('button', { class: 'btn', 'data-testid': 'create-room', onclick: () => this.showSetup('create') }, icon(ICONS.users), 'Online-Koop erstellen'),
          h('button', { class: 'btn', 'data-testid': 'join-room', onclick: () => this.showJoin() }, icon(ICONS.key), 'Raum beitreten'),
        ),
        h('button', { class: 'btn ghost', onclick: () => this.showSettings() }, icon(ICONS.sound), 'Einstellungen'),
      ),
    );
  }

  private animalPicker(onPick?: () => void): HTMLElement {
    const grid = h('div', { class: 'animal-grid', role: 'radiogroup', 'aria-label': 'Tier wählen' });
    const render = () => {
      grid.replaceChildren(
        ...ANIMAL_IDS.map((id) => {
          const info = ANIMALS[id];
          return h(
            'button',
            {
              class: `animal-card ${id === this.animal ? 'selected' : ''}`,
              role: 'radio',
              'aria-checked': String(id === this.animal),
              'data-testid': `animal-${id}`,
              onclick: () => {
                this.animal = id;
                render();
                onPick?.();
              },
            },
            h('img', { src: this.portraits[id], alt: '' }),
            h('strong', {}, info.name),
            h('span', { class: 'role' }, info.role),
            h('span', { class: 'ability-tag' }, info.ability),
            h('span', { class: 'desc' }, info.description),
          );
        }),
      );
    };
    render();
    return grid;
  }

  private mapPicker(): HTMLElement {
    const list = h('div', { class: 'map-list', role: 'radiogroup', 'aria-label': 'Karte wählen' });
    const render = () => {
      list.replaceChildren(
        ...MAPS.map((m, i) =>
          h(
            'button',
            {
              class: `map-card ${m.id === this.mapId ? 'selected' : ''}`,
              role: 'radio',
              'aria-checked': String(m.id === this.mapId),
              'data-testid': `map-${m.id}`,
              onclick: () => {
                this.mapId = m.id;
                render();
              },
            },
            h('span', { class: 'map-num' }, String(i + 1)),
            h('span', { class: 'map-info' }, h('strong', {}, m.name), h('span', {}, m.order)),
            h('span', { class: 'map-time' }, formatTime(m.timeLimit)),
          ),
        ),
      );
    };
    render();
    return list;
  }

  private showSetup(kind: 'solo' | 'create'): void {
    this.screen(
      h(
        'div',
        { class: 'menu-card wide' },
        h('button', { class: 'back-btn', onclick: () => this.showMain() }, icon(ICONS.back), 'Zurück'),
        h('h2', {}, kind === 'solo' ? 'Wähle dein Tier' : 'Koop-Raum erstellen'),
        this.animalPicker(),
        h('h3', {}, 'Baustelle'),
        this.mapPicker(),
        h(
          'button',
          {
            class: 'btn primary big',
            'data-testid': 'start',
            onclick: () =>
              kind === 'solo' ? this.actions.playSolo(this.animal, this.mapId) : this.actions.createRoom(this.animal, this.mapId),
          },
          icon(kind === 'solo' ? ICONS.play : ICONS.users),
          kind === 'solo' ? 'Los geht’s' : 'Raum erstellen',
        ),
      ),
    );
  }

  showJoin(prefill = '', error?: string): void {
    const code = h('input', {
      class: 'code-input',
      'data-testid': 'room-code',
      maxlength: 6,
      value: prefill,
      placeholder: 'ABC123',
      autocomplete: 'off',
      'aria-label': 'Raumcode',
      oninput: () => (code.value = code.value.toUpperCase()),
    });
    this.screen(
      h(
        'div',
        { class: 'menu-card wide' },
        h('button', { class: 'back-btn', onclick: () => this.showMain() }, icon(ICONS.back), 'Zurück'),
        h('h2', {}, 'Raum beitreten'),
        h('label', { class: 'field' }, h('span', {}, 'Raumcode'), code),
        error ? h('p', { class: 'menu-message', role: 'alert' }, error) : null,
        h('h3', {}, 'Dein Tier'),
        this.animalPicker(),
        h(
          'button',
          {
            class: 'btn primary big',
            'data-testid': 'join',
            onclick: () => this.actions.joinRoom(code.value.trim().toUpperCase(), this.animal),
          },
          icon(ICONS.key),
          'Beitreten',
        ),
      ),
    );
    code.focus();
  }

  private showSettings(): void {
    const toggle = (label: string, key: 'sound' | 'reduceMotion' | 'lowGraphics') => {
      const input = h('input', {
        type: 'checkbox',
        checked: this.settings[key],
        onchange: () => {
          this.settings[key] = input.checked;
          this.actions.saveSettings(this.settings);
        },
      });
      return h('label', { class: 'toggle' }, input, h('span', {}, label));
    };
    this.screen(
      h(
        'div',
        { class: 'menu-card' },
        h('button', { class: 'back-btn', onclick: () => this.showMain() }, icon(ICONS.back), 'Zurück'),
        h('h2', {}, 'Einstellungen'),
        toggle('Soundeffekte', 'sound'),
        toggle('Animationen reduzieren', 'reduceMotion'),
        toggle('Schonende Grafik (für ältere Rechner)', 'lowGraphics'),
        h(
          'div',
          { class: 'controls-help' },
          h('span', {}, h('b', {}, 'WASD / Pfeiltasten'), ' laufen'),
          h('span', {}, h('b', {}, 'E / Leertaste'), ' graben, Kabel holen und verlegen, anschließen'),
          h('span', {}, h('b', {}, 'F'), ' Spezialfähigkeit'),
          h('span', {}, h('b', {}, 'Esc'), ' Pause'),
        ),
      ),
    );
  }

  get selectedAnimal(): AnimalId {
    return this.animal;
  }
}
