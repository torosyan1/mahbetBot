const knex = require('../connections/db');

/**
 * The one active "Get link" link, managed from the MAHBET admin panel (Bot → Bot Link).
 * Read fresh every time, so a change in the panel reaches the very next player.
 * Any failure reads as "no link": a DB hiccup must never break /start or the menu.
 */
async function getActiveLink() {
  try {
    const row = await knex('bot_links').where({ is_active: true }).first('url');
    return row ? row.url : null;
  } catch (err) {
    console.log('getActiveLink failed:', err.message);
    return null;
  }
}

module.exports = { getActiveLink };
