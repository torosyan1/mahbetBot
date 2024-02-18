const knex = require('../connections/db');

const auth = async (ctx, next) =>{
    try {
        // if(ctx.session === undefined && ctx.update.message){
        //     const result = await knex('users').select('telegram_id').where({ telegram_id: ctx.update.message.from.id });
        //     if(!result.length) {
        //         await knex('users').insert({ 
        //             telegram_id: ctx.update.message.from.id,
        //             username: ctx.update.message.from.username || '',
        //             first_name: ctx.update.message.from.first_name,
        //             last_name: ctx.update.message.from.last_name,
        //             active: 1
        //         })
        //     }
        //     ctx.session = { userId: ctx.update.message.from.id };
        // }

        next()
    } catch(err){
        console.log(err)
        console.log('Auth middlware  ==>', err.message)
    }
}

module.exports = {
    auth
};