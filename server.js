require('dotenv').config()

// Without this, any unhandled rejection/exception anywhere in the process
// (a single failed Telegram API call, a Redis hiccup, etc.) crashes the
// whole server under Node's default behavior, and PM2's restart silently
// wipes any in-progress conversation state.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (ignored, process stays up):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (ignored, process stays up):', err);
});

const { Telegraf, session, Scenes } = require("telegraf");
// const iplocate = require("node-iplocate");
const geoip = require('geoip-lite');
const schedule = require('node-schedule');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { userActivityValidation } = require('./src/middleware/usersActivityValidation');
const { bot_token, locale, port, welcome_image_url, web_app } = require('./src/utils/env');
const FAQAnswers = require('./src/actions.js/FAQAnswers');
const { auth } = require("./src/middleware/auth");
const languages = require("./src/utils/language"); 
const start = require("./src/commands/start");
const knex = require('./src/connections/db');
const FAQ = require('./src/hears.js/FAQ');
const VPN = require('./src/hears.js/VPN');
const { registerPredictionHandlers, predictWizard } = require('./src/predictions/handlers');
const predictionsDb = require('./src/predictions/db');

const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard, vpn } = languages[locale];



const axios = require('axios');
const { RateLimiter } = require("limiter");
const initializeRedis = require('./src/connections/redis');
const { startPosterBot } = require('./src/posterBot');

(async () => {

const bot = new Telegraf(bot_token);

bot.catch((err, ctx) => {
  console.error(`Telegraf error for update ${ctx.update.update_id}:`, err);
});

// Sessions live in Redis (not memory) so an unrelated crash/restart mid-conversation
// (e.g. a Telegram API timeout) doesn't silently wipe an in-progress prediction flow.
const sessionStore = {
  async get(key) {
    const raw = await global.redisClient.get(`tg:session:${key}`);
    return raw ? JSON.parse(raw) : undefined;
  },
  async set(key, value) {
    await global.redisClient.set(`tg:session:${key}`, JSON.stringify(value), { EX: 60 * 60 * 24 });
  },
  async delete(key) {
    await global.redisClient.del(`tg:session:${key}`);
  },
};

bot.use(session({ store: sessionStore }));

const stage = new Scenes.Stage([predictWizard]);
bot.use(stage.middleware());

bot.use(userActivityValidation);
bot.use(auth);

bot.start(start);

registerPredictionHandlers(bot);

// hears
bot.hears(suppotButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, '@MB_Support'));
bot.hears(vpn, VPN);
bot.hears(promotionButtonKeyboard,(ctx)=>ctx.replyWithHTML(`<a href='https://telegra.ph/%D8%AC%D9%88%D8%A7%DB%8C%D8%B2-12-10'>${promotionButtonKeyboard}</a>`));
bot.hears(FAQButtonKeyboard, FAQ);
bot.hears(helpMeButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, languages[locale]['helpMessage']));

// actions
bot.action('faqAnswer1', FAQAnswers);
bot.action('faqAnswer2', FAQAnswers);
bot.action('faqAnswer3', FAQAnswers);
bot.action('faqAnswer4', FAQAnswers);
bot.action('faqAnswer5', FAQAnswers);
bot.action('faqAnswer6', FAQAnswers);
bot.action('faqAnswer7', FAQAnswers);
bot.action('faqAnswer8', FAQAnswers);
bot.action('faqAnswer9', FAQAnswers);
bot.action('faqAnswer10', FAQAnswers);

const redisClient = await initializeRedis();
  global.redisClient = redisClient;

  const API_URL = `https://api.telegram.org/bot${bot_token}/getUpdates`;
  let lastUpdateId = 1;


  async function sendCRMUpdates(updates) {
  for (const update of updates) {
    try {
      const res = await axios.post(
        "https://crm-t.betconstruct.com/telegram/cHJoOWd4enR1Ynhnazg5YToxODc0NzY0OQ==",
        update,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      console.log("CRM error:", err.response?.data || err.message);
      // Optional: continue processing other updates
    }
  }
}
  async function getUpdates() {
    try {
      const response = await axios.get(API_URL, {
        params: {
          offset: lastUpdateId + 1,
          limit: process.env.MAX_REQUEST_LIMIT,
          allowed_updates: JSON.stringify(['message', 'callback_query', 'my_chat_member']),
        },
      });

      const updates = response.data.result;
      const getLastID = await redisClient.get("lastUpdateId");

      if (updates && updates.length > 0) {
        updates.forEach((update) => {
          if (parseInt(getLastID) === update.update_id) return;
          bot.handleUpdate(update);
        });

        lastUpdateId = updates[updates.length - 1].update_id;
        await redisClient.set("lastUpdateId", lastUpdateId);

              // 1️⃣ Send update to CRM URL
      try {
       sendCRMUpdates(updates)
      } catch (err) {
        console.log('CRM', err)
        // Optional: log but don't break processing
        // console.error("CRM send error:", err.message);
      }
      }
    } catch (error) {
      // console.error("Error fetching updates:", error.message);
    }
  }

  try {
    setInterval(getUpdates, 500);
    console.log("Bot is polling for updates...");
  } catch (error) {
    console.error("Error setting up bot:", error);
  }
})();
// express server
const app = express();

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────
app.get('/', (_req, res) => res.send('ok'));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Multer file upload config ─────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error('Only images and videos are allowed'), ok);
  }
});

