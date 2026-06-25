const { getPool, savePrediction } = require('./db');

function registerPredictionHandlers(bot) {
  bot.action(/^predict_(\d+)$/, async (ctx) => {
    const poolId = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery();
      const pool = await getPool(poolId);
      if (!pool || pool.status !== 'open') {
        await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
        return;
      }
      ctx.session.predictFlow = { poolId, step: 'home' };
      console.log('predict action: set predictFlow, session now=', JSON.stringify(ctx.session));
      await ctx.reply(`⚽ چند گل می‌زند ${pool.home_team}؟ (یک عدد بفرستید)`);
    } catch (err) {
      console.log('predict action error:', err);
    }
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session?.predictFlow;
    console.log('predict text: session=', JSON.stringify(ctx.session), 'flow=', JSON.stringify(flow));
    if (!flow) return next();

    try {
      const value = Number(String(ctx.message.text).trim());
      if (!Number.isInteger(value) || value < 0 || value > 50) {
        await ctx.reply('❗️ لطفاً یک عدد صحیح معتبر بفرستید (مثلاً 2).');
        return;
      }

      const pool = await getPool(flow.poolId);
      if (!pool || pool.status !== 'open') {
        ctx.session.predictFlow = null;
        await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
        return;
      }

      if (flow.step === 'home') {
        ctx.session.predictFlow = { ...flow, step: 'away', home: value };
        console.log('predict text: advancing to away step, session now=', JSON.stringify(ctx.session));
        await ctx.reply(`⚽ چند گل می‌زند ${pool.away_team}؟ (یک عدد بفرستید)`);
        return;
      }

      if (flow.step === 'away') {
        const home = flow.home;
        const away = value;
        ctx.session.predictFlow = null;
        await savePrediction(flow.poolId, ctx.from.id, home, away);
        await ctx.reply(
          `✅ پیش‌بینی شما ثبت شد: ${pool.home_team} ${home} - ${away} ${pool.away_team}\n` +
          `نتیجه نهایی که مشخص شد به شما اطلاع می‌دهیم.`
        );
        return;
      }

      return next();
    } catch (err) {
      console.log('predict text flow error:', err);
    }
  });
}

module.exports = { registerPredictionHandlers };
