import { ANIMALS, CARRY_CAPACITY, findPlayer, type GameState, type RoundResult } from '@ff/shared';
import { ANIMAL_COLORS } from '../rendering/ActorView';
import { formatTime, h, icon } from './dom';
import { ICONS } from './icons';

export interface HudOptions {
  mapName: string;
  order: string;
  mode: 'solo' | 'coop';
  onPause(): void;
  onResume(): void;
  onRestart(): void;
  onExit(): void;
  onNext?: () => void;
  onAbility(): void;
}

/** HTML/CSS-Oberfläche über der 3D-Szene: Timer, Punkte, Kabel, Fähigkeit, Meldungen. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly time = h('span', { 'data-testid': 'time' });
  private readonly score = h('span', { 'data-testid': 'score' });
  private readonly houses = h('span', { 'data-testid': 'houses' });
  private readonly carrying = h('span', { 'data-testid': 'carrying' });
  private readonly stock = h('span', { 'data-testid': 'stock' });
  private readonly abilityName = h('span', { class: 'ability-name' });
  private readonly abilityState = h('span', { class: 'ability-state' });
  private readonly abilityFill = h('span', { class: 'ability-fill' });
  private readonly abilityButton: HTMLButtonElement;
  private readonly actionHint = h('div', { class: 'action-hint', 'data-testid': 'action-hint' });
  private readonly toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  private readonly tags = h('div', { class: 'name-tags' });
  private readonly pauseLayer: HTMLElement;
  private resultLayer: HTMLElement | null = null;
  private timerBox: HTMLElement;
  private lastActionHint: string | null = '';

  constructor(
    private readonly container: HTMLElement,
    private readonly options: HudOptions,
  ) {
    this.timerBox = h('div', { class: 'hud-card timer' }, icon(ICONS.clock), this.time);
    this.abilityButton = h(
      'button',
      { class: 'ability', 'data-testid': 'ability', onclick: () => options.onAbility(), title: 'Fähigkeit (F)' },
      this.abilityFill,
      h('span', { class: 'kbd' }, 'F'),
      h('span', { class: 'ability-text' }, this.abilityName, this.abilityState),
    );
    this.pauseLayer = h(
      'div',
      { class: 'modal-layer hidden', 'data-testid': 'pause' },
      h(
        'div',
        { class: 'modal' },
        h('h2', {}, options.mode === 'solo' ? 'Pause' : 'Menü'),
        options.mode === 'coop' ? h('p', {}, 'Im Koop läuft die Zeit weiter.') : null,
        h('button', { class: 'btn primary', onclick: () => options.onResume() }, icon(ICONS.play), 'Weiter'),
        options.mode === 'solo'
          ? h('button', { class: 'btn', onclick: () => options.onRestart() }, icon(ICONS.restart), 'Neu starten')
          : null,
        h('button', { class: 'btn ghost', onclick: () => options.onExit() }, icon(ICONS.back), 'Hauptmenü'),
        h(
          'div',
          { class: 'controls-help' },
          h('span', {}, h('b', {}, 'WASD'), ' laufen'),
          h('span', {}, h('b', {}, 'E / Leertaste'), ' arbeiten'),
          h('span', {}, h('b', {}, 'F'), ' Fähigkeit'),
          h('span', {}, h('b', {}, 'Esc'), ' Pause'),
        ),
      ),
    );

    this.root = h(
      'div',
      { class: 'hud', 'data-testid': 'game' },
      h(
        'div',
        { class: 'hud-top' },
        h(
          'div',
          { class: 'hud-card order' },
          h('div', { class: 'order-title' }, options.mapName),
          h('div', { class: 'order-text' }, options.order),
          h('div', { class: 'order-houses' }, icon(ICONS.house), this.houses),
        ),
        this.timerBox,
        h(
          'div',
          { class: 'hud-right' },
          h('div', { class: 'hud-card score' }, icon(ICONS.star), this.score),
          h(
            'button',
            { class: 'icon-btn', title: 'Pause (Esc)', 'aria-label': 'Pause', onclick: () => options.onPause() },
            icon(ICONS.pause),
          ),
        ),
      ),
      h(
        'div',
        { class: 'hud-bottom' },
        h(
          'div',
          { class: 'hud-card cable' },
          h('div', { class: 'cable-row', title: 'Getragenes Kabel' }, icon(ICONS.coil), this.carrying),
          h('div', { class: 'cable-row muted', title: 'Kabeltrommel' }, icon(ICONS.spool), this.stock),
        ),
        this.actionHint,
        this.abilityButton,
      ),
      this.toasts,
      this.tags,
      this.pauseLayer,
    );
    container.append(this.root);
  }

  update(state: GameState, playerId: string): void {
    const remaining = state.timeLimit - state.time;
    this.time.textContent = formatTime(remaining);
    this.timerBox.classList.toggle('urgent', remaining <= 20 && state.status === 'playing');
    this.score.textContent = String(state.score);
    const online = state.houses.filter((h) => h.online).length;
    this.houses.textContent = `${online} / ${state.houses.length} online`;
    this.stock.textContent = `${state.stationStock} auf der Trommel`;

    const player = findPlayer(state, playerId);
    if (!player) return;
    this.carrying.textContent = `${player.carrying} / ${CARRY_CAPACITY} Kabel`;
    const info = ANIMALS[player.animal];
    this.abilityName.textContent = info.ability;
    const a = player.ability;
    let label = 'bereit';
    let fill = 1;
    let ready = true;
    if (player.animal === 'fox') {
      if (a.used) {
        label = 'verbraucht';
        fill = 0;
        ready = false;
      }
    } else if (a.armed) {
      label = player.animal === 'beaver' ? 'nächster Schacht' : 'nächster Fels';
      ready = false;
    } else if (state.time < a.activeUntil) {
      label = `aktiv ${Math.ceil(a.activeUntil - state.time)} s`;
      ready = false;
    } else if (state.time < a.readyAt) {
      const cooldown = info.cooldown ?? 1;
      label = `${Math.ceil(a.readyAt - state.time)} s`;
      fill = 1 - (a.readyAt - state.time) / cooldown;
      ready = false;
    }
    this.abilityState.textContent = label;
    this.abilityFill.style.transform = `scaleX(${fill})`;
    this.abilityButton.classList.toggle('ready', ready);
    this.abilityButton.style.setProperty('--animal', ANIMAL_COLORS[player.animal]);
  }

  setActionHint(label: string | null): void {
    if (label === this.lastActionHint) return;
    this.lastActionHint = label;
    this.actionHint.replaceChildren();
    if (label) this.actionHint.append(h('span', { class: 'kbd' }, 'E'), label);
    this.actionHint.classList.toggle('visible', label !== null);
  }

  toast(message: string, tone: 'good' | 'bad'): void {
    // Gleiche Meldung nicht stapeln.
    const last = this.toasts.lastElementChild;
    if (last?.textContent === message) last.remove();
    const el = h('div', { class: `toast ${tone}`, 'data-testid': 'toast' }, message);
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => el.classList.add('out'), 2200);
    window.setTimeout(() => el.remove(), 2600);
  }

  floatText(text: string, x: number, y: number): void {
    const el = h('div', { class: 'float-text' }, text);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.root.append(el);
    window.setTimeout(() => el.remove(), 1600);
  }

  /** Namensschilder der Mitspieler im Koop. */
  positionTags(state: GameState, selfId: string, project: (x: number, z: number) => { x: number; y: number }): void {
    if (state.mode !== 'coop') return;
    const existing = new Map<string, HTMLElement>();
    for (const el of Array.from(this.tags.children) as HTMLElement[]) existing.set(el.dataset.id!, el);
    for (const p of state.players) {
      let el = existing.get(p.id);
      if (!el) {
        el = h('div', { class: 'name-tag', 'data-id': p.id }, p.id === selfId ? `${p.name} (du)` : p.name);
        el.style.setProperty('--animal', ANIMAL_COLORS[p.animal]);
        this.tags.append(el);
      }
      existing.delete(p.id);
      const pos = project(p.x, p.z);
      el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`;
    }
    for (const el of existing.values()) el.remove();
  }

  showPause(visible: boolean): void {
    this.pauseLayer.classList.toggle('hidden', !visible);
  }

  showResult(result: RoundResult, mode: 'solo' | 'coop'): void {
    this.resultLayer?.remove();
    const rows: [string, number][] = [
      [`Häuser angeschlossen (${result.housesOnline}/${result.housesTotal})`, result.housePoints],
      ['Zeitbonus', result.timeBonus],
      ['Kabel gespart', result.cableBonus],
    ];
    this.resultLayer = h(
      'div',
      { class: 'modal-layer', 'data-testid': 'result' },
      h(
        'div',
        { class: `modal result ${result.won ? 'won' : 'lost'}` },
        h('h2', {}, result.won ? 'Alle Häuser online!' : 'Die Zeit ist um'),
        h(
          'p',
          { class: 'result-sub' },
          result.won
            ? mode === 'coop'
              ? 'Starke Teamarbeit auf der Baustelle.'
              : 'Die ganze Straße surft jetzt mit Glasfaser.'
            : `${result.housesOnline} von ${result.housesTotal} Häusern angeschlossen.`,
        ),
        h(
          'table',
          { class: 'result-table' },
          ...rows.map(([label, value]) => h('tr', {}, h('td', {}, label), h('td', {}, String(value)))),
          h('tr', { class: 'total' }, h('td', {}, 'Teamergebnis'), h('td', { 'data-testid': 'final-score' }, String(result.score))),
        ),
        h(
          'div',
          { class: 'modal-actions' },
          mode === 'solo'
            ? h('button', { class: 'btn primary', onclick: () => this.options.onRestart() }, icon(ICONS.restart), 'Nochmal')
            : h('button', { class: 'btn primary', onclick: () => this.options.onRestart() }, icon(ICONS.users), 'Zur Lobby'),
          result.won && this.options.onNext
            ? h('button', { class: 'btn', onclick: () => this.options.onNext?.() }, icon(ICONS.play), 'Nächste Karte')
            : null,
          h('button', { class: 'btn ghost', onclick: () => this.options.onExit() }, icon(ICONS.back), 'Hauptmenü'),
        ),
        h('p', { class: 'hint' }, 'Esc blendet die Karte aus, um die Baustelle anzusehen.'),
      ),
    );
    this.root.append(this.resultLayer);
  }

  toggleResult(): void {
    this.resultLayer?.classList.toggle('hidden');
  }

  dispose(): void {
    this.root.remove();
  }
}
