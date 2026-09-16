import './score-explanation.css';

import type { RoundEndResult } from '@mahjong-live/shared/rules';

type ScoredHand = Extract<RoundEndResult, { type: 'tsumo' }>['score'];

type ExplanationRow = {
  label: string;
  value: string;
};

export type ScoreExplanation = {
  yaku: ExplanationRow[];
  yakuTotal: string;
  bonus: ExplanationRow[];
  bonusTotal: string;
  fu: null | {
    components: ExplanationRow[];
    raw: string | null;
    rounded: string | null;
    fixed: string | null;
  };
  base: {
    points: string;
    limit: string;
    reason: string;
  };
  payment: {
    lines: ExplanationRow[];
  };
};

const numberFormat = new Intl.NumberFormat('en-US');

function points(value: number): string {
  return numberFormat.format(value);
}

function limitLabel(limit: ScoredHand['base']['limit']): string {
  const labels: Record<ScoredHand['base']['limit'], string> = {
    none: 'No limit',
    mangan: 'Mangan',
    haneman: 'Haneman',
    baiman: 'Baiman',
    sanbaiman: 'Sanbaiman',
    'kazoe-yakuman': 'Kazoe Yakuman',
    yakuman: 'Yakuman',
    'multiple-yakuman': 'Multiple Yakuman',
  };
  return labels[limit];
}

function limitReason(score: ScoredHand): string {
  if (score.yakuman > 0) {
    return score.yakuman === 1 ? 'True Yakuman hand' : `${score.yakuman}× true Yakuman hand`;
  }

  switch (score.base.limit) {
    case 'kazoe-yakuman': return `${score.han} han reaches Kazoe Yakuman`;
    case 'sanbaiman': return `${score.han} han reaches Sanbaiman`;
    case 'baiman': return `${score.han} han reaches Baiman`;
    case 'haneman': return `${score.han} han reaches Haneman`;
    case 'mangan':
      if (score.han >= 5) return `${score.han} han reaches Mangan`;
      if ((score.han === 4 && score.fu?.fu === 30) || (score.han === 3 && score.fu?.fu === 60)) {
        return `${score.han} han · ${score.fu.fu} fu — Kiriage Mangan`;
      }
      return 'Base points capped at Mangan';
    case 'none':
      return score.fu
        ? `${score.fu.fu} fu × 2^(${score.han} + 2)`
        : 'Calculated from the winning hand';
    case 'yakuman': return 'True Yakuman hand';
    case 'multiple-yakuman': return `${score.yakuman}× true Yakuman hand`;
  }
}

function paymentRows(score: ScoredHand): ExplanationRow[] {
  const payment = score.payments;
  const rows: ExplanationRow[] = [];

  if (payment.type === 'ron') {
    rows.push({ label: 'Discarder pays', value: points(payment.fromDiscarder) });
  } else if (payment.type === 'tsumo-dealer') {
    rows.push({ label: 'Each opponent pays', value: points(payment.fromEach) });
  } else {
    rows.push({ label: 'Dealer pays', value: points(payment.fromDealer) });
    rows.push({ label: 'Each non-dealer pays', value: points(payment.fromEachNonDealer) });
  }

  if (payment.riichiBonus > 0) {
    rows.push({ label: 'Riichi sticks', value: `+${points(payment.riichiBonus)}` });
  }
  rows.push({ label: 'Winner gains', value: points(payment.winnerGain) });
  return rows;
}

export function buildScoreExplanation(score: ScoredHand): ScoreExplanation {
  const yaku = score.scoringYaku.map((item) => ({
    label: item.name,
    value: item.yakuman ? `${item.yakuman}× Yakuman` : `${item.han} han`,
  }));

  const bonus = score.yakuman > 0 ? [] : [
    score.dora.dora ? { label: 'Dora', value: `${score.dora.dora} han` } : null,
    score.dora.uraDora ? { label: 'Ura Dora', value: `${score.dora.uraDora} han` } : null,
    score.dora.akaDora ? { label: 'Aka Dora', value: `${score.dora.akaDora} han` } : null,
  ].filter((row): row is ExplanationRow => row !== null);

  let fu: ScoreExplanation['fu'] = null;
  if (score.fu) {
    const fixed = score.fu.fixed === 'chiitoitsu'
      ? 'Chiitoitsu is fixed at 25 fu'
      : score.fu.fixed === 'pinfu-tsumo'
        ? 'Pinfu Tsumo is fixed at 20 fu'
        : null;
    fu = {
      components: score.fu.components.map((component, index) => ({
        label: component.source,
        value: `${index === 0 ? '' : '+'}${component.fu} fu`,
      })),
      raw: fixed ? null : `${score.fu.rawFu} fu raw`,
      rounded: fixed ? null : `${score.fu.fu} fu after rounding`,
      fixed,
    };
  }

  return {
    yaku,
    yakuTotal: score.yakuman > 0 ? `${score.yakuman}× Yakuman` : `${score.yakuHan} han`,
    bonus,
    bonusTotal: `${score.bonusHan} han`,
    fu,
    base: {
      points: `${points(score.base.basePoints)} base points`,
      limit: limitLabel(score.base.limit),
      reason: limitReason(score),
    },
    payment: { lines: paymentRows(score) },
  };
}

function rowsMarkup(rows: readonly ExplanationRow[]): string {
  return rows.map((row) => `<div class="scoring-detail-row"><span>${row.label}</span><strong>${row.value}</strong></div>`).join('');
}

export function scoreExplanationMarkup(score: ScoredHand): string {
  const explanation = buildScoreExplanation(score);
  const fu = explanation.fu
    ? `<section class="scoring-detail-section scoring-fu"><h4>Fu</h4>${rowsMarkup(explanation.fu.components)}${explanation.fu.fixed ? `<div class="scoring-detail-note">${explanation.fu.fixed}</div>` : `<div class="scoring-detail-math"><span>${explanation.fu.raw}</span><strong>${explanation.fu.rounded}</strong></div>`}</section>`
    : '';
  const bonusRows = explanation.bonus.length
    ? rowsMarkup(explanation.bonus)
    : '<div class="scoring-detail-note">No bonus Han</div>';

  return `
    <details class="scoring-details">
      <summary>Scoring details</summary>
      <div class="scoring-details-body">
        <section class="scoring-detail-section"><h4>Yaku <span>${explanation.yakuTotal}</span></h4>${rowsMarkup(explanation.yaku)}</section>
        <section class="scoring-detail-section"><h4>Dora <span>${explanation.bonusTotal}</span></h4>${bonusRows}</section>
        ${fu}
        <section class="scoring-detail-section"><h4>Base points</h4><div class="scoring-detail-row"><span>${explanation.base.reason}</span><strong>${explanation.base.points}</strong></div><div class="scoring-detail-row"><span>Limit</span><strong>${explanation.base.limit}</strong></div></section>
        <section class="scoring-detail-section"><h4>Payment</h4>${rowsMarkup(explanation.payment.lines)}</section>
      </div>
    </details>
  `;
}
