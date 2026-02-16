const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale, mahbet_registr, mahbet_login } = require("../utils/env");
const languages = require("../utils/language");
const knex = require('../connections/db');

module.exports = async (ctx) => {
  try {
    const { 
      welcomeMessage, 
      welcomeButtonInline, 
      welcomeButtonKeyboard, 
      suppotButtonKeyboard, 
      promotionButtonKeyboard, 
      FAQButtonKeyboard, 
      helpMeButtonKeyboard, 
      forMoreMessage, 
      vpn, 
      registration,
      login
    } = languages[locale];

    const payload = ctx.startPayload;

    // Send welcome image with inline keyboard and animated emoji in caption
    await ctx.replyWithPhoto('https://iili.io/fyGKzas.jpg', {
      caption: welcomeMessage + " 🙂",  // Plain emoji can also work here
      parse_mode: "Markdown",
      entities: [
        {
          type: "custom_emoji",
          offset: welcomeMessage.length + 1, // emoji offset
          length: 2, // length for the emoji, can be 2 for animated
          custom_emoji_id: "5334785333697473617"
        }
      ],
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: welcomeButtonInline,
              web_app: { url: web_app }
            }
          ]
        ],
      },
    });

    // Send menu with regular keyboard (cannot have custom emoji in buttons)
    await ctx.reply(
      forMoreMessage + " 🙂",  // animated emoji in message text
      {
        parse_mode: "Markdown",
        entities: [
          {
            type: "custom_emoji",
            offset: forMoreMessage.length + 1,
            length: 2,
            custom_emoji_id: "5334785333697473617"
          }
        ],
        reply_markup: {
          keyboard: [
            [
              { text: suppotButtonKeyboard },
              { text: promotionButtonKeyboard }
            ],
            [
              { text: FAQButtonKeyboard },
              { text: helpMeButtonKeyboard }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      }
    );

    // Handle promo code if exists
    if (payload) {
      try {
        await knex('users')
          .update({ mahbet_id: payload })
          .where({ telegram_id: ctx.from.id });
        
        await ctx.reply(
          `🎁 *کد تخفیف فعال شد!* 🙂\n\n` +
          `کد شما: \`${payload}\`\n\n` +
          `بونوس با موفقیت به حساب شما اضافه شد 🚀`,
          {
            parse_mode: 'Markdown',
            entities: [
              {
                type: "custom_emoji",
                offset: 18, // adjust offset for animated emoji in the text
                length: 2,
                custom_emoji_id: "5334785333697473617"
              }
            ]
          }
        );
      } catch(promoErr) {
        console.log('Error applying promo code:', promoErr.message);
        await ctx.reply('⚠️ خطا در فعال‌سازی کد تخفیف. لطفاً با پشتیبانی تماس بگیرید.');
      }
    }

  } catch(err) {
    console.log('Error in welcome handler:', err.message);
    console.error('Full error:', err);
    
    // Send user-friendly error message
    try {
      await ctx.reply('❌ خطایی رخ داده است. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.');
    } catch(replyErr) {
      console.log('Failed to send error message:', replyErr.message);
    }
  }
};
