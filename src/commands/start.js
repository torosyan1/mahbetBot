const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale } = require("../utils/env");
const languages = require("../utils/language");
// mahbet846:i5em7aKvrm@185.155.233.31:50100
///tg://proxy?server=185.155.233.31&50100=443&secret=mahbet846:i5em7aKvrm
module.exports = async (ctx) => {
  try {
  const { welcomeMessage, welcomeButtonInline, welcomeButtonKeyboard, suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard, forMoreMessage } = languages[locale];
  console.log(ctx.update.message.from)
  await ctx.replyWithPhoto(welcome_image_url, {
    caption: welcomeMessage,
    reply_markup: {
      inline_keyboard: [[{
          text: welcomeButtonInline,
          web_app: { url: web_app }
      }],
      [{
        text: welcomeButtonInline,
        url: 'tg://proxy?server=185.155.233.31&50100=443&secret=mahbet846:i5em7aKvrm'
    }]
    ],
      one_time_keyboard: true,
      resize_keyboard: true,
  },
  })
  
  await ctx.reply(
    forMoreMessage,
    Markup.keyboard([
      [Markup.button.webApp(welcomeButtonKeyboard,  web_app)],
      [suppotButtonKeyboard, promotionButtonKeyboard],
      [FAQButtonKeyboard, helpMeButtonKeyboard],
      // ['Lucky Giveaway 🎲'],
    ]).resize()
  );

  } catch(err){
   console.log(err.message)
  }
};
