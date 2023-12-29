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
const { HttpsProxyAgent } = require('https-proxy-agent');

const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard } = languages[locale];
// const socksAgent = new SocksAgent({
//     socksHost: '185.155.233.31',
//     socksPort: '50100',
//     socksUsername: 'mahbet846',
//     socksPassword: 'i5em7aKvrm',
//   });
  // proxy: new HttpsProxyAgent('mahbet846:i5em7aKvrm@185.155.233.31:50100'),
  // 'https':'socks5://mahbet846:i5em7aKvrm@185.155.233.31:50100'
  const proxyConfig = {
    telegram: {
      agent: new HttpsProxyAgent('socks5://mahbet846:i5em7aKvrm@185.155.233.31:50100')
    }
  }
  
const bot = new Telegraf(bot_token);

bot.use(session());

bot.use(userActivityValidation);
bot.use(auth);

bot.start(start);

// hears
bot.hears(suppotButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, '@MB_Support'));
bot.hears(promotionButtonKeyboard,(ctx)=>ctx.replyWithHTML(`<a href='https://telegra.ph/%D8%AC%D9%88%D8%A7%DB%8C%D8%B2-12-10'>${promotionButtonKeyboard}</a>`));
bot.hears(FAQButtonKeyboard, FAQ);
bot.hears(helpMeButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, languages[locale]['helpMessage']));

bot.hears('Lucky Giveaway 🎲',async (ctx)=>{
    await ctx.replyWithPhoto('https://gdelectricals.com/giveaway.png', {
        caption: 'Please Select the dice value 🎁 🎁 🎁',
        reply_markup: {
          inline_keyboard: [[{
              text: '1',
              callback_data: '1'
          },
          {
            text: '2',
            callback_data: '2'
          },
          {
            text: '3',
            callback_data: '3'
          },
    ],
    [{
        text: '4',
        callback_data: '4'
    },
    {
      text: '5',
      callback_data: '5'
    },
    {
      text: '6',
      callback_data: '6'
    },
]],
          one_time_keyboard: true,
          resize_keyboard: true,
      },
      });

})
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

bot.action('1', async (ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour. Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});
bot.action('2', async(ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour. Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});
bot.action('3', async(ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour. Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});
bot.action('4', async(ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour. Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});
bot.action('5', async(ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour. Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});
bot.action('6', async(ctx)=>{
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `You are selected ${ctx.update.callback_query.data}`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`You are selected ${ctx.update.callback_query.data} waiting the result ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Congratulation you are win ${ctx.update.callback_query.data} X 10 free spin 😱😱😱\n\n Your free spin will be available in about 1 hour.\n\nTry your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.replyWithPhoto('https://thumbs.dreamstime.com/z/play-to-win-28253622.jpg?w=768', {
                caption: `Ooooo No, you are selected ${ctx.update.callback_query.data} 😞😞😞😞, but result is ${dice.dice.value}\n\n Try your luck on the next spin at the Mahbet site! 🎰🎰🎰`,
                reply_markup: {
                  inline_keyboard: [[{
                    text: `Open Mahbet site!`,
                    web_app: { url: web_app }
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });       
        }
    },4000)
});

bot.on('message',async (ctx)=>{
    console.log(ctx.update)
})

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
        const { ip, device, device_input, telegram_id } = req.body;
        // if( !ip || !device || !device_input || !telegram_id) {
        //    return res.status(500).send('Something went wrong!');
        // }
        const data = geoip.lookup(ip);
        // const data = await iplocate(ip)

        await knex('fraud').insert({
            ip,
            city: data.timezone,
            country: data.country,
            device,
            device_input,
            telegram_id,
        })
        res.status(200).send(true)
    } catch(err){
        console.log(err, 'fraud');
        res.status(500).send('Something went wrong!,');
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