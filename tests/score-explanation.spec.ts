import { expect, test } from '@playwright/test';
import { buildScoreExplanation, scoreExplanationMarkup } from '../client/src/score-explanation';

function ordinaryScore() {
  return {
    status: 'scored' as const,
    yaku: [],
    scoringYaku: [
      { name: 'Riichi', han: 1 },
      { name: 'Tanyao', han: 1 },
    ],
    dora: { dora: 1, uraDora: 1, akaDora: 1, total: 3 },
    yakuHan: 2,
    bonusHan: 3,
    han: 5,
    yakuman: 0,
    fu: {
      fu: 40,
      rawFu: 32,
      components: [
        { source: 'Base', fu: 20 },
        { source: 'Menzen Ron', fu: 10 },
        { source: 'Wait', fu: 2 },
      ],
      fixed: null,
    },
    base: { basePoints: 2000, limit: 'mangan' as const },
    payments: {
      type: 'ron' as const,
      fromDiscarder: 8000,
      handPayment: 8000,
      riichiBonus: 2000,
      winnerGain: 10000,
    },
  };
}

test('ordinary hand explains yaku, Dora, Fu rounding, limit and final payment separately', () => {
  const explanation = buildScoreExplanation(ordinaryScore());

  expect(explanation.yaku).toEqual([
    { label: 'Riichi', value: '1 han' },
    { label: 'Tanyao', value: '1 han' },
  ]);
  expect(explanation.yakuTotal).toBe('2 han');
  expect(explanation.bonus).toEqual([
    { label: 'Dora', value: '1 han' },
    { label: 'Ura Dora', value: '1 han' },
    { label: 'Aka Dora', value: '1 han' },
  ]);
  expect(explanation.bonusTotal).toBe('3 han');
  expect(explanation.fu).toEqual({
    components: [
      { label: 'Base', value: '20 fu' },
      { label: 'Menzen Ron', value: '+10 fu' },
      { label: 'Wait', value: '+2 fu' },
    ],
    raw: '32 fu raw',
    rounded: '40 fu after rounding',
    fixed: null,
  });
  expect(explanation.base).toMatchObject({
    points: '2,000 base points',
    limit: 'Mangan',
  });
  expect(explanation.base.reason).toContain('5 han');
  expect(explanation.payment.lines).toEqual([
    { label: 'Discarder pays', value: '8,000' },
    { label: 'Riichi sticks', value: '+2,000' },
    { label: 'Winner gains', value: '10,000' },
  ]);
});

test('fixed Fu hands explain Chiitoitsu and Pinfu Tsumo without fake rounding', () => {
  const chiitoitsu = ordinaryScore();
  chiitoitsu.han = 2;
  chiitoitsu.yakuHan = 2;
  chiitoitsu.bonusHan = 0;
  chiitoitsu.dora = { dora: 0, uraDora: 0, akaDora: 0, total: 0 };
  chiitoitsu.fu = {
    fu: 25,
    rawFu: 25,
    components: [{ source: 'Chiitoitsu', fu: 25 }],
    fixed: 'chiitoitsu',
  };
  chiitoitsu.base = { basePoints: 400, limit: 'none' };

  const pinfu = ordinaryScore();
  pinfu.han = 1;
  pinfu.yakuHan = 1;
  pinfu.bonusHan = 0;
  pinfu.dora = { dora: 0, uraDora: 0, akaDora: 0, total: 0 };
  pinfu.fu = {
    fu: 20,
    rawFu: 20,
    components: [{ source: 'Pinfu Tsumo', fu: 20 }],
    fixed: 'pinfu-tsumo',
  };
  pinfu.base = { basePoints: 160, limit: 'none' };

  expect(buildScoreExplanation(chiitoitsu).fu).toMatchObject({
    fixed: 'Chiitoitsu is fixed at 25 fu',
    raw: null,
    rounded: null,
  });
  expect(buildScoreExplanation(pinfu).fu).toMatchObject({
    fixed: 'Pinfu Tsumo is fixed at 20 fu',
    raw: null,
    rounded: null,
  });
});

test('Yakuman explanation omits Fu and ordinary bonus math', () => {
  const score = {
    ...ordinaryScore(),
    scoringYaku: [{ name: 'Tsuuiisou', han: 0, yakuman: 1 }],
    dora: { dora: 2, uraDora: 1, akaDora: 1, total: 4 },
    yakuHan: 0,
    bonusHan: 0,
    han: 0,
    yakuman: 1,
    fu: null,
    base: { basePoints: 8000, limit: 'yakuman' as const },
    payments: {
      type: 'ron' as const,
      fromDiscarder: 32000,
      handPayment: 32000,
      riichiBonus: 0,
      winnerGain: 32000,
    },
  };

  const explanation = buildScoreExplanation(score);
  expect(explanation.yaku).toEqual([{ label: 'Tsuuiisou', value: '1× Yakuman' }]);
  expect(explanation.fu).toBeNull();
  expect(explanation.bonus).toEqual([]);
  expect(explanation.base).toMatchObject({ limit: 'Yakuman', reason: 'True Yakuman hand' });
});

test('details markup stays collapsible and includes payment rows for Tsumo variants', () => {
  const score = ordinaryScore();
  score.payments = {
    type: 'tsumo-nondealer',
    fromDealer: 4000,
    fromEachNonDealer: 2000,
    handPayment: 8000,
    riichiBonus: 1000,
    winnerGain: 9000,
  };

  const html = scoreExplanationMarkup(score);
  expect(html).toContain('<details class="scoring-details">');
  expect(html).toContain('Scoring details');
  expect(html).toContain('Dealer pays');
  expect(html).toContain('Each non-dealer pays');
  expect(html).toContain('Winner gains');
});
