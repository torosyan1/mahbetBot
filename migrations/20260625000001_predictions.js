exports.up = function (knex) {
  return knex.schema.createTable('predictions', function (table) {
    table.increments('id').primary();
    table.integer('pool_id').unsigned().notNullable().references('id').inTable('prediction_pools').onDelete('CASCADE');
    table.string('telegram_id').notNullable();
    table.integer('predicted_home').notNullable();
    table.integer('predicted_away').notNullable();
    table.boolean('is_correct').nullable();
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.unique(['pool_id', 'telegram_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('predictions');
};
