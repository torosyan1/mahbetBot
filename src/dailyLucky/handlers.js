const service = require('./service');
const { LUCKY_DRAW_BUTTON, mainMenuKeyboard } = require('../commands/menuKeyboard');

const CLOSED_TEXT = '⚠️ قرعه‌کشی روزانه بسته شده است.';

/**
 * Tell a user the draw is closed. Buttons handed out before it closed stay in old chats, so this
 * also clears the stale keyboard they tapped: the guess buttons on that message for an inline tap,
 * or the bottom menu's dice button for a menu tap.
 */
async function replyClosed(ctx) {
  if (ctx.callbackQuery) {
    // Already-answered (the draw closed mid-play) and expired queries both throw; neither matters here.
    await ctx.answerCbQuery(CLOSED_TEXT, { show_alert: true }).catch(() => {});
    // The message may be too old to edit, or carry no keyboard at all — neither is worth failing on.
    await ctx.editMessageReplyMarkup().catch(() => {});
    return;
  }

  await ctx.reply(CLOSED_TEXT, { reply_markup: mainMenuKeyboard({ luckyEnabled: false }) });
}

function guessKeyboard() {
  return {
    inline_keyboard: [
      [1, 2, 3].map((n) => ({ text: `${n}️⃣`, callback_data: `lucky_guess_${n}` })),
      [4, 5, 6].map((n) => ({ text: `${n}️⃣`, callback_data: `lucky_guess_${n}` })),
    ],
  };
}

async function offerPlay(ctx) {
  const gate = await service.canPlay(ctx.from.id);

  if (gate.disabled) {
    await replyClosed(ctx);
    return;
  }

  if (!gate.canPlay) {
    await ctx.reply(
      `⏳ شما امروز شانس خود را استفاده کرده‌اید.\n\nشانس بعدی شما تا ${service.formatRemaining(gate.remainingMs)} دیگر فعال می‌شود.`
    );
    return;
  }

  await ctx.reply(gate.settings.inviteText, { parse_mode: 'Markdown', reply_markup: guessKeyboard() });
}

async function handleGuess(ctx, guess) {
  const result = await service.submitGuess(ctx, guess);

  if (result.status === 'invalid') {
    await ctx.reply('❗️ لطفاً یک عدد بین ۱ تا ۶ انتخاب کنید.');
    return;
  }

  if (result.status === 'disabled') {
    await replyClosed(ctx);
    return;
  }

  if (result.status === 'cooldown') {
    await ctx.reply(
      `⏳ شما امروز شانس خود را استفاده کرده‌اید.\n\nشانس بعدی شما تا ${service.formatRemaining(result.remainingMs)} دیگر فعال می‌شود.`
    );
    return;
  }

  if (result.status === 'win') {
    if (!result.promo) {
      await ctx.reply('🎉 حدس شما درست بود! متأسفانه در حال حاضر کد هدیه‌ای موجود نیست، لطفاً با پشتیبانی تماس بگیرید.');
      return;
    }
    const text = result.settings.winText.replace('{code}', result.promo.code);
    await ctx.reply(text, { parse_mode: 'Markdown' });
    return;
  }

  // lose
  const hours = result.settings.cooldownHours;
  const text = result.settings.loseText.replace('{dice}', String(result.diceResult)).replace('{hours}', String(hours));
  await ctx.reply(text);
}

function registerDailyLuckyHandlers(bot) {
  bot.hears(LUCKY_DRAW_BUTTON, offerPlay);

  // The closed check runs before the tap is acked: a closed draw answers with an alert instead,
  // and Telegram only accepts one answer per callback query.
  bot.action('lucky_play', async (ctx) => {
    if (!(await service.isEnabled())) return replyClosed(ctx);
    await ctx.answerCbQuery();
    await offerPlay(ctx);
  });

  bot.action(/^lucky_guess_([1-6])$/, async (ctx) => {
    if (!(await service.isEnabled())) return replyClosed(ctx);
    await ctx.answerCbQuery();
    await handleGuess(ctx, Number(ctx.match[1]));
  });
}

module.exports = { registerDailyLuckyHandlers, LUCKY_DRAW_BUTTON };