// ── POST /upload ──────────────────────────────────────────────
app.post('/upload', panelAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host     = req.headers['x-forwarded-host']  || req.get('host');
  const url      = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, mimetype: req.file.mimetype });
});

// ── GET /stats ────────────────────────────────────────────────
app.get('/stats', async (_req, res) => {
  try {
    const dbUsers = await knex('users').select('telegram_id').where('active', 1);
    const total = new Set(dbUsers.filter(u => u.telegram_id).map(u => String(u.telegram_id))).size;
    res.json({ total });
  } catch (err) {
    res.json({ total: 0 });
  }
});

app.get('/users/registered', panelAuth, async (_req, res) => {
  try {
    const users = await knex('users')
      .whereNotNull('mahbet_id')
      .where('mahbet_id', '!=', '')
      .select('id', 'telegram_id', 'username', 'mahbet_id', 'createdAt');
    res.json({ total: users.length, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /users/:id/message — send a direct Telegram message ──
app.post('/users/:id/message', panelAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const user = await knex('users').where({ id: req.params.id }).first();
    if (!user || !user.telegram_id) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ok = await sendTelegramText(user.telegram_id, message);
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
    try {
        const { action, user_id, telegram_id } = req.body;
        console.log('----', action)
        if(!user_id || !telegram_id || !action) {
            return res.status(500).send('Something went wrong!');
         }
         
        await knex('logs').insert({
            action,
            telegram_id,
            mahbet_id: user_id
        })
        res.status(200).send(true)
    } catch(err){
        console.log(err);
        res.status(500).send('Something went wrong!');
    }
});

app.post('/registration', async (req, res) => {
    try {
        const { action, user_id, telegram_id } = req.body;
        console.log('----', action)
        if(!user_id || !telegram_id || !action) {
           return res.status(500).send('Something went wrong!');
        }
        
        await knex('logs').insert({
            action,
            telegram_id,
            mahbet_id: user_id
        })
        res.status(200).send(true)
    } catch(err){
        console.log(err);
        res.status(500).send('Something went wrong!');
    }
});

app.post('/fraud', async (req, res) => {
    try {
        // const { ip, device, device_input, telegram_id } = req.body;
        // // if( !ip || !device || !device_input || !telegram_id) {
        // //    return res.status(500).send('Something went wrong!');
        // // }
        // const data = geoip.lookup(ip);
        // // const data = await iplocate(ip)

        // await knex('fraud').insert({
        //     ip,
        //     city: data.timezone,
        //     country: data.country,
        //     device,
        //     device_input,
        //     telegram_id,
        // })
        res.status(200).send(true)
    } catch(err){
        console.log(err, 'fraud');
        res.status(500).send('Something went wrong!,');
    }
});

app.post('/fraud', async (req, res) => {
    try {
        
        res.status(200).send(true)
    } catch(err){
        console.log(err, 'fraud');
        res.status(500).send('Something went wrong!,');
    }
});

// Function to make an API call for a single item
async function makeAPICall(item, photo, caption, buttonText, butonUrl) {
  try {
    const apiEndpoint = `https://api.telegram.org/bot${bot_token}/sendPhoto`;
     const buttons =  {
        inline_keyboard: [
          [{
            text: buttonText,
            web_app: butonUrl
          }]
        ]
      }
      const body = {
        chat_id: item,
        photo,
        caption,
      }
      if(butonUrl && buttonText) {
        body.replreply_markup = buttons
      }
    // Make your API call here using axios or any other library
    await axios.post(apiEndpoint, body);
    console.log(`API call for item ${item} succeeded`);
  } catch (error) {
    console.error(`Error occurred while processing item ${item}:`, error);
  }
}

// API endpoint to trigger bulk API calls
app.post("/sendMessage", async (req, res) => {
  try {
    const { photo, caption, buttonText, butonUrl } = req.body;
    const items = await knex('users').where({ active:  1 });

    // Execute API calls with rate limiting
    for (const item of items) {
      await rateLimiter.consume(); // Wait until we can consume a point from the rate limiter
      await makeAPICall(item, photo, caption, buttonText, butonUrl);
      console.log("count======>", item);
    }

    res.send("Bulk API calls completed successfully");
  } catch (error) {
    res.status(500).send("Error occurred during bulk API calls");
  }
});

// ── Panel Auth ────────────────────────────────────────────────
const PANEL_TOKEN = process.env.PANEL_TOKEN || 'mahbet-panel-secret';

app.post('/panel-login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.PANEL_USER || 'admin';
  const validPass = process.env.PANEL_PASS || 'mahbet2024';
  if (username === validUser && password === validPass) {
    return res.json({ token: PANEL_TOKEN });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

function panelAuth(req, res, next) {
  const token = req.headers['x-panel-token'] || req.query.token;
  if (token === PANEL_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── In-memory broadcast jobs ──────────────────────────────────
const broadcastJobs = new Map(); // jobId → { total, sent, failed, done, clients[] }

/**
 * Build inline_keyboard from frontend buttons array.
 * Falls back to default MahBet buttons if none supplied.
 */
function buildReplyMarkup(buttons) {
  if (Array.isArray(buttons) && buttons.length > 0) {
    return {
      inline_keyboard: buttons.map(b =>
        b.type === 'web_app'
          ? [{ text: b.text, web_app: { url: b.url } }]
          : [{ text: b.text, url: b.url }]
      )
    };
  }
  return {
    inline_keyboard: [
      [{ text: "ارتباط با پشتیبانی آنلاین ماه بت", url: "https://direct.lc.chat/14697702" }],
      [{ text: "کانال تلگرامی ماه بت",              url: "https://t.me/Mahbet_official" }],
      [{ text: "دانلود اپلیکیشن ماه بت",            url: "https://files.igmobile.io/storage/v1/object/public/Shared/MahBv1.0.2.apk" }],
      [{ text: "ورود به سایت 📌",                   web_app: { url: "https://www.mahbet.com" } }]
    ]
  };
}

/** Send one Telegram message. Returns true on success. */
async function sendTelegramMedia(chat_id, photo, video, caption, buttons) {
  try {
    const type = photo ? 'photo' : video ? 'video' : null;
    if (!type) return false;
    const mediaValue = photo || video;
    const endpoint = `https://api.telegram.org/bot${bot_token}/send${type[0].toUpperCase() + type.slice(1)}`;

    const localMatch = mediaValue.match(/\/uploads\/([^?#]+)$/);
    if (localMatch) {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('chat_id', String(chat_id));
      form.append(type, fs.createReadStream(path.join(__dirname, 'uploads', localMatch[1])));
      form.append('caption', caption);
      const markup = buildReplyMarkup(buttons);
      if (markup) form.append('reply_markup', JSON.stringify(markup));
      await axios.post(endpoint, form, { headers: form.getHeaders() });
    } else {
      await axios.post(endpoint, {
        chat_id,
        [type]: mediaValue,
        caption,
        reply_markup: buildReplyMarkup(buttons)
      });
    }
    return true;
  } catch (err) {
    const status = err.response?.status;
    const desc   = err.response?.data?.description || err.message;
    console.error(`❌ chat_id ${chat_id}: [${status}] ${desc}`);

    // Auto-deactivate users who blocked the bot or whose accounts are gone
    const permanent = status === 403 || (status === 400 && (
      desc.includes('chat not found') ||
      desc.includes('user is deactivated') ||
      desc.includes('bot was kicked')
    ));
    if (permanent) {
      try {
        await knex('users').where({ telegram_id: String(chat_id) }).update({ active: 0 });
      } catch { /* ignore if user not in DB */ }
    }

    return false;
  }
}

/** Send a plain text Telegram message. Returns true on success. */
async function sendTelegramText(chat_id, text) {
  try {
    const endpoint = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    await axios.post(endpoint, { chat_id, text });
    return true;
  } catch (err) {
    const status = err.response?.status;
    const desc   = err.response?.data?.description || err.message;
    console.error(`❌ chat_id ${chat_id}: [${status}] ${desc}`);

    // Auto-deactivate users who blocked the bot or whose accounts are gone
    const permanent = status === 403 || (status === 400 && (
      desc.includes('chat not found') ||
      desc.includes('user is deactivated') ||
      desc.includes('bot was kicked')
    ));
    if (permanent) {
      try {
        await knex('users').where({ telegram_id: String(chat_id) }).update({ active: 0 });
      } catch { /* ignore if user not in DB */ }
    }

    return false;
  }
}

const rateLimiter = new RateLimiter({ tokensPerInterval: 25, interval: 'second' });

// ── POST /trigger — start broadcast, respond immediately with jobId ──
app.post('/trigger', panelAuth, async (req, res) => {
  try {
    const { photo, video, caption, buttons } = req.body;

    if ((!photo && !video) || !caption) {
      return res.status(400).json({ error: 'photo or video + caption required' });
    }

    // Build user list from DB only
    const dbUsers = await knex('users').select('telegram_id').where('active', 1);
    const ids = [
      ...new Map(
        dbUsers.filter(u => u.telegram_id).map(u => [String(u.telegram_id), u.telegram_id])
      ).values()
    ];

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const job   = { total: ids.length, sent: 0, failed: 0, done: false, clients: [] };
    broadcastJobs.set(jobId, job);

    // Respond immediately so the client can open the SSE stream
    res.json({ jobId, total: ids.length });

    // Broadcast in background — parallel batches of 25/sec
    (async () => {
      const BATCH = 25;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const start = Date.now();

        const results = await Promise.all(
          batch.map(id => sendTelegramMedia(id, photo, video, caption, buttons))
        );
        results.forEach(ok => { if (ok) job.sent++; else job.failed++; });

        const payload = JSON.stringify({ sent: job.sent, failed: job.failed, total: job.total, done: false });
        job.clients.forEach(c => c.write(`data: ${payload}\n\n`));

        // Respect Telegram's 30 msg/sec limit — wait remainder of 1 second
        const elapsed = Date.now() - start;
        if (elapsed < 1000 && i + BATCH < ids.length) {
          await new Promise(r => setTimeout(r, 1000 - elapsed));
        }
      }

      job.done = true;
      const done = JSON.stringify({ sent: job.sent, failed: job.failed, total: job.total, done: true });
      job.clients.forEach(c => { c.write(`data: ${done}\n\n`); c.end(); });
      console.log(`✅ Broadcast ${jobId} done — sent:${job.sent} failed:${job.failed}`);

      try {
        await knex('broadcasts').insert({
          type: 'bot',
          caption,
          total_users: ids.length,
          sent: job.sent,
          failed: job.failed,
          status: 'completed',
        });
      } catch { /* ignore if table missing */ }

      setTimeout(() => broadcastJobs.delete(jobId), 120_000);
    })();

  } catch (err) {
    console.error('❌ /trigger:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /trigger-stream/:jobId — SSE progress stream ─────────
app.get('/trigger-stream/:jobId', panelAuth, (req, res) => {
  const job = broadcastJobs.get(req.params.jobId);
  if (!job) return res.status(404).send('Job not found');

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send current snapshot immediately
  const snap = JSON.stringify({ sent: job.sent, failed: job.failed, total: job.total, done: job.done });
  res.write(`data: ${snap}\n\n`);
  if (job.done) { res.end(); return; }

  job.clients.push(res);
  req.on('close', () => { job.clients = job.clients.filter(c => c !== res); });
});

// ── GET /dashboard-stats ─────────────────────────────────────
app.get('/dashboard-stats', panelAuth, async (_req, res) => {
  try {
    const dbUsers2 = await knex('users').select('telegram_id').where('active', 1);
    const totalUsers = new Set(dbUsers2.filter(u => u.telegram_id).map(u => String(u.telegram_id))).size;

    let totalBroadcasts = 0, sentToday = 0, failedMessages = 0, successRate = 87;
    try {
      const bc = await knex('broadcasts').count('id as c').first();
      totalBroadcasts = Number(bc?.c) || 0;
      const todayBc = await knex('broadcasts')
        .where('created_at', '>=', knex.raw('CURDATE()'))
        .sum('sent as s').first();
      sentToday = Number(todayBc?.s) || 0;
      const failedBc = await knex('broadcasts').sum('failed as f').first();
      failedMessages = Number(failedBc?.f) || 0;
      const rates = await knex('broadcasts').select(knex.raw('SUM(sent) as s, SUM(total_users) as t')).first();
      if (rates?.t) successRate = Math.round((rates.s / rates.t) * 100);
    } catch { /* table might not exist yet */ }

    let totalChannels = 1;
    try {
      const ch = await knex('channels').count('id as c').first();
      totalChannels = Number(ch?.c) || 1;
    } catch { /* ignore */ }

    res.json({ totalUsers, totalChannels, totalBroadcasts, successRate, sentToday, failedMessages,
      broadcastActivity: [], dailyUsers: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /statistics ───────────────────────────────────────────
app.get('/statistics', panelAuth, async (_req, res) => {
  try {
    let totalSent = 0, deliveryRate = 87, failedRate = 8;
    let mostActiveDays = [], trends = [], byType = [];
    try {
      const agg = await knex('broadcasts').select(knex.raw('SUM(sent) as s, SUM(failed) as f, SUM(total_users) as t')).first();
      totalSent = Number(agg?.s) || 0;
      const total = Number(agg?.t) || 1;
      deliveryRate = Math.round((Number(agg?.s) / total) * 100);
      failedRate   = Math.round((Number(agg?.f) / total) * 100);

      const typeRows = await knex('broadcasts').select('type').count('id as c').groupBy('type');
      const typeTotal = typeRows.reduce((a, r) => a + Number(r.c), 0) || 1;
      byType = typeRows.map(r => ({ name: r.type === 'bot' ? 'Bot Broadcast' : 'Channel Broadcast', value: Math.round(Number(r.c) / typeTotal * 100) }));

      const last7 = await knex('broadcasts')
        .select(knex.raw('DATE(created_at) as date'), knex.raw('SUM(sent) as sent'), knex.raw('SUM(failed) as failed'))
        .where('created_at', '>=', knex.raw('NOW() - INTERVAL 7 DAY'))
        .groupByRaw('DATE(created_at)')
        .orderBy('date');
      trends = last7.map(r => ({ date: r.date, sent: Number(r.sent), failed: Number(r.failed) }));

      const days = await knex('broadcasts')
        .select(knex.raw("DAYNAME(created_at) as day"), knex.raw('COUNT(*) as count'))
        .groupByRaw('DAYNAME(created_at)');
      mostActiveDays = days.map(r => ({ day: r.day?.slice(0, 3), count: Number(r.count) }));
    } catch { /* ignore */ }
    res.json({ totalSent, deliveryRate, failedRate, mostActiveDays, trends, byType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET/POST /settings ────────────────────────────────────────
app.get('/settings', panelAuth, async (_req, res) => {
  try {
    const rows = await knex('settings').select('*');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    const defaults = {
      website_url: 'https://www.mahbet.com',
      instagram_url: 'https://www.instagram.com/mahbet_official/?hl=en',
      support_url: 'https://direct.lc.chat/14697702/',
      apk_url: 'https://files.igmobile.io/storage/v1/object/public/Shared/MahBv1.0.2.apk',
      bot_url: 'https://t.me/MahBetBot',
      admin_username: '@Mahbet_official',
    };
    res.json({ ...defaults, ...settings });
  } catch {
    res.json({ website_url:'https://www.mahbet.com', instagram_url:'', support_url:'', apk_url:'', bot_url:'', admin_username:'' });
  }
});

app.post('/settings', panelAuth, async (req, res) => {
  try {
    const fields = ['website_url','instagram_url','support_url','apk_url','bot_url','admin_username'];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        const exists = await knex('settings').where({ key }).first();
        if (exists) {
          await knex('settings').where({ key }).update({ value: req.body[key] });
        } else {
          await knex('settings').insert({ key, value: req.body[key] });
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET/POST/DELETE /channels ─────────────────────────────────
app.get('/channels', panelAuth, async (_req, res) => {
  try {
    const rows = await knex('channels').select('*').orderBy('created_at', 'desc');
    res.json(rows);
  } catch {
    res.json([{ id: 1, name: 'MahBet Official', username: '@Mahbet_official', created_at: new Date() }]);
  }
});

app.post('/channels', panelAuth, async (req, res) => {
  try {
    const { name, username } = req.body;
    if (!name || !username) return res.status(400).json({ error: 'name and username required' });
    const [id] = await knex('channels').insert({ name, username });
    res.json({ id, name, username, created_at: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/channels/:id', panelAuth, async (req, res) => {
  try {
    await knex('channels').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET/POST /pools — prediction pools (e.g. Arsenal vs PSG) ──
app.get('/pools', panelAuth, async (_req, res) => {
  try {
    const pools = await predictionsDb.listPools();
    const counts = await knex('predictions')
      .select('pool_id')
      .count('id as c')
      .groupBy('pool_id');
    const countMap = Object.fromEntries(counts.map(c => [c.pool_id, Number(c.c)]));
    res.json(pools.map(p => ({ ...p, prediction_count: countMap[p.id] || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/pools', panelAuth, async (req, res) => {
  try {
    const { home_team, away_team } = req.body;
    if (!home_team || !away_team) {
      return res.status(400).json({ error: 'home_team and away_team required' });
    }
    const pool = await predictionsDb.createPool(home_team, away_team);
    res.json(pool);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Send the pool's announcement (with Predict button) to a given list of telegram ids. */
async function sendPoolAnnouncement(pool, ids) {
  const text = `⚽️ پیش‌بینی نتیجه بازی\n\n${pool.home_team} 🆚 ${pool.away_team}\n\nنظرتون چیه؟ نتیجه رو پیش‌بینی کن!`;
  const markup = { inline_keyboard: [[{ text: '🔮 پیش‌بینی نتیجه', callback_data: `predict_${pool.id}` }]] };
  let sent = 0, failed = 0;
  const BATCH = 25;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const start = Date.now();
    const results = await Promise.all(batch.map(id =>
      axios.post(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        chat_id: id, text, reply_markup: markup,
      }).then(() => true).catch(err => {
        console.error(`❌ pool announce ${id}:`, err.response?.data?.description || err.message);
        return false;
      })
    ));
    results.forEach(ok => { if (ok) sent++; else failed++; });
    const elapsed = Date.now() - start;
    if (elapsed < 1000 && i + BATCH < ids.length) {
      await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
  }
  return { sent, failed, total: ids.length };
}

// ── POST /pools/:id/announce — test send to specific ids, or broadcast to all ──
app.post('/pools/:id/announce', panelAuth, async (req, res) => {
  try {
    const pool = await predictionsDb.getPool(req.params.id);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const { telegram_ids } = req.body;
    let ids;
    if (Array.isArray(telegram_ids) && telegram_ids.length > 0) {
      ids = [...new Set(telegram_ids.map(String))];
    } else {
      const dbUsers = await knex('users').select('telegram_id').where('active', 1);
      ids = [...new Set(dbUsers.filter(u => u.telegram_id).map(u => String(u.telegram_id)))];
    }

    const result = await sendPoolAnnouncement(pool, ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/pools/:id', panelAuth, async (req, res) => {
  try {
    const pool = await predictionsDb.getPool(req.params.id);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    const predictions = await predictionsDb.listPredictions(req.params.id);
    res.json({ ...pool, predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /pools/:id/settle — set final score, notify everyone ──
app.post('/pools/:id/settle', panelAuth, async (req, res) => {
  try {
    const { result_home, result_away } = req.body;
    if (result_home === undefined || result_away === undefined) {
      return res.status(400).json({ error: 'result_home and result_away required' });
    }
    const pool = await predictionsDb.getPool(req.params.id);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const predictions = await predictionsDb.settlePool(req.params.id, Number(result_home), Number(result_away));

    let notified = 0;
    for (const p of predictions) {
      const text = p.is_correct
        ? `🎉 درست بود!\n\n${pool.home_team} ${result_home} - ${result_away} ${pool.away_team}\n\nشما پیش‌بینی درستی داشتید، تبریک! 🏆`
        : `❌ این بار درست نبود.\n\nنتیجه واقعی: ${pool.home_team} ${result_home} - ${result_away} ${pool.away_team}\nپیش‌بینی شما: ${pool.home_team} ${p.predicted_home} - ${p.predicted_away} ${pool.away_team}\n\nدفعه بعد موفق باشید! 🍀`;
      const ok = await sendTelegramText(p.telegram_id, text);
      if (ok) notified++;
    }

    res.json({ ok: true, total: predictions.length, notified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/pools/:id', panelAuth, async (req, res) => {
  try {
    await knex('prediction_pools').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /channel-broadcast ───────────────────────────────────
app.post('/channel-broadcast', panelAuth, async (req, res) => {
  try {
    const { channelUsername, photo, video, caption } = req.body;
    if (!channelUsername || (!photo && !video) || !caption) {
      return res.status(400).json({ error: 'channelUsername, media and caption required' });
    }
    const type  = photo ? 'photo' : 'video';
    const media = photo || video;
    const endpoint = `https://api.telegram.org/bot${bot_token}/send${type[0].toUpperCase()+type.slice(1)}`;
    const result = await axios.post(endpoint, {
      chat_id: channelUsername,
      [type]: media,
      caption,
      reply_markup: buildReplyMarkup([])
    });

    try {
      await knex('broadcasts').insert({
        type: 'channel',
        caption,
        total_users: 1,
        sent: result.data.ok ? 1 : 0,
        failed: result.data.ok ? 0 : 1,
        status: result.data.ok ? 'completed' : 'failed',
      });
    } catch { /* ignore if table missing */ }

    res.json({ ok: result.data.ok, messageId: result.data.result?.message_id });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// ── GET /broadcasts ───────────────────────────────────────────
app.get('/broadcasts', panelAuth, async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10 } = req.query;
    let query = knex('broadcasts').orderBy('created_at', 'desc');
    if (type) query = query.where({ type });
    if (search) query = query.where('caption', 'like', `%${search}%`);
    const offset = (Number(page) - 1) * Number(limit);
    const total = await query.clone().count('id as c').first().then(r => Number(r?.c) || 0);
    const data  = await query.limit(Number(limit)).offset(offset);
    res.json({ data, total });
  } catch {
    res.json({ data: [], total: 0 });
  }
});

app.delete('/broadcasts/:id', panelAuth, async (req, res) => {
  try {
    await knex('broadcasts').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Patch /trigger to record broadcast ───────────────────────
// (override the existing /trigger to also log to DB)
// The existing /trigger is already defined above; we add DB logging inside it
// by patching the background job's completion callback.
// We do this via a simple middleware that wraps the existing route.

app.listen(port, async () => {
  await startPosterBot()
  console.log(`Server is running on port ${port}`)
});

// schedule.scheduleJob('0 0 0 * * *', async () =>{
//     try {
//         const users = await knex('users').select('*').where('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
//         const reg = await knex('logs').select('*').where('action', '=', 'registration').andWhere('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
//         const login = await knex('logs').select('*').where('action', '=', 'login').andWhere('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
   
//         const newUserJoinedCount = `New users joined bot count - ${users.length} 🎯`
//         const newRegCount = `New reg users count - ${reg.length} 🎯`
//         const newLoginCount = `New login bot users count - ${login.length} 🎯`

//         await bot.telegram.sendMessage(-4036292845, newUserJoinedCount + '\n' + newRegCount + '\n' + newLoginCount)
//     } catch (error) {
//         console.error('Error retrieving users:', error.message);
//       } 
//     }  
// );



const dailyData = {
  monday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.25.32.jpeg?alt=media&token=358dd388-2f05-4b2e-a712-9cb8651ec1dc',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=royal%20flash&openGames=426633950-real&gameNames=Royal%20Flash'
  },
  tuesday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.24.49.jpeg?alt=media&token=e17173aa-7b4a-493e-925b-9c1beb0de92e',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=oly&openGames=5000003-real&gameNames=Gates%20of%20Olympus%E2%84%A2'
  },
  wednesday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.24.57.jpeg?alt=media&token=7d9f7e45-712b-4133-9078-836a33a526b1',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=20%20hot%20bar&provider=PPG&openGames=400041206-real&gameNames=20%20Hot%20Bar'
  },
  thursday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.25.04.jpeg?alt=media&token=5fefb935-8705-411b-973b-87118dba94d9',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=golden%20tr&openGames=420031709-real&gameNames=Golden%20Tree'
  },
  friday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.25.21.jpeg?alt=media&token=eefe483d-1d1a-407a-8c0a-9ad999dd10c2',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=fiery%20&openGames=500009026-real&gameNames=Fiery%20Fruits%20Sixfold'
  },
  saturday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.24.39.jpeg?alt=media&token=6911fec9-2083-4cdd-b83f-2d0a88377ca6',
    web_app: 'https://lksdnfkhew.shop/en/casino/slots?searchTerm=sticky%20piggy&provider=BGO&openGames=426634518-real&gameNames=Super%20Sticky%20Piggy'
  },
  sunday: {
    image: 'https://firebasestorage.googleapis.com/v0/b/excel-dcbec.appspot.com/o/photo_2025-07-19%2017.25.26.jpeg?alt=media&token=d92db503-9abb-4693-9161-b12a32c58829',
    web_app: 'https://www.lksdnfkhew.shop/en/casino/slots?searchTerm=mega%20joker&provider=PPG&openGames=400041556-real&gameNames=Mega%20Joker'
  },
};

// schedule.scheduleJob('0 30 19 * * *', async () => {
//   try {
//     const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
//     const today = weekdays[new Date().getDay()];
//     const todayData = dailyData[today];

//     if (!todayData || !todayData.image) {
//       console.log(`❌ No image configured for today (${today})`);
//       return;
//     }
// const caption = `📣 بازی روز ——- بازی روز 💥

// 🎰  بازی امروز رو از دست نده!   
// 🔥 همین حالا وارد سایت شو و بازی کن  
// 💰 تا بردهای میلیونی رو از دست ندی!   

// 🎁 ماه بت هر روز یه بازی پرطرفدار رو معرفی میکنه  
// 🏆 که در سطح جهانی با بردهای پرشمار همراه بوده  
// ⚡️ تا شما کاربران عزیز هم از این بردهای میلیونی بی‌نصیب نمانید 



// 🎰🔥🎁💰🎰🎁💰🎰🔥🎁💰🎰🎁💰🎰`;


//     const users = await knex('users').select('telegram_id').where('active', 1);

//     for (const user of users) {
//       await rateLimiter.removeTokens(1); // Fixed rate limit handling
//       try {
//       await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
//         chat_id: Number(user.telegram_id),
//         photo: todayData.image,
//         caption,
//         parse_mode: 'Markdown',
//         reply_markup: {
//           inline_keyboard: [[{
//             text: 'کلیک کن و الان بازی کن',
//             web_app: { url: todayData.web_app }
//           }]],
//         },
//       });
//       } catch(err){
//             console.error('❌ Error in scheduler:', err.message);
//       }
//       console.log(`📷 Sent to ${user.telegram_id}`);
//     }

//     console.log(`✅ Done sending to ${users.length} users`);
//   } catch (err) {
//     console.error('❌ Error in scheduler:', err.message);
//   }
// });

// schedule.scheduleJob('0 00 15 * * *', async () => {
//   try {
//     const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
//     const today = weekdays[new Date().getDay()];
//     const todayData = dailyData[today];

//     if (!todayData || !todayData.image) {
//       console.log(`❌ No image configured for today (${today})`);
//       return;
//     }
// const caption = `📣 بازی روز ——- بازی روز 💥

// 🎰  بازی امروز رو از دست نده!   
// 🔥 همین حالا وارد سایت شو و بازی کن  
// 💰 تا بردهای میلیونی رو از دست ندی!   

// 🎁 ماه بت هر روز یه بازی پرطرفدار رو معرفی میکنه  
// 🏆 که در سطح جهانی با بردهای پرشمار همراه بوده  
// ⚡️ تا شما کاربران عزیز هم از این بردهای میلیونی بی‌نصیب نمانید 



// 🎰🔥🎁💰🎰🎁💰🎰🔥🎁💰🎰🎁💰🎰`;
//       try {
//       await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
//         chat_id: '@Mahbet_official',
//         photo: todayData.image,
//         caption,
//         parse_mode: 'Markdown',
//         reply_markup: {
//           inline_keyboard: [[{
//             text: 'کلیک کن و الان بازی کن',
//             url: todayData.web_app,
//           }]],
//         },
//       });
//       } catch(err){
//             console.error('❌ Error in scheduler:', err.message);
//       }
//       console.log(`📷 Sent to ${user.telegram_id}`);
    

//     console.log(`✅ Done sending to ${users.length} users`);
//   } catch (err) {
//     console.error('❌ Error in scheduler:', err.message);
//   }
// });

// schedule.scheduleJob('0 00 21 * * *', async () => {
//   try {
//     const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
//     const today = weekdays[new Date().getDay()];
//     const todayData = dailyData[today];

//     if (!todayData || !todayData.image) {
//       console.log(`❌ No image configured for today (${today})`);
//       return;
//     }
// const caption = `📣 بازی روز ——- بازی روز 💥

// 🎰  بازی امروز رو از دست نده!   
// 🔥 همین حالا وارد سایت شو و بازی کن  
// 💰 تا بردهای میلیونی رو از دست ندی!   

// 🎁 ماه بت هر روز یه بازی پرطرفدار رو معرفی میکنه  
// 🏆 که در سطح جهانی با بردهای پرشمار همراه بوده  
// ⚡️ تا شما کاربران عزیز هم از این بردهای میلیونی بی‌نصیب نمانید 



// 🎰🔥🎁💰🎰🎁💰🎰🔥🎁💰🎰🎁💰🎰`;
//       try {
//       await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
//         chat_id: '@Mahbet_official',
//         photo: todayData.image,
//         caption,
//         parse_mode: 'Markdown',
//         reply_markup: {
//           inline_keyboard: [[{
//             text: 'کلیک کن و الان بازی کن',
//             url: todayData.web_app,
//           }]],
//         },
//       });
//       } catch(err){
//             console.error('❌ Error in scheduler:', err.message);
//       }
//       console.log(`📷 Sent to ${user.telegram_id}`);
    

//     console.log(`✅ Done sending to ${users.length} users`);
//   } catch (err) {
//     console.error('❌ Error in scheduler:', err.message);
//   }
// });
