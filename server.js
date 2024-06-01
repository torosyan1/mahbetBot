require('dotenv').config()

const { Telegraf, session } = require("telegraf");
// const iplocate = require("node-iplocate");
const geoip = require('geoip-lite');
const schedule = require('node-schedule');
const express = require('express');
const cors = require('cors')
const redis = require('redis');

const { userActivityValidation } = require('./src/middleware/usersActivityValidation');
const { bot_token, locale, port, welcome_image_url, web_app } = require('./src/utils/env');
const FAQAnswers = require('./src/actions.js/FAQAnswers');
const { auth } = require("./src/middleware/auth");
const languages = require("./src/utils/language"); 
const start = require("./src/commands/start");
const knex = require('./src/connections/db');
const FAQ = require('./src/hears.js/FAQ');

const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard } = languages[locale];

const bot = new Telegraf(bot_token);
const client = redis.createClient();
client.connect();

bot.use(session());

bot.use(userActivityValidation);
bot.use(auth);

bot.start(start);

// hears
bot.hears(suppotButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, '@MB_Support'));
bot.hears(promotionButtonKeyboard,(ctx)=>ctx.replyWithHTML(`<a href='https://telegra.ph/%D8%AC%D9%88%D8%A7%DB%8C%D8%B2-12-10'>${promotionButtonKeyboard}</a>`));
bot.hears(FAQButtonKeyboard, FAQ);
bot.hears(helpMeButtonKeyboard,(ctx)=>ctx.telegram.sendMessage(ctx.message.from.id, languages[locale]['helpMessage']));

bot.hears('تاس بنداز جایزه بگیر 🎲',async (ctx)=>{
    const isUsed = await client.get(ctx.chat.id + '');
    console.log(ctx.chat.id, isUsed)
    if(isUsed) {
         return ctx.reply(`بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی.`)
    }

    await ctx.reply('عدد شانس خود را انتخاب کنید و تاس بریزید. 🎁 🎁 🎁', {
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

bot.action('starts', start);

bot.action('نحوه فعال سازی کد هدیه', (ctx)=>{
    return ctx.reply(
    `نحوه استفاده و فعال سازی کد هدیه


    اگر قبلا ثبت نام کرده اید : 
    1- وارد حساب کاربری خود شوید و بر روی گزینه آدمک در بالای صفحه کلیک کنید
    2- در انتهای صفحه در کادر مخصوص کد تبلیغاتی ، کد هدیه خود را وارد کنید و گزینه اعمال کردن را بزنید.
    3- پیام موفقیت را دریافت میکنید.
    4- سپس وارد قسمت بونوس ها شوید
    5- وارد قسمت چرخش های رایگان کازینو شوید
    6- بونوس مورد نظر را با فشردن گزینه دریافت بونوس فعال کنید
    7- وارد بازی مورد نظر شوید و لذت ببرید.
    
    اگر هنوز ثبت نام نکرده اید : 
    1- روی دکمه ورود به سایت کلیک کنید
    2- در سایت ثبت نام کنید در فرم اولیه ثبت نام در انتهای فرم در قسمت کد تبلیغاتی ، کد هدیه خود را وارد کنید و ثبت نام را تکمیل کنید.
    3-- سپس بر روی گزینه آدمک بالای صفحه کلیک کنید و وارد قسمت بونوس ها شوید
    4- وارد قسمت چرخش های رایگان کازینو شوید
    5- بونوس مورد نظر را با فشردن گزینه دریافت بونوس فعال کنید
    6- وارد بازی مورد نظر شوید و لذت ببرید.
    
    در صورت وجود هر گونه سوال یا نیاز به راهنمایی لطفا به پشتیبانی زنده سایت مراجعه نمایید.`)
});

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
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {

            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.

کد هدیه شما : ${getPromo[0].codes }
            `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]
                ],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply(`بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  
                ],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
              await bot.telegram.sendMessage(-4036292845, 'telegram_userId-' + '\n' + ctx.chat.id + '\n' + 'promocode')
        }
    },4000)
});
bot.action('2', async(ctx)=>{
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            
            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
            تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.
            
            کد هدیه شما : ${getPromo[0].codes }
                        `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply( `بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
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
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            
            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
            تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.
            
            کد هدیه شما : ${getPromo[0].codes }
                        `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply(`بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
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
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            
            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
            تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.
            
            کد هدیه شما : ${getPromo[0].codes }
                        `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply( `بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
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
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            
            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
            تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.
            
            کد هدیه شما : ${getPromo[0].codes }
                        `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply(`بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
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
    await client.setEx(ctx.chat.id + '', 86400 , ctx.chat.id + '');
    await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
    await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
    await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
    const dice = await ctx.sendDice()
    console.log(ctx.update.callback_query.data, dice.dice.value)
    setTimeout(async ()=>{
        if(ctx.update.callback_query.data == dice.dice.value) {
            
            const getPromo = await knex('promo_codes').select('*').where({active: 0}).limit(1);
            console.log(getPromo)
            await knex('promo_codes').where({ codes: getPromo[0].codes}).update({ active: 1, telegram_id: ctx.chat.id + '' });     
            await ctx.reply(`
            تبریک ... تبریک ... شما برنده 10 چرخش رایگان کازینو اسلات شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و کد هدیه ارسال شده زیر این پیام را در حساب کاربری خود وارد کنید و جایزه خود را فعال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و در موقع ثبت نام کد هدیه ارسال شده در زیر این پیام را در کادر مخصوص کد هدیه در فرم ثبت نام وارد کنید تا جایزه شما فعال شود.
            
            کد هدیه شما : ${getPromo[0].codes }
                        `, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
                    web_app: { url: web_app }
                  }],
                  [{
                    text: `نحوه فعال سازی کد هدیه`,
                    callback_data: `نحوه فعال سازی کد هدیه`
                  }]],
                  one_time_keyboard: true,
                  resize_keyboard: true,
              },
              });
        } else {
            await ctx.reply( `بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی. 🥲`, {
                reply_markup: {
                  inline_keyboard: [[{
                    text: `ورود به سایت 📌`,
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
        // const data = geoip.lookup(ip);
        // const data = await iplocate(ip)

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