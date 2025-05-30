import mysql from 'mysql2';
import util from 'util';
import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'));

export default class {
    constructor() {
        const connect = () => {
            this.connection = mysql.createConnection({
                host: config.mysql.host,
                user: config.mysql.user,
                password: config.mysql.password,
                database: config.mysql.database,
                charset: 'utf8mb4'
            });
            // this.connectAsync = util.promisify(this.connection.connect).bind(this.connection);
            this.connection.connect((err) => {
                if (err) {
                    console.error('error connecting: ' + err.stack);
                    return;
                }
                console.log('connected as id ' + this.connection.threadId);
                // SET wait_timeout = 86400;
                // SET interactive_timeout = 86400;
                this.connection.query('SET SESSION wait_timeout = 86400');
                this.connection.query('SET SESSION interactive_timeout = 86400');
            });
            this.queryAsync = util.promisify(this.connection.query).bind(this.connection);
            this.connection.on('error', (err) => {
                console.log('db error', err);
                connect();
            });
        }
        connect();
        // this.endAsync = util.promisify(this.connection.end).bind(this.connection);
        const guilds = {
            get: async (guild_id) => {
                const resData = await this.exec(`SELECT * FROM guilds WHERE guild_id = '${guild_id}'`);
                return resData[0] ?? null;
            },
            set: async (guild_id, { options, queue, history, volume }) => {
                const optionsString = JSON.stringify(options);
                const queueString = JSON.stringify(queue);
                const historyString = JSON.stringify(history);
                return await this.exec(`INSERT INTO guilds (guild_id, options, queue, history, volume) VALUES (${guild_id}, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE options = ?, queue = ?, history = ?, volume = ?`, [optionsString, queueString, historyString, volume, optionsString, queueString, historyString, volume]);
            },
            options: {
                get: async (guild_id) => {
                    const resData = await this.exec(`SELECT options FROM guilds WHERE guild_id = '${guild_id}'`);
                    return resData[0] && resData[0].options ? resData[0].options : {};
                },
                set: async (guild_id, options) => {
                    const optionsString = JSON.stringify(options);
                    // return await this.exec(`INSERT INTO guilds (guild_id, options) VALUES (${guild_id}, '${optionsString}') ON DUPLICATE KEY UPDATE options = '${optionsString}'`);
                    return await this.exec(`INSERT INTO guilds (guild_id, options) VALUES (${guild_id}, ?) ON DUPLICATE KEY UPDATE options = ?`, [optionsString, optionsString]);
                }
            },
            queue: {
                get: async (guild_id) => {
                    const resData = await this.exec(`SELECT queue FROM guilds WHERE guild_id = '${guild_id}'`);
                    return resData[0] && resData[0].queue ? resData[0].queue : [];
                },
                set: async (guild_id, queue) => {
                    const queueString = JSON.stringify(queue);
                    // return await this.exec(`INSERT INTO guilds (guild_id, queue) VALUES (${guild_id}, '${queueString}') ON DUPLICATE KEY UPDATE queue = '${queueString}'`);
                    return await this.exec(`INSERT INTO guilds (guild_id, queue) VALUES (${guild_id}, ?) ON DUPLICATE KEY UPDATE queue = ?`, [queueString, queueString]);
                }
            },
            history: {
                get: async (guild_id) => {
                    const resData = await this.exec(`SELECT history FROM guilds WHERE guild_id = '${guild_id}'`);
                    return resData[0] && resData[0].history ? resData[0].history : [];
                },
                set: async (guild_id, history) => {
                    const historyString = JSON.stringify(history);
                    // return await this.exec(`INSERT INTO guilds (guild_id, history) VALUES (${guild_id}, '${historyString}') ON DUPLICATE KEY UPDATE history = '${historyString}'`);
                    return await this.exec(`INSERT INTO guilds (guild_id, history) VALUES (${guild_id}, ?) ON DUPLICATE KEY UPDATE history = ?`, [historyString, historyString]);
                }
            },
            volume: {
                get: async (guild_id) => {
                    const resData = await this.exec(`SELECT volume FROM guilds WHERE guild_id = '${guild_id}'`);
                    return resData[0] && resData[0].volume ? resData[0].volume : 30;
                },
                set: async (guild_id, volume) => {
                    return await this.exec(`INSERT INTO guilds (guild_id, volume) VALUES (${guild_id}, ${volume}) ON DUPLICATE KEY UPDATE volume = ${volume}`);
                }
            }
        }
        const clients = {
            get: async (user_id) => {
                const resData = await this.exec(`SELECT * FROM clients WHERE client_id = '${user_id}'`);
                return resData[0] ?? null;
            },
            set: async (user_id, { username, globalName, avatar, kokoneToken, refreshToken, expiresOn, locale, guilds }) => {
                const expiresOnDate = new Date(expiresOn);
                const expiresOnString = expiresOnDate.toISOString().slice(0, 19).replace('T', ' ');
                const guildsString = JSON.stringify(guilds);
                return await this.exec(`INSERT INTO clients (client_id, user_name, global_name, avatar_url, token, refresh_token, expires_on, locale, guilds) VALUES ('${user_id}', ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_name = ?, global_name = ?, avatar_url = ?, token = ?, refresh_token = ?, expires_on = ?, locale = ?, guilds = ?`,
                    [username, globalName, avatar, kokoneToken, refreshToken, expiresOnString, locale, guildsString, username, globalName, avatar, kokoneToken, refreshToken, expiresOnString, locale, guildsString]);
            },
            delete: async (user_id) => {
                return await this.exec(`DELETE FROM clients WHERE client_id = '${user_id}'`);
            },
            token: {
                get: async (user_id) => {
                    const resData = await this.exec(`SELECT token FROM clients WHERE client_id = '${user_id}'`);
                    return resData[0] && resData[0].token ? resData[0].token : null;
                }
            },
            refreshToken: {
                get: async (user_id) => {
                    const resData = await this.exec(`SELECT refresh_token FROM clients WHERE client_id = '${user_id}'`);
                    return resData[0] && resData[0].refresh_token ? resData[0].refresh_token : null;
                }
            },
            guilds: {
                get: async (user_id) => {
                    const resData = await this.exec(`SELECT guilds FROM clients WHERE client_id = '${user_id}'`);
                    return resData[0] && resData[0].guilds ? resData[0].guilds : [];
                }
            },
            options: {
                get: async (user_id) => {
                    const resData = await this.exec(`SELECT options FROM clients WHERE client_id = '${user_id}'`);
                    return resData[0] && resData[0].options ? resData[0].options : {};
                },
                set: async (user_id, options) => {
                    const optionsString = JSON.stringify(options);
                    return await this.exec(`INSERT INTO clients (client_id, options) VALUES ('${user_id}', ?) ON DUPLICATE KEY UPDATE options = ?`, [optionsString, optionsString]);
                }
            }
        }
        const videoCache = {
            get: async (video_id) => {
                const resData = await this.exec(`SELECT * FROM videoCache WHERE video_id = '${video_id}'`);
                return resData[0] ?? null;
            },
            set: async (video_id, video_title, channel_title) => {
                // return await this.exec(`INSERT INTO videoCache (video_id, video_title, channel_title) VALUES ('${video_id}', '${video_title}', '${channel_title}')`);
                return await this.exec(`INSERT INTO videoCache (video_id, video_title, channel_title) VALUES ('${video_id}', ?, ?) ON DUPLICATE KEY UPDATE video_title = ?, channel_title = ?`, [video_title, channel_title, video_title, channel_title]);
            }
        }
        this.guilds = guilds;
        this.clients = clients;
        this.videoCache = videoCache;
    }

    async exec(query, values = []) {
        try {
            const result = await this.queryAsync(query, values);
            return result;
        } catch (err) {
            console.log(err);
            return err;
        }
    }
}
