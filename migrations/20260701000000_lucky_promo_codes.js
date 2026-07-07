exports.up = function (knex) {
  return knex.schema.createTable('lucky_promo_codes', function (table) {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.enu('status', ['unused', 'used']).notNullable().defaultTo('unused');
    table.string('used_by').nullable();
    table.dateTime('used_at').nullable();
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.index(['status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('lucky_promo_codes');
};
