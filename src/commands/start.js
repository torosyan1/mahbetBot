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

    // Send welcome image with inline keyboard
    // icon_custom_emoji_id ONLY works with inline buttons
    await ctx.replyWithPhoto('https://iili.io/fyGKzas.jpg', {
      caption: welcomeMessage,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: welcomeButtonInline,
              web_app: { url: web_app },
              icon_custom_emoji_id: '5334646924081394109'  // ✅ Animated custom emoji (works here)
            }
          ]
        ],
      },
    });

    // Send menu with regular keyboard
    // ⚠️ Regular keyboards ONLY support text emojis (no custom emoji, no colors)
    await ctx.reply(
      forMoreMessage,
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: `${suppotButtonKeyboard}`,  // Standard text emoji
              },
              {
                text: `${promotionButtonKeyboard}`,
              }
            ],
            [
              {
                text: `${FAQButtonKeyboard}`,
              },
              {
                text: `${helpMeButtonKeyboard}`,
              }
            ],
          ],
          resize_keyboard: true,
          persistent: true,
          one_time_keyboard: false,
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
          `🎁 *کد تخفیف فعال شد!*\n\n` +
          `کد شما: \`${payload}\`\n\n` +
          `بونوس با موفقیت به حساب شما اضافه شد 🚀`,
          { parse_mode: 'Markdown' }
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