const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale } = require("../utils/env");
const languages = require("../utils/language");
const knex = require('../connections/db');

module.exports = async (ctx) => {
  try {
    const { 
      welcomeMessage, 
      welcomeButtonInline, 
      suppotButtonKeyboard, 
      promotionButtonKeyboard, 
      FAQButtonKeyboard, 
      helpMeButtonKeyboard, 
      forMoreMessage
    } = languages[locale];

    const payload = ctx.startPayload;

    // Send welcome image with inline keyboard and animated emoji
    await ctx.replyWithPhoto('https://iili.io/fyGKzas.jpg', {
      caption: welcomeMessage + " ", // Add a space before emoji
      entities: [
        {
          type: "custom_emoji",
          offset: welcomeMessage.length + 1, // position of the emoji
          length: 1,
          custom_emoji_id: "5334785333697473617"
        }
      ],
      reply_markup: {
        inline_keyboard: [
          [
            { text: welcomeButtonInline, web_app: { url: web_app } }
          ]
        ]
      }
    });

    // Send menu with standard keyboard (cannot use custom emoji in buttons)
    await ctx.reply(forMoreMessage + " ", {
      entities: [
        {
          type: "custom_emoji",
          offset: forMoreMessage.length + 1,
          length: 1,
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
    });

    // Handle promo code if exists
    if (payload) {
      try {
        await knex('users')
          .update({ mahbet_id: payload })
          .where({ telegram_id: ctx.from.id });
        
        await ctx.reply(
          `🎁 کد تخفیف فعال شد! \nکد شما: \`${payload}\`\nبونوس با موفقیت اضافه شد 🚀 `,
          {
            entities: [
              {
                type: "custom_emoji",
                offset: 21, // adjust if needed to match text
                length: 1,
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
    
    try {
      await ctx.reply('❌ خطایی رخ داده است. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.');
    } catch(replyErr) {
      console.log('Failed to send error message:', replyErr.message);
    }
  }
};
