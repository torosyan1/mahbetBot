const env = {
  bot_token: process.env.BOT_TOKEN,
  locale: process.env.LOCALE,
  welcome_image_url: process.env.WELCOME_IMAGE_URL,
  web_app: process.env.WEB_APP,
  db_host: process.env.DB_HOST,
  db_user: process.env.DB_USER,
  db_password: process.env.DB_PASS,
  db_database: process.env.DB_DATABASE,
}

module.exports = {
    ...env
}