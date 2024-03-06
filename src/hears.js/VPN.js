const { default: axios } = require("axios");
const knex = require('../connections/db');

module.exports = async (ctx) => {
    try {
    
    const result = await knex('users').select('vpn').where({ telegram_id: ctx.chat.id });
      await axios.post(`http://51.20.225.234:8888/create-new-vpn-clinet`, { telegram_id: ctx.chat.id })
    } catch(err){
     console.log(err.message)
    }
  };
  