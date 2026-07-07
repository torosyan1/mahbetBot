const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale, mahbet_registr, mahbet_login } = require("../utils/env");
const languages = require("../utils/language");
const knex = require('../connections/db');
const { LUCKY_DRAW_BUTTON } = require('../dailyLucky/handlers');

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
    // ✅ Inline buttons support: icon_custom_emoji_id and style
    await ctx.replyWithPhoto('https://iili.io/fyGKzas.jpg', {
      caption: welcomeMessage,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: welcomeButtonInline,
              web_app: { url: web_app },
              style: 'success'  // ✅ Button color: "success" (green), "danger" (red), or "primary" (blue)
            }
          ]
        ],
      },
    });

    // Send menu with regular keyboard
    // ✅ Regular keyboard buttons also support: icon_custom_emoji_id and style (NEW in Bot API 9.4)
    await ctx.reply(
      forMoreMessage,
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: suppotButtonKeyboard,
                style: 'primary',  // ✅ Blue button
              },
              {
                text: promotionButtonKeyboard,
                style: 'success'  // ✅ Green button
              }
            ],
            [
              {
                text: FAQButtonKeyboard,
                style: 'primary'  // ✅ Blue button
              },
              {
                text: helpMeButtonKeyboard,
                style: 'danger'  // ✅ Red button
              }
            ],
            [
              {
                text: LUCKY_DRAW_BUTTON,
                style: 'success'  // ✅ Green button
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
    // Check if user already received a promo code (telegram_id exists in promo_codes)
    const alreadyUsed = await knex('promo_codes')
      .where({ telegram_id: String(ctx.from.id) })
      .first();

    if (alreadyUsed) {
      await ctx.reply(
        `⚠️ شما قبلاً کد هدیه دریافت کرده‌اید.\n\nهر کاربر فقط یک بار می‌تواند کد هدیه دریافت کند.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Get an unused promo code (telegram_id is NULL)
    const promoRow = await knex('promo_codes')
      .whereNull('telegram_id')
      .first();

    if (!promoRow) {
      await ctx.reply('⚠️ کد هدیه‌ای موجود نیست. لطفاً با پشتیبانی تماس بگیرید.');
      return;
    }

    // Mark promo code as used
    await knex('promo_codes')
      .update({ 
        telegram_id: String(ctx.from.id),
        active: 1
      })
      .where({ codes: promoRow.codes })
      .whereNull('telegram_id'); // extra safety to prevent race condition

    // Update user's mahbet_id
    await knex('users')
      .update({ mahbet_id: payload })
      .where({ telegram_id: ctx.from.id });

    await ctx.reply(
`🎁 *هدیه شما در راه است*\n\n` +
`تبریک، شما کد هدیه دریافت کرده‌اید\n\n` +
`\`${promoRow.codes}\`\n\n` +
`برای فعال سازی و استفاده از هدیه چرخش رایگان وارد حساب کاربری شده و بر روی آدمک کلیک کنید و سپس در قسمت کادر کد تبلیغاتی کد هدیه ارسال شده را بنویسید و سپس بر روی اعمال کردن کلیک کنید و بعد از فعال سازی به قسمت بونوس ها و قسمت چرخش های رایگان بروید و چرخش رایگان خود را مشاهده و فعال کنید و لذت ببرید.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: welcomeButtonInline,
                web_app: { url: web_app },
                style: 'success'  // ✅ Button color: "success" (green), "danger" (red), or "primary" (blue)
              }
            ]
          ]
        }
      }
    );

  } catch(promoErr) {
    console.log('Error applying promo code:', promoErr.message);
    await ctx.reply('⚠️ خطا در فعال‌سازی کد هدیه. لطفاً با پشتیبانی تماس بگیرید.');
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