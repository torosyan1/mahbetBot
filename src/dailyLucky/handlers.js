const service = require('./service');

const LUCKY_DRAW_BUTTON = '🎲 قرعه‌کشی روزانه';

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
    await ctx.reply('⚠️ قرعه‌کشی روزانه در حال حاضر غیرفعال است.');
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
    await ctx.reply('⚠️ قرعه‌کشی روزانه در حال حاضر غیرفعال است.');
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

  bot.action('lucky_play', async (ctx) => {
    await ctx.answerCbQuery();
    await offerPlay(ctx);
  });

  bot.action(/^lucky_guess_([1-6])$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleGuess(ctx, Number(ctx.match[1]));
  });
}

module.exports = { registerDailyLuckyHandlers, LUCKY_DRAW_BUTTON };
