const mysql = require('mysql2');
const util = require('util');
const config = require('./config.json');

class DB {
    constructor() {
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
        });
        this.queryAsync = util.promisify(this.connection.query).bind(this.connection);
        // this.endAsync = util.promisify(this.connection.end).bind(this.connection);
        const guilds = {
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
            set: async (user_id, { kokoneToken, username, globalName, avatar }) => {
                return await this.exec(`INSERT INTO clients (client_id, token, user_name, global_name, avatar_url) VALUES ('${user_id}', '${kokoneToken}', ?, ?, ?) ON DUPLICATE KEY UPDATE token = '${kokoneToken}', user_name = ?, global_name = ?, avatar_url = ?`, [username, globalName, avatar, username, globalName, avatar]);
            },
            delete: async (user_id) => {
                return await this.exec(`DELETE FROM clients WHERE client_id = '${user_id}'`);
            },
            token: {
                get: async (user_id) => {
                    const resData = await this.exec(`SELECT token FROM clients WHERE client_id = '${user_id}'`);
                    return resData[0] && resData[0].token ? resData[0].token : null;
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

module.exports = DB;
