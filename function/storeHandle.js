import {channel} from "../index.js";

export const fetchLastMessage = async (thread) => {
    const messages = await thread.messages.fetch({limit: 1});
    return messages.first();
}

export const findThisMessage = async (thread, message) => {

    let lastMessageId = null; // Used for pagination

    try {
        while (true) {
            const messagesCol = await thread.messages.fetch({limit: 100, before: lastMessageId});

            if (messagesCol.size === 0) return false; // Message never in the channel/thread

            const content = [...messagesCol.values()];

            // find the message in data
            if (content.some(i => i.content === message)) {
                return true;
            }
            lastMessageId = messagesCol.last()?.id; // Ensure it's not undefined before accessing .id
        }
    } catch (error) {
        channel.send('❌ Error fetching messages:', error);
        return false;
    }
}

export const filterTheseMessages = async (thread, messArr) => {
    let lastMessageId = null;

    if (messArr.length === 0) {
        return [];
    }

    try {
        while (true) {
            const messagesCol = await thread.messages.fetch({limit: 100, before: lastMessageId});
            if (messagesCol.size === 0) return messArr; // These messages are completely new
            const content = [...messagesCol.values()];
            messArr = messArr.filter(i => !content.includes(i));

            if (messArr.length === 0) return [];
            lastMessageId = messagesCol.last()?.id;
        }
    } catch (e) {
        channel.send('❌ Error fetching messages:', error);
        return [];
    }
}

export const createMessage = async (location, message) => {
    try {
        await location.send(message);
        channel.send(`✅ Send message to ${location} complete successfully!`);
    } catch (e) {
        channel.send(`⛔ Error send message to ${location}: ${e}`);
    }
}

export const replyMessage = async (messageEvent, message) => {
    try {
        await messageEvent.reply(message);
        channel.send(`✅ Reply ${messageEvent.content} complete successfully!`);
    } catch (e) {
        channel.send(`⛔ Error reply ${messageEvent.content}: ${e}`);
    }
}

export const keepThreadActive = async (thread) => {
    try {
        if (thread.archived) {
            await thread.setArchived(false);
            channel.send(`✅ Thread "${thread.name}" has been unarchived.`);
        }

        if (thread.locked) {
            await thread.setLocked(false);
            channel.send(`✅ Thread "${thread.name}" has been unlocked.`);
        }

    } catch (error) {
        channel.send('⛔ Error updating thread status:', error);
    }
};

export const getThreadByName = async (threadName) => {
    try {
        const activeThreads = await channel.threads.fetchActive();
        let thread = activeThreads.threads.find(th => th.name === threadName);

        if (!thread) {
            const archivedThreads = await channel.threads.fetchArchived();
            thread = archivedThreads.threads.find(th => th.name === threadName);
        }

        // ✅ If thread exists, keep it active
        if (thread) {
            console.log(`✅ Thread "${thread.name}" found.`);
            await keepThreadActive(thread);
            return thread;
        }

        console.warn(`⚠️ Thread "${threadName}" not found, creating new.`);
        return await createThreadByName(threadName);

    } catch (error) {
        console.error(`⛔ Error while retrieving thread "${threadName}":`, error);
    }
};


export const createThreadByName = async (threadName) => {
    try {
        const thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: 10080, // 7 days
            reason: 'Creating a new thread to store small info recipe data',
        });

        channel.send(`✅ Thread "${thread.name}" ID: "${thread.id}" created successfully!`);
        console.log(`✅ Thread "${thread.name}" ID: "${thread.id}" created successfully!`);
        return thread;
    } catch (e) {
        channel.send(`⛔ Error while creating Thread ${threadName}: ${e}`);
        console.error(`⛔ Error while creating Thread ${threadName}: ${e}`);
    }
}

export const clearChannel = async () => {
    try {
        let messages;
        do {
            messages = await channel.messages.fetch({ limit: 100 });

            // Filter out messages older than 14 days
            const deletableMessages = messages.filter(msg => (Date.now() - msg.createdTimestamp) < 1209600000);

            if (deletableMessages.size > 0) {
                await channel.bulkDelete(deletableMessages, true).catch(err => {
                    console.error("❌ Bulk delete failed:", err.message);
                });
            } else {
                break; // No more valid messages to delete
            }
        } while (messages.size >= 2);

        console.log("✅ Channel cleared successfully.");
    } catch (err) {
        console.error("❌ Error clearing channel:", err.message);
    }
};

