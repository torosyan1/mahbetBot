/**
 * Permanent ledger of who already claimed the welcome gift code.
 *
 * The claim used to be inferred from `promo_codes.telegram_id`, which is part of the code pool:
 * once a code is recycled, refilled or cleared, the trace of the claim disappears and a user who
 * left the bot and started it again could take a second code. This table is never rewritten by the
 * pool, and the unique index on telegram_id makes a second claim impossible even under a race.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('welcome_bonus_claims', function (table) {
    table.increments('id').primary();
    table.string('telegram_id').notNullable().unique();
    table.string('mahbet_id').nullable();
    table.string('promo_code').nullable();
    table.dateTime('claimed_at').notNullable().defaultTo(knex.fn.now());
    table.index(['mahbet_id']);
  });

  // Backfill from the existing pool so users who already claimed stay blocked after this migration.
  if (await knex.schema.hasTable('promo_codes')) {
    const claimed = await knex('promo_codes')
      .whereNotNull('telegram_id')
      .select('telegram_id')
      .max('codes as promo_code')
      .groupBy('telegram_id');

    if (claimed.length) {
      await knex('welcome_bonus_claims').insert(
        claimed.map((row) => ({
          telegram_id: String(row.telegram_id),
          promo_code: row.promo_code,
        }))
      );
    }
  }
};

exports.down = function (knex) {
  return knex.schema.dropTable('welcome_bonus_claims');
};
