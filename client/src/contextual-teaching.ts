import './contextual-teaching.css';

type TeachingTopic = 'waits' | 'furiten' | 'calls' | 'turn-options' | 'scoring';

type TeachingModel = {
  topic: TeachingTopic;
  kicker: 'Hint' | 'Why?';
  title: string;
  copy: string;
  items?: readonly string[];
  placement: 'table' | 'result';
};

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

let scheduled = false;

function humanWaits(): string[] {
  const labels = [...app.querySelectorAll<HTMLElement>('.player-bottom .wait-hint .wait-tile[aria-label]')]
    .map((tile) => tile.getAttribute('aria-label')?.trim() ?? '')
    .filter(Boolean);
  return [...new Set(labels)];
}

function readableList(values: readonly string[]): string {
  if (values.length === 0) return 'your shown wait tiles';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
}

function availableActions(): Set<string> {
  return new Set(
    [...app.querySelectorAll<HTMLElement>('.table-panel > .action-dock:not(.presentation-dock) [data-ui-action]')]
      .map((button) => button.dataset.uiAction ?? '')
      .filter(Boolean),
  );
}

function callItems(actions: ReadonlySet<string>): string[] {
  const items: string[] = [];
  if (actions.has('ron')) items.push('Ron — win on the latest discard.');
  if (actions.has('chi')) items.push('Chi — make a sequence with the discard from the player to your left.');
  if (actions.has('pon')) items.push('Pon — make a triplet with a matching discard from any opponent.');
  if (actions.has('daiminkan')) items.push('Kan — complete four matching tiles; a new Dora indicator appears when the Kan completes.');
  if (actions.has('pass')) items.push('Pass — decline the currently offered reactions and continue the hand.');
  return items;
}

function turnItems(actions: ReadonlySet<string>): string[] {
  const items: string[] = [];
  if (actions.has('riichi')) {
    items.push('Riichi — declare a ready closed hand, place a 1,000-point stick, then choose one of the highlighted legal declaration discards.');
  }
  if (actions.has('ankan')) {
    items.push('Closed Kan — use four matching tiles from your hand; after the Kan completes, a new Dora indicator is revealed and you draw from Rinshan.');
  }
  if (actions.has('shouminkan')) {
    items.push('Added Kan — upgrade your open Pon with the fourth tile; the new Dora indicator is revealed when the Kan completes.');
  }
  return items;
}

function teachingModel(): TeachingModel | null {
  if (document.body.classList.contains('visual-replay-active')) return null;
  if (app.querySelector('.app-shell.is-presenting, .setup-dialog, .tutorial-dialog')) return null;

  const result = app.querySelector<HTMLElement>('.result-dialog');
  if (result?.querySelector('.score-card details, .scoring-details')) {
    return {
      topic: 'scoring',
      kicker: 'Why?',
      title: 'Read the score from value to payment',
      copy: 'Open Scoring details for the exact calculation. Yaku gives the hand its scoring patterns; Dora adds bonus Han but is not a Yaku; Fu and limits determine base points; Payment shows who pays the final amount.',
      items: ['Yaku', 'Dora', 'Fu', 'Payment'],
      placement: 'result',
    };
  }

  const human = app.querySelector<HTMLElement>('.player-bottom');
  if (!human) return null;
  const waits = humanWaits();
  const waitList = readableList(waits);

  if (human.querySelector('.furiten-tag')) {
    return {
      topic: 'furiten',
      kicker: 'Why?',
      title: 'Furiten blocks Ron',
      copy: `Your visible waits are ${waitList}. While Furiten applies, you cannot win by Ron on another player's discard; Tsumo is still allowed if you draw a winning tile yourself.`,
      placement: 'table',
    };
  }

  const actions = availableActions();
  const reaction = ['ron', 'chi', 'pon', 'daiminkan'].some((action) => actions.has(action));
  if (reaction) {
    return {
      topic: 'calls',
      kicker: 'Why?',
      title: 'Choose only from the reactions that are legal now',
      copy: 'These choices come from the latest public discard and your own hand. Passing is always safe when you do not want to open or change the hand.',
      items: callItems(actions),
      placement: 'table',
    };
  }

  if (human.querySelector('.tenpai-tag') && waits.length > 0) {
    return {
      topic: 'waits',
      kicker: 'Hint',
      title: 'Tenpai — one tile from winning',
      copy: `Your current waits are ${waitList}. Drawing one completes the hand; Ron can also win on a matching discard unless Furiten applies.`,
      placement: 'table',
    };
  }

  const turnOptions = turnItems(actions);
  if (turnOptions.length > 0) {
    return {
      topic: 'turn-options',
      kicker: 'Why?',
      title: 'Special turn options are available',
      copy: 'These are optional legal actions for the current hand state. The normal discard remains available unless the game is asking you to finish a declaration choice.',
      items: turnOptions,
      placement: 'table',
    };
  }

  return null;
}

