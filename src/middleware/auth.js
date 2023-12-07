const knex = require('../connections/db');

const auth = async (ctx, next) =>{
    try {
        if(ctx.session === undefined ){
            const result = await knex('users').select('telegram_id').where({ telegram_id: ctx.update.message.from.id });
            if(!result.length) {
                await knex('users').insert({ telegram_id: ctx.update.message.from.id })
            }
           ctx.session = { userId: ctx.update.message.from.id };
        } else {
            console.log(ctx.session)
        }
      next()
    } catch(err){
        console.log('Auth middlware  ==>', err.message)
    }
}

module.exports = {
    auth
};