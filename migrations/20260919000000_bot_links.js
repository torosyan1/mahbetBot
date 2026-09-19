/**
 * Links the "Get link" button hands out. Managed only from the MAHBET admin panel
 * (Bot → Bot Link), which connects to this database directly; the bot only reads it.
 *
 * At most one link may be active. That is enforced here rather than trusted to the
 * panel: `active_slot` is 1 for the active row and NULL for every other, and a unique
 * index allows any number of NULLs but only one 1 — so a second active row is refused
 * by the database even if two admins press "Activate" at the same moment.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('bot_links', function (table) {
    table.charset('utf8mb4');
    table.increments('id').primary();
    table.string('url', 512).notNullable();
    // Admin-facing label only ("Mirror 3"), never shown to players.
    table.string('title', 128).nullable();
    table.boolean('is_active').notNullable().defaultTo(false);
    table.string('created_by', 64).nullable();
    table.dateTime('activated_at').nullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'ALTER TABLE bot_links ' +
      'ADD COLUMN active_slot TINYINT AS (IF(is_active = 1, 1, NULL)) STORED, ' +
      'ADD UNIQUE KEY uq_bot_links_active (active_slot)'
  );
};

exports.down = function (knex) {
  return knex.schema.dropTable('bot_links');
};
