const knex = require('../connections/db');

/**
 * Resolve a Telegram user to their MahBet account id.
 *
 * `users.mahbet_id` is the fast path but it is only ever written by the /start
 * deep-link flow, so for most players it is NULL. The site itself, however,
 * reports every login and registration to POST /login and /registration, and
 * those land in `logs` with both ids — that is the broadest source we have.
 * `welcome_bonus_claims` keeps a third copy from the gift-code flow.
 *
 * Order: users -> newest logs row -> claim ledger. A player with more than one
 * MahBet account resolves to the one they logged in with most recently.
 *
 * Whatever we find is written back to `users.mahbet_id`, so the next lookup is
 * a single indexed read and the panel's "registered users" list fills in too.
 */
async function resolveMahbetId(telegramId) {
  const tgId = String(telegramId);
  const isId = (v) => /^\d{3,}$/.test(String(v ?? '').trim());

  const user = await knex('users').where({ telegram_id: tgId }).first();
  if (user && isId(user.mahbet_id)) {
    return { mahbetId: String(user.mahbet_id).trim(), source: 'users' };
  }

  // Newest site login/registration wins — that is the account they actually use.
  const logRow = await knex('logs')
    .where({ telegram_id: tgId })
    .whereNotNull('mahbet_id')
    .where('mahbet_id', '!=', '')
    .orderBy('id', 'desc')
    .first();
  if (logRow && isId(logRow.mahbet_id)) {
    const mahbetId = String(logRow.mahbet_id).trim();
    await backfill(tgId, mahbetId);
    return { mahbetId, source: 'logs' };
  }

  const claim = await knex('welcome_bonus_claims').where({ telegram_id: tgId }).first();
  if (claim && isId(claim.mahbet_id)) {
    const mahbetId = String(claim.mahbet_id).trim();
    await backfill(tgId, mahbetId);
    return { mahbetId, source: 'welcome_bonus_claims' };
  }

  return { mahbetId: '', source: 'none' };
}

/** Cache the resolved id on the users row. Never fatal — the lookup already won. */
async function backfill(tgId, mahbetId) {
  try {
    await knex('users').where({ telegram_id: tgId }).update({ mahbet_id: mahbetId });
  } catch (err) {
    console.log('mahbetId backfill failed:', err.message);
  }
}

module.exports = { resolveMahbetId };
