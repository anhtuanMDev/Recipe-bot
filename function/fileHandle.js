import {createMessage, filterTheseMessages, findThisMessage} from "./storeHandle.js";
import {channel, detailsThread, smallThread, TIME_PER_STEP} from "./../index.js";

import axios from 'axios';
import {parse} from 'csv-parse';
import fs from 'fs';
import {finished} from 'stream/promises';
import * as path from "node:path";

export const fileFunction = async (message) => {
    channel.send('⚒️ Start Processing File...')

    const file = message.attachments.last();

    switch (getFileType(file)) {
        case 'csv': {
            channel.send('🔍 Identify CSV file');
            const response = await axios.get(file.url, {responseType: 'stream'});
            let result = [];
            const inDatabase = await fetchAllMessages(detailsThread);
            response.data.pipe(parse())
                .on('data', chunk => {
                    result.push(chunk);
                })
                .on('end', () => {
                    channel.send(`🏁 Found ${result.length} rows in CSV file`);
                    if (channel) {
                        const fieldNames = result.shift()
                        result
                            .forEach(item => {
                                const obj = {}
                                for (let i = 0; i < fieldNames.length; i++) {
                                    let info = item[i];
                                    // ingredients, directions, ner
                                    if (i === 1 || i === 2 || i === 5) {
                                        info = JSON.parse(info);
                                    }
                                    obj[fieldNames[i]] = info;
                                }
                                obj.time = obj.directions.length * TIME_PER_STEP;
                                const exists = inDatabase.some(item =>
                                    item.title === obj.title);
                                if (!exists) {
                                    detailsThread.send(JSON.stringify(obj));
                                    const {title, ingredients, time} = obj;
                                    const small = {title, ingredients, time};
                                    smallThread.send(JSON.stringify(small));
                                } else {
                                    channel.send(`Already have ${obj.title}`)
                                }
                            });
                    }
                })

            break;
        }
        default: {
            channel.send('🚫 File type not supported');
            break;
        }
    }
}

// To extract file under 500mb
export const extractDataFromFile = async (file) => {
    channel.send('⚒️ Start Processing File...')
    try {
        console.log(file)
    } catch (e) {
        channel.send(`⛔ Error extract Data from file: ${e}`);
    }
}

export const checkFileExists = async (path) => {
    try {
        return await fs.stat(path);
    } catch (err) {
        return NaN;
    }
}

export const extractDataFromPath = async (filePath) => {
    channel.send('⚒️ Start Processing File...')

    const findFile = await checkFileExists(filePath);
    if (isNaN(Number(findFile.size))) {
        return;
    }

    if (findFile.isDirectory()) {
        channel.send('😒 The path lead to directory not file')
        return;
    }
    await whichTypeToHandle(path.extname(filePath), findFile.size);
}

export const readSmallCSVFile = async (filePath) => {
    try {
        let streams;

        if (filePath.startsWith('http')) {
            // If URL, fetch file content
            const response = await axios.get(filePath, { responseType: 'stream' });
            streams = response.data;
        } else {
            // If local file, read from filesystem
            if (!fs.existsSync(filePath)) throw new Error("File not found");
            streams = fs.createReadStream(filePath, { encoding: 'utf8' });
        }

        const parser = streams.pipe(parse());

        let fieldNames = [];
        let dataArr = [];

        for await (const chunk of parser) {
            if (fieldNames.length === 0) {
                fieldNames = chunk;
            } else {
                const obj = {};
                for (let i = 0; i < fieldNames.length; i++) {
                    obj[fieldNames[i]] = chunk[i];
                }
                obj['time'] = obj['directions'].length * TIME_PER_STEP;
                dataArr.push(JSON.stringify(obj));
            }
        }

        await finished(streams);

        const remainData = await filterTheseMessages(detailsThread, dataArr);

        if (remainData.length) {
            remainData.forEach((item) => {
                const i = JSON.parse(item);
                const { title, ingredients, time } = i;
                const small = { title, ingredients, time };
                createMessage(detailsThread, item);
                createMessage(smallThread, JSON.stringify(small));
            });
            channel.send(`✅ Finished reading file ${filePath}`);
        } else {
            channel.send("😤 These data aren't new");
        }
    } catch (err) {
        channel.send(`❌ Error reading file: ${err.message}`);
    }
};

export const readLargeCSVFile = async (filePath) => {
    try {
        let streams;

        if (filePath.startsWith('http')) {
            // If URL, fetch file content
            const response = await axios.get(filePath, { responseType: 'stream' });
            streams = response.data;
        } else {
            // If local file, read from filesystem
            if (!fs.existsSync(filePath)) throw new Error("File not found");
            streams = fs.createReadStream(filePath, { encoding: 'utf8' });
        }
        const parser = streams.pipe(parse());

        let fieldNames = [];

        for await (const chunk of parser) {
            if (fieldNames.length === 0) {
                fieldNames = chunk;
            } else {
                const obj = {};
                for (let i = 0; i < fieldNames.length; i++) {
                    obj[fieldNames[i]] = chunk[i];
                }
                obj['time'] = obj['directions'].length * TIME_PER_STEP;
                const has = await findThisMessage(detailsThread, JSON.stringify(obj));
                if (has) {
                    channel.send(`😤 ${obj.title} already exists`);
                } else {
                    await createMessage(detailsThread, JSON.stringify(obj));
                    const {title, ingredients, time} = obj;
                    const small = {title, ingredients, time};
                    await createMessage(smallThread, JSON.stringify(small));
                }
            }
        }

        await finished(streams);
        channel.send(`✅ Finished reading file ${fieldNames}.`);
    } catch (err) {
        channel.send('❌ Error reading file:', err);
    }
};

export const whichTypeToHandle = async (ext, size, filePath) => {
    const bigSize = 1073741824;
    switch (ext) {
        case '.csv':
            size > bigSize ? await readLargeCSVFile(filePath) : await readSmallCSVFile(filePath);
            break;
        case '.xlsx':
            console.log('This is an Excel file.');
            break;
        default:
            console.log('Unknown file type.');
    }
}
