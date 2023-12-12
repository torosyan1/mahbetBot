require('dotenv').config()

const { bot_token, locale, port } = require('./src/utils/env');
const { Telegraf, session } = require("telegraf");
const languages = require("./src/utils/language"); 
const { auth } = require("./src/middleware/auth");
const start = require("./src/commands/start");
const express = require('express');
const cors = require('cors')
const knex = require('./src/connections/db');
const { userActivityValidation } = require('./src/middleware/usersActivityValidation');


const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard } = languages[locale];

const bot = new Telegraf(bot_token, {
    proxy: '176.9.95.29',
    polling: true,
});

bot.use(session());

bot.use(userActivityValidation);
bot.use(auth);
bot.start(start);

bot.hears(suppotButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, '@MB_Support'));
bot.hears(promotionButtonKeyboard,(ctx)=>ctx.replyWithHTML(`<a href='https://telegra.ph/%D8%AC%D9%88%D8%A7%DB%8C%D8%B2-12-10'>${promotionButtonKeyboard}</a>`));
bot.hears(FAQButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));
bot.hears(helpMeButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));

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

app.listen(port, () => console.log(`Server is running on port ${port}`));
