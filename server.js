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
const { DateTime } = require('luxon');
const { format } = require('date-fns');

const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard } = languages[locale];

const bot = new Telegraf(bot_token);
const client = redis.createClient();
client.connect();

const sub = client.duplicate();
sub.connect();

client.setEx('798788716', 10, '798788716')

// Subscribe to key expiration events
sub.subscribe('__keyevent@0__:expired', async (chatId) => {
  console.log('Key expired:', chatId);
  try {
    await bot.telegram.sendMessage(chatId, `
            هدیه 🎁... هدیه🎁 ... هدیه 🎁.... 

            🤩کاملا مجانی بازی کن هدیه بگیر🤩

            🎲تاس بنداز و کاملا مجانی از ماه بت هدیه بگیر🎲

            همین حالا بر روی دریافت بونوس کلیک کنید و از داخل منو گزینه تاس بندازید و جایزه بگیرید را انتخاب کنید و تاس بندازید و هدیه های نفیس دریافت کنید. 

            نیاز به حتی خرج کردن یک ریال هم نیست،،،،

            همچین جالبیه ماه بت🤣🤣
        `, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "دریافت بونوس",
              callback_data: "starts",
            },
          ],
        ],
      },
    });
    console.log('Message sent successfully');
  } catch (error) {
    console.error('Error sending message:', error);
  }
});

// Enable keyspace notifications if not already enabled
client.sendCommand(['CONFIG', 'SET', 'notify-keyspace-events', 'Ex']);

bot.use(session());

bot.use(userActivityValidation);
bot.use(auth);

bot.start(start);

// hears
bot.hears(suppotButtonKeyboard, (ctx) => ctx.telegram.sendMessage(ctx.message.from.id, '@MB_Support'));
bot.hears(promotionButtonKeyboard, (ctx) => ctx.replyWithHTML(`<a href='https://telegra.ph/%D8%AC%D9%88%D8%A7%DB%8C%D8%B2-12-10'>${promotionButtonKeyboard}</a>`));
bot.hears(FAQButtonKeyboard, FAQ);
bot.hears(helpMeButtonKeyboard, (ctx) => ctx.telegram.sendMessage(ctx.message.from.id, languages[locale]['helpMessage']));

