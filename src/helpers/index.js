const inlineButton = async ( ctx, userID, messages, keyboard ) => {
    try {
        const data = await ctx.telegram.sendMessage(userID, messages, {
            reply_markup: {
                inline_keyboard: keyboard,
            },
            parse_mode: 'Markdown',
        });
        return data;
    } catch (err) {
        console.log(`user ID => ${userID}`, err);
    }
};

module.exports = {
    inlineButton
}