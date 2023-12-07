require('dotenv').config()

const { bot_token, locale, port } = require('./src/utils/env');
const { Telegraf, session } = require("telegraf");
const languages = require("./src/utils/language"); 
const { auth } = require("./src/middleware/auth");
const start = require("./src/commands/start");
const express = require('express');
const knex = require('./src/connections/db');


const { suppotButtonKeyboard, promotionButtonKeyboard, topGamesButtonKeyboard, helpMeButtonKeyboard } = languages[locale];

const bot = new Telegraf(bot_token, {
    proxy: '176.9.95.29',
    polling: true,
});

bot.use(session());

bot.use(auth);

bot.start(start);

bot.hears(suppotButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));
bot.hears(promotionButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));
bot.hears(topGamesButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));
bot.hears(helpMeButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, 'https://telegra.ph/Privet-12-03-44'));

bot.launch();

// express server
const app = express();

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

app.post('/login', async (req, res) => {
    try {
        if(!user_id || !telegram_id || !action) {
            return res.status(500).send('Something went wrong!');
         }
         
        const { action, user_id, telegram_id } = req.body;
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
