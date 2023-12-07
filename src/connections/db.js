const connectionInfo = {
  client: 'mysql',
  connection: {
    host: process.env.DB_HOST, // 149.202.207.211
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    debug: false,
    pool: { min: Number(process.env.DB_POOL_MIN), max: Number(process.env.DB_POOL_MAX) },
  },
  migrations: {
    directory: '../migrations',
  },
};

console.info(`Knex connects to: ${connectionInfo.connection.host}`);

module.exports = require('knex')(connectionInfo);
