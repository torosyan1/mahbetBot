require('dotenv').config()

const { Telegraf, session } = require("telegraf");
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
const jsonUsers = require('./user.json'); // adjust path as needed

const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard, vpn } = languages[locale];



const axios = require('axios');
const { RateLimiter } = require("limiter");
const initializeRedis = require('./src/connections/redis');
const { startPosterBot } = require('./src/posterBot');

(async () => {

const bot = new Telegraf(bot_token);

bot.use(session());

bot.use(userActivityValidation);
bot.use(auth);

bot.start(start);

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
    const dbCount  = await knex('users').where('active', 1).count('id as c').first();
    const jsonCount = (jsonUsers.users || []).filter(u => u.active === 1 && u.telegram_id).length;
    res.json({ total: (dbCount?.c || 0) + jsonCount });
  } catch (err) {
    res.json({ total: 0 });
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
    const endpoint = `https://api.telegram.org/bot${bot_token}/send${type[0].toUpperCase() + type.slice(1)}`;
    await axios.post(endpoint, {
      chat_id,
      [type]: photo || video,
      caption,
      reply_markup: buildReplyMarkup(buttons)
    });
    return true;
  } catch (err) {
    console.error(`❌ chat_id ${chat_id}: ${err.message}`);
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

    // Build deduplicated user list
    const dbUsers  = await knex('users').select('telegram_id').where('active', 1);
    const allUsers = [...dbUsers, ...(jsonUsers.users || [])];
    const ids = [
      ...new Map(
        allUsers.filter(u => u.telegram_id).map(u => [String(u.telegram_id), u.telegram_id])
      ).values()
    ];

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const job   = { total: ids.length, sent: 0, failed: 0, done: false, clients: [] };
    broadcastJobs.set(jobId, job);

    // Respond immediately so the client can open the SSE stream
    res.json({ jobId, total: ids.length });

    // Broadcast in background
    (async () => {
      for (let i = 0; i < ids.length; i++) {
        await rateLimiter.removeTokens(1);
        const ok = await sendTelegramMedia(ids[i], photo, video, caption, buttons);
        if (ok) job.sent++; else job.failed++;

        const payload = JSON.stringify({ sent: job.sent, failed: job.failed, total: job.total, done: false });
        job.clients.forEach(c => c.write(`data: ${payload}\n\n`));
      }

      job.done = true;
      const done = JSON.stringify({ sent: job.sent, failed: job.failed, total: job.total, done: true });
      job.clients.forEach(c => { c.write(`data: ${done}\n\n`); c.end(); });
      console.log(`✅ Broadcast ${jobId} done — sent:${job.sent} failed:${job.failed}`);

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
