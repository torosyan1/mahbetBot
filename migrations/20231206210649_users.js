exports.up = function (knex) {
    return knex.schema.createTable('users', function (table) {
      table.increments('id').primary();
      table.string('mahbet_id');
      table.string('telegram_id').unique();
      table.string('username');
      table.string('last_login');
      table.dateTime('createdAt').defaultTo(knex.fn.now());
      table.dateTime('updatedAt').defaultTo(knex.fn.now());
    });
  };
  
exports.down = function (knex) {
    return knex.schema.dropTable('users');
  };