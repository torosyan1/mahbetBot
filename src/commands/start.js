const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale, mahbet_registr, mahbet_login } = require("../utils/env");
const languages = require("../utils/language");
const knex = require('../connections/db');

module.exports = async (ctx) => {
  try {
  const { welcomeMessage, welcomeButtonInline, welcomeButtonKeyboard, suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard, forMoreMessage, vpn, registration } = languages[locale];

    const payload = ctx.startPayload;

  if (payload) {
    await knex('users').update({ mahbet_id: payload }).where({ telegram_id: ctx.from.id });
     
  }
  await ctx.replyWithPhoto(welcome_image_url, {
    caption: welcomeMessage,
    reply_markup: {
      inline_keyboard: [
      //   [{
      //     text: login,
      //     web_app: { url: mahbet_login }
      //   },
      //   {
      //     text: registration,
      //     web_app: { url: mahbet_registr }
      //   }
      //  ],
        [{
          text: welcomeButtonInline,
          web_app: { url: web_app }
      }]],
      one_time_keyboard: true,
      resize_keyboard: true,
  },
  });
  await ctx.reply(
    forMoreMessage,
    Markup.keyboard([
      // [Markup.button.webApp(welcomeButtonKeyboard,  web_app)],
      // [Markup.button.webApp(login,  mahbet_registr), Markup.button.webApp(registration, mahbet_login)],
      [suppotButtonKeyboard, promotionButtonKeyboard],
      [FAQButtonKeyboard, helpMeButtonKeyboard],
      // [vpn],
    ]).resize()
  );

  } catch(err){
   console.log(err.message)
  }
};
