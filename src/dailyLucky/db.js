const knex = require('../connections/db');

/** Most recent attempt for a user, or undefined if they've never played. */
function getLatestAttempt(telegramId) {
  return knex('daily_lucky_attempts')
    .where({ telegram_id: String(telegramId) })
    .orderBy('id', 'desc')
    .first();
}

function createAttempt({ telegramId, guess, diceResult, isWin, promoCodeId, nextAvailableAt }) {
  return knex('daily_lucky_attempts').insert({
    telegram_id: String(telegramId),
    guess,
    dice_result: diceResult,
    is_win: isWin,
    promo_code_id: promoCodeId || null,
    next_available_at: nextAvailableAt,
    notification_sent: false,
  });
}

/** Attempts whose cooldown has elapsed and haven't been reminded yet — one row per user (their latest). */
function listAttemptsDueForNotification() {
  return knex('daily_lucky_attempts as a')
    .innerJoin(
      knex('daily_lucky_attempts').select('telegram_id').max('id as max_id').groupBy('telegram_id').as('latest'),
      function () {
        this.on('latest.telegram_id', '=', 'a.telegram_id').andOn('latest.max_id', '=', 'a.id');
      }
    )
    .where('a.next_available_at', '<=', knex.fn.now())
    .andWhere('a.notification_sent', false)
    .select('a.*');
}

function markNotified(attemptId) {
  return knex('daily_lucky_attempts').where({ id: attemptId }).update({ notification_sent: true });
}

/** Atomically hand out one unused promo code to a user inside a transaction, row-locked to prevent double-assignment. */
async function claimPromoCode(trx, telegramId) {
  const promo = await trx('lucky_promo_codes').where({ status: 'unused' }).forUpdate().first();
  if (!promo) return null;
  await trx('lucky_promo_codes')
    .where({ id: promo.id, status: 'unused' })
    .update({ status: 'used', used_by: String(telegramId), used_at: trx.fn.now() });
  return promo;
}

function addPromoCodes(codes) {
  const rows = codes.map((code) => ({ code, status: 'unused' }));
  return knex('lucky_promo_codes').insert(rows);
}

function listPromoCodes({ status } = {}) {
  const query = knex('lucky_promo_codes').orderBy('id', 'desc');
  if (status) query.where({ status });
  return query;
}

async function getStats() {
  const totals = await knex('daily_lucky_attempts')
    .select(
      knex.raw('COUNT(*) as total_plays'),
      knex.raw('SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as wins'),
      knex.raw('SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losses')
    )
    .first();

  const promoStats = await knex('lucky_promo_codes')
    .select(knex.raw("SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as distributed"), knex.raw('COUNT(*) as total'))
    .first();

  const totalPlays = Number(totals?.total_plays) || 0;
  const wins = Number(totals?.wins) || 0;
  const losses = Number(totals?.losses) || 0;

  return {
    totalPlays,
    wins,
    losses,
    winRate: totalPlays > 0 ? Math.round((wins / totalPlays) * 100) : 0,
    promoCodesDistributed: Number(promoStats?.distributed) || 0,
    promoCodesRemaining: (Number(promoStats?.total) || 0) - (Number(promoStats?.distributed) || 0),
  };
}

module.exports = {
  getLatestAttempt,
  createAttempt,
  listAttemptsDueForNotification,
  markNotified,
  claimPromoCode,
  addPromoCodes,
  listPromoCodes,
  getStats,
};
