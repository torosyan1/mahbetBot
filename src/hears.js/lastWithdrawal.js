const axios = require('axios');
const { resolveMahbetId } = require('../helpers/mahbetId');
const { locale, centralpay_api_url, centralpay_api_token, support_username } = require('../utils/env');
const languages = require('../utils/language');

// One lookup per user per COOLDOWN_MS. Each request drives a real browser
// session on the CentralPay side, so a user holding down the button must not
// turn into a burst of admin-panel calls.
const COOLDOWN_MS = 20 * 1000;
const lastAsk = new Map();

const money = (n) => Number(n || 0).toLocaleString('en-US');

const text = {
  fa: {
    notLinked:
      '⚠️ حساب کاربری ماه بت شما به این ربات متصل نیست.\n\n' +
      `برای اتصال حساب، از طریق لینک موجود در سایت وارد ربات شوید یا با پشتیبانی ${support_username} در تماس باشید.`,
    wait: '⏳ در حال دریافت اطلاعات برداشت شما…',
    slowDown: '⏳ لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.',
    none: 'ℹ️ درخواست برداشتی برای حساب شما ثبت نشده است.',
    unavailable: `⚠️ در حال حاضر امکان بررسی برداشت وجود ندارد. لطفاً بعداً تلاش کنید یا با پشتیبانی ${support_username} در تماس باشید.`,
    title: '🧾 آخرین درخواست برداشت شما',
    amount: '💰 مبلغ درخواست',
    paid: '✅ پرداخت شده',
    remaining: '⏳ باقی‌مانده',
    status: '🔶 وضعیت',
    card: '💳 کارت',
    bank: '🏦 بانک',
    requestedAt: '🕕 تاریخ درخواست',
    lastPayment: '💸 آخرین پرداخت',
    ref: '🔖 شماره پیگیری',
    toman: 'تومان',
    settled: 'پرداخت شد ✅',
    inProgress: 'در حال پرداخت ⏳',
    noPayment: 'هنوز پرداختی انجام نشده است',
  },
  en: {
    notLinked:
      '⚠️ Your MahBet account is not linked to this bot.\n\n' +
      `Open the bot from the link on the site, or contact support ${support_username}.`,
    wait: '⏳ Fetching your withdrawal…',
    slowDown: '⏳ Please wait a moment and try again.',
    none: 'ℹ️ No withdrawal requests found for your account.',
    unavailable: `⚠️ Withdrawal lookup is unavailable right now. Please try later or contact ${support_username}.`,
    title: '🧾 Your last withdrawal request',
    amount: '💰 Requested',
    paid: '✅ Paid',
    remaining: '⏳ Remaining',
    status: '🔶 Status',
    card: '💳 Card',
    bank: '🏦 Bank',
    requestedAt: '🕕 Requested at',
    lastPayment: '💸 Last payment',
    ref: '🔖 Reference',
    toman: 'Toman',
    settled: 'Paid ✅',
    inProgress: 'In progress ⏳',
    noPayment: 'No payment has been made yet',
  },
};

const t = () => text[locale] || text.fa;

/** Render the flattened withdrawal the CentralPay service returns. */
function formatWithdrawal(w) {
  const L = t();
  const lines = [
    L.title,
    '',
    `${L.amount}: ${money(w.amount)} ${L.toman}`,
    `${L.paid}: ${money(w.paid)} ${L.toman}`,
  ];
  if (!w.settled) lines.push(`${L.remaining}: ${money(w.remaining)} ${L.toman}`);
  lines.push(
    `${L.status}: ${w.settled ? L.settled : L.inProgress}`,
    `${L.card}: ${w.cardMasked}`,
    `${L.bank}: ${w.bank}`,
    `${L.requestedAt}: ${w.requestedAtJalali || w.requestedAt || '-'}`,
    `${L.lastPayment}: ${w.lastPaymentAt || L.noPayment}`,
    `${L.ref}: ${w.withdrawalId}`
  );
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

    const previous = lastAsk.get(telegramId);
    if (previous && Date.now() - previous < COOLDOWN_MS) {
      await ctx.reply(L.slowDown);
      return;
    }
    lastAsk.set(telegramId, Date.now());

    const { mahbetId, source } = await resolveMahbetId(telegramId);
    if (!mahbetId) {
      await ctx.reply(L.notLinked);
      return;
    }
    console.log(`lastWithdrawal: telegram ${telegramId} -> mahbet ${mahbetId} (via ${source})`);

    await ctx.reply(L.wait);

    const data = await fetchLastWithdrawal(mahbetId);
    if (!data || !data.ok) {
      console.log(`lastWithdrawal: service refused for ${mahbetId}:`, data && data.error);
      await ctx.reply(L.unavailable);
      return;
    }
    if (!data.last) {
      await ctx.reply(L.none);
      return;
    }

    await ctx.reply(formatWithdrawal(data.last));
  } catch (err) {
    // A failed lookup must never leak the admin panel's error text to a player.
    console.log('lastWithdrawal error:', err.message);
    await ctx.reply(L.unavailable).catch(() => {});
  }
};
