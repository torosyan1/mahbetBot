require('dotenv').config()

const { bot_token, locale } = require('./src/utils/env');
const { Telegraf, session } = require("telegraf");
const languages = require("./src/utils/language"); 
const { auth } = require("./src/middleware/auth");
const start = require("./src/commands/start");

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

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
