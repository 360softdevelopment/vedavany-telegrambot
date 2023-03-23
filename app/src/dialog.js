const { COMMANDS, REACTIONS, INSTRUCTIONS, menuKeyboard, commandsText, reactionsText, prompts } = require('./const/const.js');
const { chatgptConversation } = require('./api/chatgpt.js');

const { getCurrentDateFormatted, splitText } = require('./helper');


const markdownRegex = /(^|[^*_`])(?:\\*\\*|__|\\*|_)(.+?)(?:\\*\\*|__|\\*|_)([^*_`]|$)|(```)([\\s\\S]+?)(```)/gm;


async function makeDialog(ctx) {
    //console.log(ctx.session);
    const message = ctx.message.text;
    const chatId = ctx.message.chat.id;
    const messageId = ctx.message.message_id;

    const userId = ctx.message.from.id;

    const dialogId = ctx.session.dialogId;
    var toMessageId = messageId;

    var dialog = ctx.session.dialog;
    var feedback = ctx.session.feedback;
    var messages = ctx.session.messages;

    /*
    if (ctx.chat.type === 'private') {} else {

    }
    */



    console.log('📩 Incoming message:', message);
    if (typeof ctx.message.reply_to_message !== 'undefined') {

        toMessageId = ctx.message.reply_to_message.message_id;
        console.log("on reply toMessageId=", toMessageId);
        dialog = ctx.session.dialogs[toMessageId];
    }

    // Send the "typing" action to the chat
    //newMessage = await ctx.reply('...');
    newMessage = await ctx.replyWithMarkdown('⌛...');
    const message_id = newMessage.message_id;
    const chat_id = newMessage.chat.id;
    //newMessage = await ctx.reply('...',{ reply_markup:  {  parse_mode: "MarkdownV2", inline_keyboard: [reactionsKeyboard]  }});

    const reactionsKeyboard = Object.keys(REACTIONS).map(command => ({
        text: REACTIONS[command].emoji,
        callback_data: `reaction:${command}:${toMessageId}`
    }));


    //await ctx.replyWithChatAction('typing');



    console.log('🤖 Dialog:', dialog);
    var textBefore = "";
    // Call the chatGPT API to generate a response
    var response = await chatgptConversation(ctx, chat_id, message_id, message, dialog, async (ctx, chatId, messageId) => {
        const message_id1 = message_id;
        await ctx.telegram.editMessageText(chatId, messageId, null, "✍️...", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [reactionsKeyboard] } });
    },
        async (ctx, chatId, messageId, text) => {
            const message_id1 = message_id;
            //TODO: Добавить Поддержка длинных 4096+ симсолов ответов 
            var myText = (text + "\n✍️...");
            myText = await myText.substring(0, 4095); //Не правильно, заглушка!
            //console.log(myText);

            try {
                if (textBefore != myText) {
                    //TODO:сделать по правильному, через async
                    //await


                    if (markdownRegex.test(myText)) {
                        await ctx.telegram.editMessageText(chatId, messageId, null, myText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [reactionsKeyboard] } });
                        textBefore = myText;
                    }
                    else {
                        await ctx.telegram.editMessageText(chatId, messageId, null, myText, { reply_markup: { inline_keyboard: [reactionsKeyboard] } });
                        textBefore = myText;
                    }
                }
            } catch (error) {
                console.log("Oops. Modify error.", error);
            }

        }, async (ctx) => {
            try {
                await ctx.replyWithChatAction('typing');
            } catch (error) {
                console.log("Oops. Typing error.", error);
            }
        });


    response = await response.substring(0, 4095); //Не правильно, заглушка!
    //if (textBefore != textBefore) {
    //console.log('🤖 was:', myText);
    console.log('🤖 Response:', response);


    if (markdownRegex.test(response))
        await ctx.telegram.editMessageText(chat_id, message_id, null, response, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [reactionsKeyboard] } });
    else
        await ctx.telegram.editMessageText(chat_id, message_id, null, response, { reply_markup: { inline_keyboard: [reactionsKeyboard] } });
    //}

    await ctx.replyWithChatAction('cancel')


    var q = { "role": "user", "content": message };
    var a = { "role": "assistant", "content": response };

    var qa = [q, a];

    //dialog = dialog.concat(qa);
    dialog = dialog.concat([q]);
    var dialogHalf = dialog;
    dialog = dialog.concat([a]);

    console.log('🤖 dialog:', dialog);


    var responseMessageId = newMessage.message_id;


    //TODO:Поддержка длинных 4096+ симсолов ответов (в telegram ограничение на длину сообщение 4096 символов, chatGpt вылает больше, 4096 токенов, это под 7-8тысяч символов)
    /* старая версия работающая до ответов в realtime
    responseArray=splitText(response);
    //await newMessage.edit_text(responseArray[0]);
    ctx.telegram.editMessageText(newMessage.chat.id, newMessage.message_id, null, responseArray[0],{reply_markup:  {  parse_mode: "MakrdownV2", inline_keyboard: [reactionsKeyboard] }});
    
    
    // Send the response back to the user
    
    
    ctx.replyWithChatAction('cancel');
    responseArray.forEach(async (text, index) => {
        var messageResponse=await ctx.reply(text, { reply_markup: index === responseArray.length - 1 ? {  parse_mode: "MakrdownV2", inline_keyboard: [reactionsKeyboard]  } : undefined });
        //console.log(messageResponse);
    
        responseMessageId=messageResponse.message_id;
        ctx.session.responses2[responseMessageId]=toMessageId;
        ctx.session.dialogs[responseMessageId] = dialog;
        ctx.session.responseMessageId = responseMessageId;
    
    });
    //var feedback=await ctx.reply(" ", { reply_markup: { parse_mode: "MakrdownV2", inline_keyboard: [reactionsKeyboard] } });
    //var feedback=await ctx.replyWithMarkdownV2(" ", { reply_markup: { inline_keyboard: [reactionsKeyboard] } })
    */



    ctx.session.dialog = dialog;
    ctx.session.lastMessageId = toMessageId;
    ctx.session.responseMessageId = responseMessageId;
    ctx.session.dialogs[toMessageId] = dialogHalf;
    ctx.session.dialogs[responseMessageId] = dialog;
    ctx.session.responses[toMessageId] = responseMessageId;

}


module.exports = {
    makeDialog
};