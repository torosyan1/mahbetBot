exports.up = function (knex) {
  return knex.schema.createTable('channels', function (table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('username').notNullable();
    table.dateTime('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('channels');
};
