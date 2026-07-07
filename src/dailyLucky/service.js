const axios = require('axios');
const knex = require('../connections/db');
const { bot_token } = require('../utils/env');
const db = require('./db');

const SETTINGS_KEYS = {
  enabled: 'lucky_draw_enabled',
  cooldownHours: 'lucky_draw_cooldown_hours',
  inviteText: 'lucky_draw_invite_text',
  notificationText: 'lucky_draw_notification_text',
  winText: 'lucky_draw_win_text',
  loseText: 'lucky_draw_lose_text',
};

const DEFAULT_SETTINGS = {
  enabled: true,
  cooldownHours: 24,
  inviteText:
    '🎲 *شانس روزانه شما آماده است!*\n\nنتیجه تاس امروز را حدس بزنید و یک کد هدیه رایگان ببرید!\n\nعدد مورد نظر خود را انتخاب کنید:',
  notificationText: '🎲 شانس جدید شما فعال شد!\n\nتاس روزانه را امتحان کنید و کد هدیه ببرید.',
  winText: '🎉 *تبریک!*\n\nحدس شما درست بود!\n\nکد هدیه شما:\n`{code}`\n\nقبل از انقضا از آن استفاده کنید.',
  loseText: '❌ حدس اشتباه بود.\n\nنتیجه تاس امروز: 🎲 {dice}\n\nموفق باشید در فرصت بعدی!\nشانس بعدی شما تا {hours} ساعت دیگر فعال می‌شود.',
};

async function getSettings() {
  const rows = await knex('settings')
    .whereIn('key', Object.values(SETTINGS_KEYS))
    .select('key', 'value');
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    enabled: raw[SETTINGS_KEYS.enabled] === undefined ? DEFAULT_SETTINGS.enabled : raw[SETTINGS_KEYS.enabled] === 'true',
    cooldownHours: Number(raw[SETTINGS_KEYS.cooldownHours]) || DEFAULT_SETTINGS.cooldownHours,
    inviteText: raw[SETTINGS_KEYS.inviteText] || DEFAULT_SETTINGS.inviteText,
    notificationText: raw[SETTINGS_KEYS.notificationText] || DEFAULT_SETTINGS.notificationText,
    winText: raw[SETTINGS_KEYS.winText] || DEFAULT_SETTINGS.winText,
    loseText: raw[SETTINGS_KEYS.loseText] || DEFAULT_SETTINGS.loseText,
  };
}

async function updateSettings(patch) {
  const fieldMap = {
    enabled: (v) => String(!!v),
    cooldownHours: (v) => String(Number(v) || DEFAULT_SETTINGS.cooldownHours),
    inviteText: (v) => String(v),
    notificationText: (v) => String(v),
    winText: (v) => String(v),
    loseText: (v) => String(v),
  };

  for (const [field, key] of Object.entries(SETTINGS_KEYS)) {
    if (patch[field] === undefined) continue;
    const value = fieldMap[field](patch[field]);
    const exists = await knex('settings').where({ key }).first();
    if (exists) {
      await knex('settings').where({ key }).update({ value, updated_at: knex.fn.now() });
    } else {
      await knex('settings').insert({ key, value });
    }
  }

  return getSettings();
}

/** How long until this user's next chance, or null if they can play right now. */
async function canPlay(telegramId) {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { canPlay: false, disabled: true, settings };
  }

  const latest = await db.getLatestAttempt(telegramId);
  if (!latest) {
    return { canPlay: true, settings };
  }

  const nextAvailableAt = new Date(latest.next_available_at);
  const remainingMs = nextAvailableAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    return { canPlay: true, settings };
  }

  return { canPlay: false, remainingMs, nextAvailableAt, settings };
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// Telegram's 🎲 dice animation runs for ~4s before it visually lands on a number.
const DICE_ANIMATION_MS = 4000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Roll a real Telegram dice message and return the value (1-6) Telegram's servers picked.
 * Waits out the dice animation so the caller doesn't reveal the result before it lands.
 */
async function rollDice(ctx) {
  const message = await ctx.replyWithDice({ emoji: '🎲' });
  await sleep(DICE_ANIMATION_MS);
  return message.dice.value;
}

/** Assign one unused promo code to a user inside a row-locked transaction; returns null if none left. */
async function claimPromo(telegramId) {
  return knex.transaction((trx) => db.claimPromoCode(trx, telegramId));
}

/**
 * Full "guess -> roll -> settle" flow for one play. Re-checks the cooldown at the moment of
 * play (not just when the guess keyboard was shown) so a user can't queue up two guesses
 * back-to-back and slip past the 24h limit.
 */
async function submitGuess(ctx, guess) {
  const telegramId = ctx.from.id;
  if (!Number.isInteger(guess) || guess < 1 || guess > 6) {
    return { status: 'invalid' };
  }

  const gate = await canPlay(telegramId);
  if (!gate.canPlay) {
    return gate.disabled
      ? { status: 'disabled' }
      : { status: 'cooldown', remainingMs: gate.remainingMs, nextAvailableAt: gate.nextAvailableAt };
  }

  const diceResult = await rollDice(ctx);
  const isWin = guess === diceResult;
  const nextAvailableAt = new Date(Date.now() + gate.settings.cooldownHours * 60 * 60 * 1000);

  let promo = null;
  if (isWin) {
    promo = await claimPromo(telegramId);
  }

  await db.createAttempt({ telegramId, guess, diceResult, isWin, promoCodeId: promo?.id, nextAvailableAt });

  return { status: isWin ? 'win' : 'lose', diceResult, promo, nextAvailableAt, settings: gate.settings };
}

/** Push a plain Telegram text message. Used by the reminder cron job, outside the bot's own context. */
async function sendReminder(telegramId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      chat_id: telegramId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🎲 Try Your Luck', callback_data: 'lucky_play' }]] },
    });
    return true;
  } catch (err) {
    console.error(`lucky draw reminder failed for ${telegramId}:`, err.response?.data?.description || err.message);
    return false;
  }
}

module.exports = {
  getSettings,
  updateSettings,
  canPlay,
  formatRemaining,
  rollDice,
  claimPromo,
  submitGuess,
  sendReminder,
  getStats: db.getStats,
};
