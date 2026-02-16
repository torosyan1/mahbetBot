require('dotenv').config()

const { Telegraf, session } = require("telegraf");
// const iplocate = require("node-iplocate");
const geoip = require('geoip-lite');
const schedule = require('node-schedule');
const express = require('express');
const cors = require('cors')

const { userActivityValidation } = require('./src/middleware/usersActivityValidation');
const { bot_token, locale, port, welcome_image_url, web_app } = require('./src/utils/env');
const FAQAnswers = require('./src/actions.js/FAQAnswers');
const { auth } = require("./src/middleware/auth");
const languages = require("./src/utils/language"); 
const start = require("./src/commands/start");
const knex = require('./src/connections/db');
const FAQ = require('./src/hears.js/FAQ');
const VPN = require('./src/hears.js/VPN');

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
bot.use(async (ctx, next) => {
  try {
    const message = ctx.message;

    if (message && message.entities) {
      message.entities.forEach(async (entity) => {
        if (entity.type === 'custom_emoji') {
          const emojiId = entity.custom_emoji_id;

          console.log("🎯 Custom Emoji ID:", emojiId);

          // OPTIONAL: Save to database
          await knex('emoji_logs').insert({
            telegram_id: ctx.from.id,
            custom_emoji_id: emojiId,
            created_at: knex.fn.now()
          });

        }
      });
    }

    await next();
  } catch (err) {
    console.error("Custom Emoji Logger Error:", err.message);
  }
});

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

async function sendTelegramMedia(chat_id, photo, video, caption, i) {
  try {
    const type = photo ? "photo" : video ? "video" : null;
    if (!type) throw new Error("Missing 'photo' or 'video' field.");

    const apiEndpoint = `https://api.telegram.org/bot${bot_token}/send${type.charAt(0).toUpperCase() + type.slice(1)}`;

    await axios.post(apiEndpoint, {
      chat_id,
      [type]: photo || video,
      caption,
      reply_markup: {
        inline_keyboard: [
          [{ text: "ازتباط با پشتیبانی آنلاین  ماه بت", url: "https://direct.lc.chat/14697702" }],
          [{ text: "کانال تلگرامی ماه بت", url: "https://t.me/Mahbet_official" }],
          [{ text: "دانلود اپلیکیشن ماه بت", url: "https://files.igmobile.io/storage/v1/object/public/Shared/MahBv1.0.2.apk" }],
          [{ text: "ورود به سایت 📌", web_app: { url: "https://torosyan1.github.io/mahbet_html_en" } }]
        ]
      }
    });

    console.log(`✅ Sent ${type} to chat_id ${chat_id}`, i);
  } catch (error) {
    console.error(`❌ Error for chat_id ${chat_id}:`, error.message);
  }
}
const rateLimiter = new RateLimiter({ tokensPerInterval: 25, interval: 'second' });

app.post("/trigger", async (req, res) => {
  try {
    const { photo, video, caption } = req.body;

    if ((!photo && !video) || !caption) {
      return res.status(400).json({ error: "Request body must contain photo or video and caption" });
    }

    const users = await knex('users').select('telegram_id').where('active', 1);
    let i = 1;

    for (const user of users) {
      const chat_id = user.telegram_id;
      if (!chat_id) continue;

      await rateLimiter.removeTokens(1);
      await sendTelegramMedia(chat_id, photo, video, caption, i++);
    }

    res.send("✅ Trigger complete. Messages sent.");
  } catch (err) {
    console.error("❌ Error in /trigger:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
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
