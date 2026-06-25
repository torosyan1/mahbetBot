const { getPool, savePrediction } = require('./db');

function parseScore(ctx) {
  const text = ctx.message?.text;
  if (text === undefined) return null;
  const value = Number(String(text).trim());
  if (!Number.isInteger(value) || value < 0 || value > 50) return null;
  return value;
}

// Plain ctx.session state machine instead of Telegraf Scenes/WizardScene.
// The Scenes/Stage layer made it hard to see exactly why the home->away
// handoff was stalling in prod; this version is fully explicit and logged.
async function predictionTextMiddleware(ctx, next) {
  const flow = ctx.session?.predictFlow;
  if (!flow || !ctx.message?.text) {
    return next();
  }

  console.log('predict flow: from=', ctx.from?.id, 'step=', flow.step, 'text=', ctx.message.text);

  const value = parseScore(ctx);
  if (value === null) {
    await ctx.reply('❗️ لطفاً یک عدد صحیح معتبر بفرستید (مثلاً 2).');
    return;
  }

  const pool = await getPool(flow.poolId);
  if (!pool || pool.status !== 'open') {
    await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
    ctx.session.predictFlow = undefined;
    return;
  }

  if (flow.step === 'home') {
    ctx.session.predictFlow = { poolId: pool.id, step: 'away', home: value };
    console.log('predict flow: from=', ctx.from?.id, 'home=', value, 'advancing to away step');
    await ctx.reply(`⚽ چند گل می‌زند ${pool.away_team}؟ (یک عدد بفرستید)`);
    return;
  }

  if (flow.step === 'away') {
    await savePrediction(pool.id, ctx.from.id, flow.home, value);
    ctx.session.predictFlow = undefined;
    console.log('predict flow: from=', ctx.from?.id, 'saved prediction', flow.home, '-', value);
    await ctx.reply(
      `✅ پیش‌بینی شما ثبت شد: ${pool.home_team} ${flow.home} - ${value} ${pool.away_team}\n` +
      `نتیجه نهایی که مشخص شد به شما اطلاع می‌دهیم.`
    );
    return;
  }
}

function registerPredictionHandlers(bot) {
  bot.use(predictionTextMiddleware);

  bot.action(/^predict_(\d+)$/, async (ctx) => {
    const poolId = Number(ctx.match[1]);
    console.log('predict action: from=', ctx.from?.id, 'poolId=', poolId);
    await ctx.answerCbQuery();

    const pool = await getPool(poolId);
    if (!pool || pool.status !== 'open') {
      await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
      return;
    }

    ctx.session.predictFlow = { poolId: pool.id, step: 'home' };
    await ctx.reply(`⚽ چند گل می‌زند ${pool.home_team}؟ (یک عدد بفرستید)`);
  });
}

module.exports = { registerPredictionHandlers };
