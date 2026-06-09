exports.up = function (knex) {
  return knex.schema.createTable('broadcasts', function (table) {
    table.increments('id').primary();
    table.enum('type', ['bot', 'channel']).defaultTo('bot');
    table.text('caption');
    table.integer('total_users').defaultTo(0);
    table.integer('sent').defaultTo(0);
    table.integer('failed').defaultTo(0);
    table.enum('status', ['running', 'completed', 'failed']).defaultTo('completed');
    table.dateTime('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('broadcasts');
};
