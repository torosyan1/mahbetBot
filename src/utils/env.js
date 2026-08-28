const env = {
  bot_token: process.env.BOT_TOKEN,
  locale: process.env.LOCALE,
  welcome_image_url: process.env.WELCOME_IMAGE_URL,
  web_app: process.env.WEB_APP,
  db_host: process.env.DB_HOST,
  db_user: process.env.DB_USER,
  db_password: process.env.DB_PASS,
  db_database: process.env.DB_DATABASE,
  port: process.env.PORT,
  mahbet_login: process.env.MAHBET_LOGIN,
  mahbet_registr: process.env.MAHBET_REGISTR,
  // CentralPay automation service (withdrawal lookups). Empty url = the
  // "my last withdrawal" button is not offered at all.
  centralpay_api_url: process.env.CENTRALPAY_API_URL,
  centralpay_api_token: process.env.CENTRALPAY_API_TOKEN,
  support_username: process.env.SUPPORT_USERNAME || '@MB_Support'
}

module.exports = {
    ...env
}