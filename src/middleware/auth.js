const knex = require('../connections/db');

const auth = async (ctx, next) =>{
    try {
        if(ctx.session === undefined && ctx.from){
            const result = await knex('users').select('telegram_id').where({ telegram_id: ctx.from.id });
            if(!result.length) {
                await knex('users').insert({
                    telegram_id: ctx.from.id,
                    username: ctx.from.username || '',
                    first_name: ctx.from.first_name,
                    last_name: ctx.from.last_name,
                    active: 1
                })
            }
            ctx.session = { userId: ctx.from.id };
        }

        next()
    } catch(err){
        console.log(err)
        console.log('Auth middlware  ==>', err.message)
    }
}

module.exports = {
    auth
};