exports.up = function (knex) {
  return knex.schema.createTable('prediction_pools', function (table) {
    table.increments('id').primary();
    table.string('home_team').notNullable();
    table.string('away_team').notNullable();
    table.enu('status', ['open', 'closed', 'settled']).notNullable().defaultTo('open');
    table.integer('result_home').nullable();
    table.integer('result_away').nullable();
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('settled_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('prediction_pools');
};
