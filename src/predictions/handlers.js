const { getPool, savePrediction } = require('./db');

function registerPredictionHandlers(bot) {
  bot.action(/^predict_(\d+)$/, async (ctx) => {
    const poolId = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery();
      const pool = await getPool(poolId);
      if (!pool || pool.status !== 'open') {
        return ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
      }
      ctx.session.predictFlow = { poolId, step: 'home' };
      await ctx.reply(`⚽ چند گل می‌زند ${pool.home_team}؟ (یک عدد بفرستید)`);
    } catch (err) {
      console.log('predict action error:', err.message);
    }
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session?.predictFlow;
    if (!flow) return next();

    const value = Number(String(ctx.message.text).trim());
    if (!Number.isInteger(value) || value < 0 || value > 50) {
      return ctx.reply('❗️ لطفاً یک عدد صحیح معتبر بفرستید (مثلاً 2).');
    }

    const pool = await getPool(flow.poolId);
    if (!pool || pool.status !== 'open') {
      ctx.session.predictFlow = null;
      return ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
    }

    if (flow.step === 'home') {
      ctx.session.predictFlow = { ...flow, step: 'away', home: value };
      return ctx.reply(`⚽ چند گل می‌زند ${pool.away_team}؟ (یک عدد بفرستید)`);
    }

    if (flow.step === 'away') {
      const home = flow.home;
      const away = value;
      ctx.session.predictFlow = null;
      await savePrediction(flow.poolId, ctx.from.id, home, away);
      return ctx.reply(
        `✅ پیش‌بینی شما ثبت شد: ${pool.home_team} ${home} - ${away} ${pool.away_team}\n` +
        `نتیجه نهایی که مشخص شد به شما اطلاع می‌دهیم.`
      );
    }

    return next();
  });
}

module.exports = { registerPredictionHandlers };
