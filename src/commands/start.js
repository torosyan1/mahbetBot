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

    // ------------------------
    // 1️⃣ Send welcome image with inline keyboard + animated emoji
    // ------------------------
    const welcomeText = welcomeMessage + " "; // space before emoji
    await ctx.replyWithPhoto('https://iili.io/fyGKzas.jpg', {
      caption: welcomeText,
      entities: [
        {
          type: "custom_emoji",
          offset: welcomeText.length - 1, // last character = position for emoji
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

    // ------------------------
    // 2️⃣ Send menu with keyboard + animated emoji at the end
    // ------------------------
    const menuText = forMoreMessage + " "; // space for emoji
    await ctx.reply(menuText, {
      entities: [
        {
          type: "custom_emoji",
          offset: menuText.length - 1, // last character
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
        one_time_keyboard: false,
        persistent: true
      }
    });

    // ------------------------
    // 3️⃣ Handle promo code if exists
    // ------------------------
    if (payload) {
      try {
        await knex('users')
          .update({ mahbet_id: payload })
          .where({ telegram_id: ctx.from.id });
        
        const promoText = `🎁 کد تخفیف فعال شد! کد شما: ${payload} بونوس با موفقیت اضافه شد `;
        await ctx.reply(promoText + " ", {
          entities: [
            {
              type: "custom_emoji",
              offset: promoText.length, // emoji at the end
              length: 1,
              custom_emoji_id: "5334785333697473617"
            }
          ]
        });
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
