const { locale } = require('../utils/env');
const languages = require('../utils/language');
const { getActiveLink } = require('../helpers/botLink');
const { mainMenuKeyboard } = require('../commands/menuKeyboard');
const dailyLucky = require('../dailyLucky/service');

// "Get link": sends the one active link from `bot_links`. Admins manage that table
// from the MAHBET admin panel (Bot → Bot Link); the bot never writes to it.
module.exports = async (ctx) => {
  const {
    getLinkMessage,
    getLinkButtonMiniApp,
    getLinkButtonBrowser,
    noLinkMessage,
  } = languages[locale];

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

    // The URL itself is never written out — the player gets buttons and nothing
    // to copy. Two ways in: the mini app opens the site inside Telegram the way
    // the welcome button does, and the second leaves for the browser. The mini
    // app is offered only over https, which is the only scheme Telegram accepts
    // for a web_app, so an http link keeps just the browser button.
    const buttons = [];
    if (url.startsWith('https://')) {
      buttons.push([{ text: getLinkButtonMiniApp, web_app: { url }, style: 'success' }]);
    }
    buttons.push([{ text: getLinkButtonBrowser, url, style: 'primary' }]);

    await ctx.reply(getLinkMessage, {
      reply_markup: { inline_keyboard: buttons },
    });

  } catch (err) {
    console.log('getLink failed:', err.message);
    await ctx.reply(noLinkMessage).catch(() => {});
  }
};
