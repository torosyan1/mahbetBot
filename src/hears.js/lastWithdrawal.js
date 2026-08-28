const axios = require('axios');
const { resolveMahbetId } = require('../helpers/mahbetId');
const { locale, centralpay_api_url, centralpay_api_token, support_username } = require('../utils/env');
const languages = require('../utils/language');

// Each lookup drives a real browser session on the CentralPay side, so a player
// who has just been shown their withdrawal waits before asking again. A
// withdrawal is paid out over hours, not seconds — there is nothing new to see
// sooner than that.
const SUCCESS_COOLDOWN_MS = Number(process.env.CENTRALPAY_LOOKUP_COOLDOWN_MIN || 20) * 60 * 1000;
// Shorter hold when the answer was "you have no withdrawals": that player may
// be waiting for a request to appear, so locking them out for 20 minutes would
// be answering a question they haven't been able to ask yet.
const EMPTY_COOLDOWN_MS = 2 * 60 * 1000;
// Held while a lookup is in flight, so a double-tap can't start two of them.
const IN_FLIGHT_MS = 60 * 1000;

// Cooldowns live in Redis when it's available, so they survive a bot restart
// and hold across processes; the Map is the fallback when it isn't.
const localCooldowns = new Map();
const cooldownKey = (id) => `lw:cooldown:${id}`;

// Redis has no timeout of its own here — a hung call would wedge the update.
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('redis timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function cooldownUntil(telegramId) {
  try {
    if (global.redisClient) {
      const raw = await withTimeout(global.redisClient.get(cooldownKey(telegramId)), 2000);
      return raw ? Number(raw) : 0;
    }
  } catch (err) {
    console.log('lastWithdrawal cooldown read failed, using local:', err.message);
  }
  return localCooldowns.get(telegramId) || 0;
}

async function holdFor(telegramId, ms) {
  const until = Date.now() + ms;
  localCooldowns.set(telegramId, until);
  try {
    if (global.redisClient) {
      await withTimeout(
        global.redisClient.set(cooldownKey(telegramId), String(until), { PX: ms }),
        2000
      );
    }
  } catch (err) {
    console.log('lastWithdrawal cooldown write failed, local only:', err.message);
  }
}

async function release(telegramId) {
  localCooldowns.delete(telegramId);
  try {
    if (global.redisClient) await withTimeout(global.redisClient.del(cooldownKey(telegramId)), 2000);
  } catch (err) {
    console.log('lastWithdrawal cooldown clear failed:', err.message);
  }
}

const money = (n) => Number(n || 0).toLocaleString('en-US');

const text = {
  fa: {
    notLinked:
      '⚠️ حساب کاربری ماه بت شما به این ربات متصل نیست.\n\n' +
      `برای اتصال حساب، از طریق لینک موجود در سایت وارد ربات شوید یا با پشتیبانی ${support_username} در تماس باشید.`,
    wait: '⏳ در حال دریافت اطلاعات برداشت شما…',
    slowDown: '⏳ لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.',
    comeBackIn: (minutes) =>
      `⏳ شما به‌تازگی وضعیت برداشت خود را دریافت کرده‌اید.\n\n` +
      `برداشت‌ها به مرور و در چند مرحله پرداخت می‌شوند، بنابراین لطفاً ${minutes} دقیقه دیگر دوباره بررسی کنید.`,
    none: 'ℹ️ درخواست برداشتی برای حساب شما ثبت نشده است.',
    unavailable: `⚠️ در حال حاضر امکان بررسی برداشت وجود ندارد. لطفاً بعداً تلاش کنید یا با پشتیبانی ${support_username} در تماس باشید.`,
    title: '🧾 آخرین درخواست برداشت شما',
    amount: '💰 مبلغ کل برداشت',
    paid: '✅ مبلغ پرداخت شده',
    remaining: '⏳ مبلغ باقی‌مانده',
    status: '🔶 وضعیت فعلی',
    card: '💳 کارت',
    bank: '🏦 بانک',
    requestedAt: '🕕 تاریخ درخواست',
    payments: '💸 پرداخت‌ها',
    tracking: 'کد پیگیری',
    ref: '🔖 شماره پیگیری',
    toman: 'تومان',
    settled: 'پرداخت شد ✅',
    inProgress: 'در حال پرداخت ⏳',
    noPayment: 'هنوز پرداختی برای این درخواست انجام نشده است.',
    morePayments: (n) => `و ${n} پرداخت دیگر…`,
  },
  en: {
    notLinked:
      '⚠️ Your MahBet account is not linked to this bot.\n\n' +
      `Open the bot from the link on the site, or contact support ${support_username}.`,
    wait: '⏳ Fetching your withdrawal…',
    slowDown: '⏳ Please wait a moment and try again.',
    comeBackIn: (minutes) =>
      `⏳ You have just checked your withdrawal.\n\n` +
      `Withdrawals are paid out in stages, so please check again in ${minutes} minutes.`,
    none: 'ℹ️ No withdrawal requests found for your account.',
    unavailable: `⚠️ Withdrawal lookup is unavailable right now. Please try later or contact ${support_username}.`,
    title: '🧾 Your last withdrawal request',
    amount: '💰 Total withdrawal',
    paid: '✅ Paid',
    remaining: '⏳ Remaining',
    status: '🔶 Current status',
    card: '💳 Card',
    bank: '🏦 Bank',
    requestedAt: '🕕 Requested at',
    payments: '💸 Payments',
    tracking: 'Tracking number',
    ref: '🔖 Reference',
    toman: 'Toman',
    settled: 'Paid ✅',
    inProgress: 'In progress ⏳',
    noPayment: 'No payment has been made for this request yet.',
    morePayments: (n) => `and ${n} more payment(s)…`,
  },
};

