const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale } = require("../utils/env");
const languages = require("../utils/language");

module.exports = async (ctx) => {
  try {
  const chatID = ctx.message.from.id;
  const { welcomeMessage, welcomeButtonInline, welcomeButtonKeyboard, suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard, forMoreMessage } = languages[locale];

  await ctx.replyWithPhoto(welcome_image_url, {
    caption: welcomeMessage,
    reply_markup: {
      inline_keyboard: [[{
          text: welcomeButtonInline,
          web_app: { url: web_app + '/?tel_id=' + chatID }
      }]],
      one_time_keyboard: true,
      resize_keyboard: true,
  },
  });
  await ctx.reply(
    forMoreMessage,
    Markup.keyboard([
      [Markup.button.webApp(welcomeButtonKeyboard,  web_app + '/?tel_id=' + chatID)],
      [suppotButtonKeyboard, promotionButtonKeyboard],
      [FAQButtonKeyboard, helpMeButtonKeyboard],
    ]).resize()
  );

  } catch(err){
   console.log(err.message)
  }
};
