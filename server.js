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

const bot = new Telegraf(bot_token, {
    proxy: '176.9.95.29',
    polling: true,
});

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

bot.launch();

// express server
const app = express();

app.use(cors())
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

app.post('/login', async (req, res) => {
    try {
        const { action, user_id, telegram_id } = req.body;
        
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

app.listen(port, () => console.log(`Server is running on port ${port}`));

schedule.scheduleJob('0 0 0 * * *', async () =>{
    try {
        const users = await knex('users').select('*').where('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
        const reg = await knex('logs').select('*').where('action', '=', 'registration').andWhere('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
        const login = await knex('logs').select('*').where('action', '=', 'login').andWhere('createdAt', '>=', knex.raw('NOW() - INTERVAL 24 HOUR'));
   
        const newUserJoinedCount = `New users joined bot count - ${users.length} 🎯`
        const newRegCount = `New reg users count - ${reg.length} 🎯`
        const newLoginCount = `New login bot users count - ${login.length} 🎯`

        await bot.telegram.sendMessage(-4036292845, newUserJoinedCount + '\n' + newRegCount + '\n' + newLoginCount)
    } catch (error) {
        console.error('Error retrieving users:', error.message);
      } 
    }
);