bot.hears('دارت پرتاب کن و جایزه بگیر 🎯', async (ctx) => {

  const isUsed = await client.get(ctx.chat.id + '');
  let latestRecordQuery = await knex('promo_codes').select('codes', 'active', 'created_at').where('telegram_id', ctx.chat.id + '').orderBy('created_at', 'desc').first();

// Format the date as yyyy-MM-dd HH:mm:ss
  if(!latestRecordQuery) {
    latestRecordQuery = {created_at : DateTime.fromISO(DateTime.now()).toFormat('yyyy-MM-dd HH:mm:ss')}
  }
  const inputDateTime = DateTime.fromFormat(DateTime.fromISO(latestRecordQuery.created_at).toFormat('yyyy-MM-dd HH:mm:ss'), 'yyyy-MM-dd HH:mm:ss');
  console.log(inputDateTime, 'testttttt', DateTime.fromISO(latestRecordQuery.created_at).toFormat('yyyy-MM-dd HH:mm:ss'));
  const now = DateTime.now();
  const hoursPassed = now.diff(inputDateTime, 'hours').hours;
  console.log(hoursPassed, 'hoursPassed');

  console.log(isUsed  || !(hoursPassed >= 24), isUsed, hoursPassed, DateTime.fromISO(DateTime.now()).toFormat('yyyy-MM-dd HH:mm:ss'))
  if (isUsed  || !(hoursPassed >= 24)) {
    return ctx.reply(
      `بد شانسی ... حیف شد ... متاسفانه عدد انتخابی شما درست نبود ولی اشکال نداره میتونید 24 ساعت بعد دوباره همینجا شانستو امتحان کنی.`
      ,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: `ورود به سایت 📌`,
            web_app: { url: web_app }
          }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }
    )
  }
  await ctx.reply(`دارت را پرتاب کنید و اگر به هدف برخورد کرد شما برنده شرط رایگان در سایت ماه بت خواهید شد.`)
  const drotic  = await ctx.replyWithDice({ emoji: '🎯' });

  setTimeout(async () => {
    const latestRecordQuery = await knex('promo_codes').select('codes', 'active', 'created_at').where('telegram_id', ctx.chat.id + '').orderBy('created_at', 'desc').first();
    if(latestRecordQuery) {
      latestRecordQuery = {created_at : DateTime.fromISO(DateTime.now()).toFormat('yyyy-MM-dd HH:mm:ss')}
    }
    const inputDateTime = DateTime.fromFormat(DateTime.fromISO(latestRecordQuery.created_at).toFormat('yyyy-MM-dd HH:mm:ss'), 'yyyy-MM-dd HH:mm:ss');
    const now = DateTime.now();
    
    const hoursPassed = now.diff(inputDateTime, 'hours').hours;

    if (drotic.dice.value == 6 && !(hoursPassed >= 24 )) {

      const getPromo = await knex('promo_codes').select('*').where({ active: 0 }).limit(1);
      await knex('promo_codes').where({ codes: getPromo[0].codes, created_at: DateTime.fromISO(DateTime.now()).toFormat('yyyy-MM-dd HH:mm:ss') }).update({ active: 1, telegram_id: ctx.chat.id + '' });
      await ctx.reply(`
تبریک 😎... تبریک😎 ... شما برنده 10 هزار تومان شرط رایگان شده اید. 
            اگر در سایت ماه بت ثبت نام کرده اید لطفا" وارد سایت شوید و شناسه کاربری خود را ارسال کنید و اگر هنوز ثبت نام نکرده اید لطفا از طریق گزینه زیر ثبت نام کنید و دوباره برگردید همینجا و شناسه کاربری خود را ارسال کنید تا جایزه شما فعال شود.
          ${getPromo[0].codes}
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
      await ctx.reply(`
بد شانسی ☹️ حیف شد 😏 متاسفانه پرتاب شما به هدف برخورد نکرد 😎😎 ولی اشکال نداره میتونی دوباره بعد از 24 ساعت شانستو امتحان کنی.
⚠️فقط دقت کنید از لحظه ای که شانستو امتحان میکنی از اون لحظه تا 24 ساعت بعد باید صبر کنی بعد دوباره میتونی شانستو امتحان کنی و دوباره دارت پرتاب کنی یعنی هر 24 ساعت فقط یک بار میتونی دارت پرتاب کنی و جایزه بگیری🔥🔥🔥🔥`, {
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
    }
  }, 3000)
})

bot.action('starts', start);

bot.action('نحوه فعال سازی کد هدیه', (ctx) => {
  return ctx.reply(`نحوه استفاده و فعال سازی کد هدیه


    اگر قبلا ثبت نام کرده اید : 
    1- وارد حساب کاربری خود شوید و بر روی گزینه آدمک در بالای صفحه کلیک کنید
    2- در انتهای صفحه در کادر مخصوص کد تبلیغاتی ، کد هدیه خود را وارد کنید و گزینه اعمال کردن را بزنید.
    3- پیام موفقیت را دریافت میکنید.
    4- سپس اگر وارد قسمت بونوس ها و قسمت بونوس ورزشی شوید میتوانید بونوسی که فعال کردید را مشاهده نمایید و شرایط استفاده از بونوس را مطالعه کنید.
    5- حالا وارد قسمت مسابقات یورو 2024 شوید
    6- بازی مورد نظر خود را انتخاب کنید دقت داشته باشید که تمام شرایط بونوس را رعایت نمایید ( ضریب حداقل 1.8 ، فقط مسابقات یورو 2024 ، میکس و تکی )
    7- شرط خود را ثبت کنید وگزینه ای دریافت میکنید که از شما سوال میکند که آیا میخواهید از بونوس شرط رایگان استفاده کنید یا خیر و شما با تایید این گزینه میتوانید با استفاده از شرط رایگان داده شده ثبت شرط نمایید.
    
    اگر هنوز ثبت نام نکرده اید : 
    1- روی دکمه ورود به سایت کلیک کنید
    2- در سایت ثبت نام کنید در فرم اولیه ثبت نام در انتهای فرم در قسمت کد تبلیغاتی ، کد هدیه خود را وارد کنید و ثبت نام را تکمیل کنید.
    3-- سپس بر روی گزینه آدمک بالای صفحه کلیک کنید و وارد قسمت بونوس ها شوید
    4-  سپس اگر وارد قسمت بونوس ها و قسمت بونوس ورزشی شوید میتوانید بونوسی که فعال کردید را مشاهده نمایید و شرایط استفاده از بونوس را مطالعه کنید.
    5- حالا وارد قسمت مسابقات یورو 2024 شوید
    6- بازی مورد نظر خود را انتخاب کنید دقت داشته باشید که تمام شرایط بونوس را رعایت نمایید ( ضریب حداقل 1.8 ، فقط مسابقات یورو 2024 ، میکس و تکی )
    7- شرط خود را ثبت کنید وگزینه ای دریافت میکنید که از شما سوال میکند که آیا میخواهید از بونوس شرط رایگان استفاده کنید یا خیر و شما با تایید این گزینه میتوانید با استفاده از شرط رایگان داده شده ثبت شرط نمایید.
    
    در صورت وجود هر گونه سوال یا نیاز به راهنمایی لطفا به پشتیبانی زنده سایت مراجعه نمایید.`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: `ورود به سایت 📌`,
          web_app: { url: web_app }
        }],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    })
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

// bot.action(['1', '2', '3', '4', '5', '6'], async (ctx) => {
//   await client.setEx(ctx.chat.id + '', 86400, ctx.chat.id + '');
//   // await ctx.telegram.answerCbQuery(ctx.update.callback_query.id, `عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته`, true)
//   // await ctx.telegram.deleteMessage(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id);
//   // await ctx.reply(`عدد انتخابی شما ${ctx.update.callback_query.data} می باشد ... ببینیم چه عددی میوفته ⏳⏳⏳`)
//   // const dice = await ctx.sendDice()

// });

bot.launch();

// express server
const app = express();

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/login', async (req, res) => {
  try {
    const { action, user_id, telegram_id } = req.body;
    await bot.telegram.sendMessage(798788716, telegram_id + '-' + user_id)

    // if(!user_id || !telegram_id || !action) {
    //     return res.status(500).send('Something went wrong!');
    //  }

    await knex('logs').insert({
      action,
      telegram_id,
      mahbet_id: user_id
    })
    res.status(200).send(true)
  } catch (err) {
    console.log(err);
    res.status(500).send('Something went wrong!');
  }
});

app.post('/registration', async (req, res) => {
  try {
    const { action, user_id, telegram_id } = req.body;
    await bot.telegram.sendMessage(798788716, telegram_id + user_id)

    // if(!user_id || !telegram_id || !action) {
    //    return res.status(500).send('Something went wrong!');
    // }

    await knex('logs').insert({
      action,
      telegram_id,
      mahbet_id: user_id
    })
    res.status(200).send(true)
  } catch (err) {
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
  } catch (err) {
    console.log(err, 'fraud');
    res.status(500).send('Something went wrong!,');
  }
});

app.listen(port, () => console.log(`Server is running on port ${port}`));

schedule.scheduleJob('0 0 0 * * *', async () => {
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