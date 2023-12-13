
module.exports = async (ctx) => {
  try {
  await ctx.reply("FAQ", {
    reply_markup: {
        inline_keyboard: [
            [ { text: "چه ورزش هایی در ماه بت پشتیبانی میشه ؟", callback_data: "faqAnswer1" } ],
            [ { text: "شارژ و برداشت ریالی و تومان در ماه بت امکان پذیر هست ؟", callback_data: "faqAnswer2" } ],
            [ { text: "کارت به کارت داره ماه بت ؟", callback_data: "faqAnswer3" } ],
            [ { text: "برای برداشت جایزه باید احراز هویت انجام بدم یعنی مدارک سلفی بفرستم ؟ ", callback_data: "faqAnswer4" } ],
            [ { text: "بونوس های ماه بت چطوریه ؟", callback_data: "faqAnswer5" } ],
            [ { text: "لینک بدون فیلتر ماه از کجا بردارم ؟", callback_data: "faqAnswer6" } ],
            [ { text: "سایت ماه بت قابل اعتماده؟ پولمون رو نخورن ؟", callback_data: "faqAnswer7" } ],
            [ { text: "زیر مجموعه گیری داره ؟ چطور میتونم درآمد زایی کنم ؟", callback_data: "faqAnswer8" } ],
            [ { text: "اپلیکیشن موبایل داره ؟", callback_data: "faqAnswer9" } ],
            [ { text: "برداشت های جایزه چقدر طول میکشه تا واریز بشه ؟", callback_data: "faqAnswer10" } ]
        ]
    }
  });
  return global.FAQSelected = ctx.update.message.message_id;
  } catch(err){
   console.log(err.message)
  }
};
