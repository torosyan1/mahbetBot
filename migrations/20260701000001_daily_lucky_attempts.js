exports.up = function (knex) {
  return knex.schema.createTable('daily_lucky_attempts', function (table) {
    table.increments('id').primary();
    table.string('telegram_id').notNullable();
    table.integer('guess').notNullable();
    table.integer('dice_result').nullable();
    table.boolean('is_win').nullable();
    table
      .integer('promo_code_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('lucky_promo_codes')
      .onDelete('SET NULL');
    table.dateTime('next_available_at').notNullable();
    table.boolean('notification_sent').notNullable().defaultTo(false);
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.index(['telegram_id']);
    table.index(['next_available_at', 'notification_sent']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('daily_lucky_attempts');
};
