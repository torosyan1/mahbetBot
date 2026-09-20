const { locale } = require('../utils/env');
const languages = require('../utils/language');
const { getActiveLink } = require('../helpers/botLink');
const { mainMenuKeyboard } = require('../commands/menuKeyboard');
const dailyLucky = require('../dailyLucky/service');

// "Get link": sends the one active link from `bot_links`. Admins manage that table
// from the MAHBET admin panel (Bot → Bot Link); the bot never writes to it.
module.exports = async (ctx) => {
  const { getLinkMessage, getLinkButtonInline, noLinkMessage } = languages[locale];

  try {
    const url = await getActiveLink();

    if (!url) {
      // The button is only offered while a link is active, so this is a player
      // holding an older menu. Answer, and swap in a menu without the button.
      const luckyEnabled = await dailyLucky.isEnabled().catch(() => false);
      await ctx.reply(noLinkMessage, {
        reply_markup: mainMenuKeyboard({ luckyEnabled, linkEnabled: false }),
      });
      return;
    }

    // The URL itself is never written out — the player gets a button and nothing
    // to copy. https opens inside Telegram as a web app, the way the welcome
    // button does; anything else can only be a plain link button, since Telegram
    // refuses a web_app that is not https.
    const button = url.startsWith('https://')
      ? { text: getLinkButtonInline, web_app: { url }, style: 'success' }
      : { text: getLinkButtonInline, url, style: 'success' };

    await ctx.reply(getLinkMessage, {
      reply_markup: { inline_keyboard: [[button]] },
    });
  } catch (err) {
    console.log('getLink failed:', err.message);
    await ctx.reply(noLinkMessage).catch(() => {});
  }
};
