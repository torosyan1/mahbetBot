const { Scenes } = require('telegraf');
const { getPool, savePrediction } = require('./db');

function parseScore(ctx) {
  const text = ctx.message?.text;
  if (text === undefined) return null;
  const value = Number(String(text).trim());
  if (!Number.isInteger(value) || value < 0 || value > 50) return null;
  return value;
}

const predictWizard = new Scenes.WizardScene(
  'predict-wizard',
  async (ctx) => {
    console.log('predict wizard [0/enter]: from=', ctx.from?.id, 'state=', JSON.stringify(ctx.scene.state));
    const { poolId } = ctx.scene.state;
    const pool = await getPool(poolId);
    if (!pool || pool.status !== 'open') {
      await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.pool = pool;
    await ctx.reply(`⚽ چند گل می‌زند ${pool.home_team}؟ (یک عدد بفرستید)`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    console.log('predict wizard [1/home]: from=', ctx.from?.id, 'cursor=', ctx.wizard.cursor, 'text=', ctx.message?.text, 'state=', JSON.stringify(ctx.wizard.state));
    const value = parseScore(ctx);
    if (value === null) {
      await ctx.reply('❗️ لطفاً یک عدد صحیح معتبر بفرستید (مثلاً 2).');
      return;
    }
    const pool = await getPool(ctx.wizard.state.pool.id);
    if (!pool || pool.status !== 'open') {
      await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.pool = pool;
    ctx.wizard.state.home = value;
    await ctx.reply(`⚽ چند گل می‌زند ${pool.away_team}؟ (یک عدد بفرستید)`);
    console.log('predict wizard [1/home]: advancing, new cursor will be', ctx.wizard.cursor + 1);
    return ctx.wizard.next();
  },
  async (ctx) => {
    console.log('predict wizard [2/away]: from=', ctx.from?.id, 'cursor=', ctx.wizard.cursor, 'text=', ctx.message?.text, 'state=', JSON.stringify(ctx.wizard.state));
    const value = parseScore(ctx);
    if (value === null) {
      await ctx.reply('❗️ لطفاً یک عدد صحیح معتبر بفرستید (مثلاً 2).');
      return;
    }
    const { pool, home } = ctx.wizard.state;
    const fresh = await getPool(pool.id);
    if (!fresh || fresh.status !== 'open') {
      await ctx.reply('⚠️ این پیش‌بینی بسته شده است.');
      return ctx.scene.leave();
    }
    await savePrediction(pool.id, ctx.from.id, home, value);
    await ctx.reply(
      `✅ پیش‌بینی شما ثبت شد: ${pool.home_team} ${home} - ${value} ${pool.away_team}\n` +
      `نتیجه نهایی که مشخص شد به شما اطلاع می‌دهیم.`
    );
    return ctx.scene.leave();
  }
);

function registerPredictionHandlers(bot) {
  bot.action(/^predict_(\d+)$/, async (ctx) => {
    const poolId = Number(ctx.match[1]);
    console.log('predict action: from=', ctx.from?.id, 'poolId=', poolId);
    await ctx.answerCbQuery();
    await ctx.scene.enter('predict-wizard', { poolId });
  });
}

module.exports = { registerPredictionHandlers, predictWizard };
