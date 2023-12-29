const knex = require('../connections/db');

const userActivityValidation = async (ctx, next) =>{
    // try {
    //     if(ctx.update?.my_chat_member?.new_chat_member?.status === 'kicked'){
    //         await knex('users').update({ active: 0 }).where({ telegram_id: ctx.update.my_chat_member.chat.id });
    //         return ;
    //     } else if(ctx.update?.my_chat_member?.new_chat_member?.status === 'member') {
    //         await knex('users').update({ active: 1 }).where({ telegram_id: ctx.update.my_chat_member.chat.id });
    //     }
    //     next()
    // } catch(err){
    //     console.log('userActivityValidation middlware  ==>', err.message)
        next();
    // }
}

module.exports = {
    userActivityValidation
};