function modelSignature(model: TeachingModel): string {
  return [model.topic, model.kicker, model.title, model.copy, ...(model.items ?? [])].join('|');
}

function buildTeaching(model: TeachingModel): HTMLElement {
  const teaching = document.createElement('aside');
  teaching.className = `contextual-teaching contextual-teaching-${model.placement}`;
  teaching.dataset.contextualTeaching = '';
  teaching.dataset.teachingTopic = model.topic;
  teaching.dataset.signature = modelSignature(model);
  teaching.setAttribute('role', 'status');
  teaching.setAttribute('aria-live', 'polite');

  const head = document.createElement('div');
  head.className = 'contextual-teaching-head';
  const kicker = document.createElement('span');
  kicker.className = 'contextual-teaching-kicker';
  kicker.textContent = model.kicker;
  const title = document.createElement('strong');
  title.className = 'contextual-teaching-title';
  title.textContent = model.title;
  head.append(kicker, title);
  teaching.appendChild(head);

  const copy = document.createElement('p');
  copy.className = 'contextual-teaching-copy';
  copy.textContent = model.copy;
  teaching.appendChild(copy);

  if (model.items?.length) {
    const items = document.createElement('div');
    items.className = 'contextual-teaching-items';
    for (const text of model.items) {
      const item = document.createElement('span');
      item.textContent = text;
      items.appendChild(item);
    }
    teaching.appendChild(items);
  }

  return teaching;
}

function clearTeaching(): void {
  app.querySelector('[data-contextual-teaching]')?.remove();
  app.querySelector('.teaching-dock-active')?.classList.remove('teaching-dock-active');
}

function placeTeaching(model: TeachingModel): void {
  const existing = app.querySelector<HTMLElement>('[data-contextual-teaching]');
  const signature = modelSignature(model);
  const resultTarget = model.placement === 'result'
    ? app.querySelector<HTMLElement>('.result-dialog')
    : null;
  const dock = model.placement === 'table'
    ? app.querySelector<HTMLElement>('.table-panel > .action-dock:not(.presentation-dock)')
    : null;
  const tablePanel = model.placement === 'table'
    ? app.querySelector<HTMLElement>('.table-panel')
    : null;
  const target = resultTarget ?? dock ?? tablePanel;
  if (!target) {
    clearTeaching();
    return;
  }

  const rightParent = existing?.parentElement === target;
  if (existing?.dataset.signature === signature && rightParent) return;

  clearTeaching();
  const teaching = buildTeaching(model);
  if (dock) {
    dock.classList.add('teaching-dock-active');
    const buttons = dock.querySelector('.action-buttons');
    if (buttons) dock.insertBefore(teaching, buttons);
    else dock.prepend(teaching);
  } else if (resultTarget) {
    const details = resultTarget.querySelector('.score-card details, .scoring-details');
    if (details) details.insertAdjacentElement('afterend', teaching);
    else resultTarget.appendChild(teaching);
  } else {
    target.appendChild(teaching);
  }
}

function refreshTeaching(): void {
  scheduled = false;
  const model = teachingModel();
  if (!model) {
    clearTeaching();
    return;
  }
  placeTeaching(model);
}

function scheduleTeaching(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(refreshTeaching);
}

const observer = new MutationObserver(scheduleTeaching);
observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-label'] });
document.addEventListener('click', scheduleTeaching, true);
window.addEventListener('mahjong-live:riichi-marker', scheduleTeaching);
scheduleTeaching();
