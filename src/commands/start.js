const { Markup } = require("telegraf");
const { welcome_image_url, web_app, locale, mahbet_registr, mahbet_login } = require("../utils/env");
const languages = require("../utils/language");
const knex = require('../connections/db');
const { mainMenuKeyboard } = require('./menuKeyboard');
const dailyLucky = require('../dailyLucky/service');

/** MySQL unique-key violation — a parallel /start already inserted this user's claim. */
const isDuplicateClaim = (err) => err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);

function alreadyClaimedMessage(code) {
  const base = `⚠️ شما قبلاً کد هدیه دریافت کرده‌اید.\n\nهر کاربر فقط یک بار می‌تواند کد هدیه دریافت کند.`;
  return code ? `${base}\n\nکد هدیه شما:\n\`${code}\`` : base;
}

module.exports = async (ctx) => {
  try {
    const { 
      welcomeMessage, 
      welcomeButtonInline, 
      welcomeButtonKeyboard,
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
    // The dice button is dropped from the menu while the daily draw is closed.
    const luckyEnabled = await dailyLucky.isEnabled();
    await ctx.reply(forMoreMessage, { reply_markup: mainMenuKeyboard({ luckyEnabled }) });

// Handle promo code if exists
if (payload) {
  try {
    const telegramId = String(ctx.from.id);

    // The claims ledger is permanent: leaving the bot and starting it again does not clear it,
    // so a returning user can never take a second gift code.
    const existingClaim = await knex('welcome_bonus_claims')
      .where({ telegram_id: telegramId })
      .first();

    if (existingClaim) {
      await ctx.reply(alreadyClaimedMessage(existingClaim.promo_code), { parse_mode: 'Markdown' });
      return;
    }

    // Take a code and record the claim atomically, so two fast /start taps cannot both win a code.
    const promoRow = await knex.transaction(async (trx) => {
      const row = await trx('promo_codes')
        .whereNull('telegram_id')
        .forUpdate()
        .first();

      if (!row) return null;

      // Insert the ledger row first — its unique telegram_id rejects a concurrent second claim.
      await trx('welcome_bonus_claims').insert({
        telegram_id: telegramId,
        mahbet_id: String(payload),
        promo_code: row.codes,
      });

      await trx('promo_codes')
        .update({
          telegram_id: telegramId,
          active: 1
        })
        .where({ codes: row.codes })
        .whereNull('telegram_id'); // extra safety to prevent race condition

      // Update user's mahbet_id
      await trx('users')
        .update({ mahbet_id: payload })
        .where({ telegram_id: ctx.from.id });

      return row;
    });

    if (!promoRow) {
      await ctx.reply('⚠️ کد هدیه‌ای موجود نیست. لطفاً با پشتیبانی تماس بگیرید.');
      return;
    }

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
    if (isDuplicateClaim(promoErr)) {
      const claim = await knex('welcome_bonus_claims')
        .where({ telegram_id: String(ctx.from.id) })
        .first();
      await ctx.reply(alreadyClaimedMessage(claim && claim.promo_code), { parse_mode: 'Markdown' });
      return;
    }
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