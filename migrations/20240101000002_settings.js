exports.up = function (knex) {
  return knex.schema.createTable('settings', function (table) {
    table.increments('id').primary();
    table.string('key').notNullable().unique();
    table.text('value');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('settings');
};
