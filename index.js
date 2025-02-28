import {Client, GatewayIntentBits} from 'discord.js';
import dotenv from 'dotenv';
import {extractDataFromFile, extractDataFromPath} from "./function/fileHandle.js";
import {clearChannel, fetchLastMessage, getThreadByName,} from "./function/storeHandle.js";

dotenv.config();

export const DATABASE_CHANNEL = 'recipe-database';
export const SMALL_INFO_THREAD = 'small-info-thread';
export const DETAIL_INFO_THREAD = 'detail-info-thread';
export const PICTURES_THREAD = 'pictures-thread';
export const NUTRITION_THREAD = 'nutrition-thread';
export const REQUEST_THREAD = 'request-thread';
export const TIME_PER_STEP = 5;

const splitMessage = message => {
    console.log(message);  // Should print "string"
    return message.split(' ');
}

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

export let guild;
export let channel;
export let smallThread;
export let detailsThread;
export let picturesThread;
export let nutritionThread;
export let requestThread;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    guild = client.guilds.cache.get(process.env.GUILD_ID);
    channel = guild.channels.cache.find(c => c.name === DATABASE_CHANNEL);
    smallThread = await getThreadByName(SMALL_INFO_THREAD);
    detailsThread = await getThreadByName(DETAIL_INFO_THREAD);
    picturesThread = await getThreadByName(PICTURES_THREAD);
    nutritionThread = await getThreadByName(NUTRITION_THREAD);
    requestThread = await getThreadByName(REQUEST_THREAD);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // if (message.content.startsWith('TEST')) {
    // }

    if (message.content.startsWith('CLEAR_CHANNEL')) {
        await clearChannel()
    }

    if (message.content.startsWith('GET_LAST_DISH')) {
        const arr = splitMessage(message.content);
        const command = arr[1];
        if (!command) {
            channel.send('😒 Where should i find this message!.');
            return;
        }
        switch (command) {
            case SMALL_INFO_THREAD:
                const lastSmallMess = await fetchLastMessage(smallThread);
                if (!lastSmallMess) {
                    channel.send('😬 No message found')
                    return;
                }
                await channel.send(lastSmallMess.content);
                break;
            case DETAIL_INFO_THREAD:
                const lastDetailMess = await fetchLastMessage(detailsThread);
                if (!lastDetailMess) {
                    channel.send('😬 No message found')
                }
                await channel.send(lastDetailMess.content);
                break;
            default:
                await channel.send(`Only accept: [${SMALL_INFO_THREAD}, ${DETAIL_INFO_THREAD}]`);
                break;
        }
    }

    if (message.content.startsWith('READ_FILE')) {
        const arr = splitMessage(message.content);
        if (!arr[1]) {
            await channel.send('No path found.');
            return;
        }

        await extractDataFromPath(arr[1])
    }

    if (message.attachments.size > 0) {
        switch (message.attachments.size) {
            case 1: {
                try {
                    await extractDataFromFile(message.attachments.last());
                } catch (error) {
                    console.log(error);
                }
                break;
            }
            default: {
                await channel.send('Sorry, but we can only process 1 file at the time')
                break;
            }
        }
    }

});

client.login(process.env.BOT_TOKEN);
