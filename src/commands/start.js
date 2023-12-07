const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale } = require("../utils/env");
const languages = require("../utils/language");

module.exports = async (ctx) => {
  try {
  const chatID = ctx.message.from.id;
  const { welcomeMessage, welcomeButtonInline, welcomeButtonKeyboard, suppotButtonKeyboard, promotionButtonKeyboard, topGamesButtonKeyboard, helpMeButtonKeyboard, forMoreMessage } = languages[locale];

  await ctx.telegram.sendPhoto( chatID, welcome_image_url );
  await ctx.reply(welcomeMessage, 
    Markup.inlineKeyboard([ Markup.button.webApp(welcomeButtonInline, web_app + '/?tel_id=' + chatID), ]).resize(),
  );
  await ctx.reply(
    forMoreMessage,
    Markup.keyboard([
      [Markup.button.webApp(welcomeButtonKeyboard, web_app)],
      [suppotButtonKeyboard, promotionButtonKeyboard],
      [topGamesButtonKeyboard, helpMeButtonKeyboard],
    ]).resize()
  );

  } catch(err){
   console.log(err.message, chatID)
  }
};