const t = () => text[locale] || text.fa;

/**
 * The payment breakdown. A withdrawal is settled out of the payment pool in
 * slices, and the tracking number is what a player quotes to support when a
 * slice is disputed, so each one is listed rather than just summarised.
 * Newest first; capped so a long history can't blow Telegram's message limit.
 */
const MAX_PAYMENTS_SHOWN = 10;

function formatPayments(payments) {
  const L = t();
  if (!payments || !payments.length) return [L.noPayment];

  const shown = payments.slice(0, MAX_PAYMENTS_SHOWN);
  const lines = [`${L.payments}:`];
  shown.forEach((p, i) => {
    lines.push(
      '',
      `${i + 1}) ${money(p.amount)} ${L.toman}`,
      `🕕 ${p.atJalali || p.at || '-'}`,
      `🔖 ${L.tracking}: ${p.trackingId}`
    );
  });
  if (payments.length > shown.length) {
    lines.push('', L.morePayments(payments.length - shown.length));
  }
  return lines;
}

/** Render the flattened withdrawal the CentralPay service returns. */
function formatWithdrawal(w) {
  const L = t();
  const lines = [
    L.title,
    '',
    `${L.amount}: ${money(w.amount)} ${L.toman}`,
    `${L.paid}: ${money(w.paid)} ${L.toman}`,
    `${L.remaining}: ${money(w.remaining)} ${L.toman}`,
    `${L.status}: ${w.settled ? L.settled : L.inProgress}`,
    '',
    `${L.card}: ${w.cardMasked}`,
    `${L.bank}: ${w.bank}`,
    `${L.requestedAt}: ${w.requestedAtJalali || w.requestedAt || '-'}`,
    '',
    ...formatPayments(w.payments),
    '',
    `${L.ref}: ${w.withdrawalId}`,
  ];
  return lines.join('\n');
}

/** Ask the CentralPay automation service for this MahBet id's latest withdrawal. */
async function fetchLastWithdrawal(mahbetId) {
  const { data } = await axios.post(
    `${String(centralpay_api_url).replace(/\/+$/, '')}/api/withdrawals/last`,
    { mahbetId: String(mahbetId) },
    {
      headers: { Authorization: `Bearer ${centralpay_api_token}` },
      // The lookup runs through a real browser session — allow for a slow page.
      timeout: 30000,
    }
  );
  return data;
}

/**
 * "My last withdrawal" button: resolve the tapper's MahBet id from our own
 * users table, then ask the CentralPay automation service about it. The user
 * never types an id, and can only ever see their own withdrawal.
 */
module.exports = async (ctx) => {
  const L = t();
  const telegramId = ctx.from && ctx.from.id;
  if (!telegramId) return;

  try {
    if (!centralpay_api_url || !centralpay_api_token) {
      await ctx.reply(L.unavailable);
      return;
    }

    const remaining = (await cooldownUntil(telegramId)) - Date.now();
    if (remaining > 0) {
      await ctx.reply(remaining < 60 * 1000 ? L.slowDown : L.comeBackIn(Math.ceil(remaining / 60000)));
      return;
    }
    // Hold the slot while the lookup runs, so a double-tap can't start a second
    // one. Every path that ends without showing a withdrawal releases it again:
    // the cooldown exists to stop stampedes, not to punish a failed lookup.
    await holdFor(telegramId, IN_FLIGHT_MS);
    const allowImmediateRetry = () => release(telegramId);

    const { mahbetId, source } = await resolveMahbetId(telegramId);
    if (!mahbetId) {
      allowImmediateRetry();
      await ctx.reply(L.notLinked);
      return;
    }
    console.log(`lastWithdrawal: telegram ${telegramId} -> mahbet ${mahbetId} (via ${source})`);

    await ctx.reply(L.wait);

    const data = await fetchLastWithdrawal(mahbetId);
    if (!data || !data.ok) {
      console.log(`lastWithdrawal: service refused for ${mahbetId}:`, data && data.error);
      allowImmediateRetry();
      await ctx.reply(L.unavailable);
      return;
    }
    if (!data.last) {
      await holdFor(telegramId, EMPTY_COOLDOWN_MS);
      await ctx.reply(L.none);
      return;
    }

    await holdFor(telegramId, SUCCESS_COOLDOWN_MS);
    await ctx.reply(formatWithdrawal(data.last));
  } catch (err) {
    // A failed lookup must never leak the admin panel's error text to a player.
    console.log('lastWithdrawal error:', err.message);
    await release(telegramId).catch(() => {});
    await ctx.reply(L.unavailable).catch(() => {});
  }
};
