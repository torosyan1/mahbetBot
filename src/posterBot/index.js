const { Telegraf } = require('telegraf');

const POSTER_BOT_TOKEN = process.env.POSTER_BOT_TOKEN;
const CHANNEL_USERNAME = '@Mahbet_official';

function startPosterBot() {
  const bot = new Telegraf(POSTER_BOT_TOKEN);

  bot.on('photo', async (ctx) => {
    const caption = ctx.message.caption || '';
    const photoArray = ctx.message.photo;
    const fileId = photoArray[photoArray.length - 1].file_id;

    try {
      await ctx.telegram.sendPhoto(CHANNEL_USERNAME, fileId, {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "ورود به سایت 📌", url: "https://fsgfhshrb.shop/" }
            ],
            [
              { text: "اینستاگرام", url: "https://www.instagram.com/mahbet_official/?hl=en" },
              { text: "پشتیبانی", url: "https://direct.lc.chat/14697702/" }
            ],
            [
              { text: "ربات کازینوی تلگرامی", url: "https://t.me/MahBetBot" },
              { text: "اپلیکیشن ماه بت 📲", url: "https://files.igmobile.io/storage/v1/object/public/Shared/MahBv1.0.2.apk" }
            ]
          ]
        }
      });

      console.log('✅ Photo + text forwarded to channel');
    } catch (error) {
      console.error('❌ Error forwarding message:', error.message);
    }
  });

  bot.launch();
  console.log('🚀 Poster bot is running...');
}

module.exports = { startPosterBot };
