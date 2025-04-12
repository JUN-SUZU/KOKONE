const fs = require('fs');
const WebSocket = require('ws');
const config = require('../config.json');
const { getVoiceConnection } = require('@discordjs/voice');

class WebSocketManager {
    constructor() {
        this.headers = {
            'Authorization': config.lavalink.password,
            'User-Id': '1132434398604689419',
            'Client-Name': 'KOKONE/3.0'
        };
        this.createConnection();
    }
    createConnection() {
        this.ws = new WebSocket('ws://localhost:2333/v4/websocket', {
            headers: this.headers
        });
        this.ws.on('open', () => {
            console.log('Connection Opened');
        });
        this.ws.on('message', (buffer) => {
            console.log(buffer.toString());
            const data = JSON.parse(buffer.toString());
            if (data.op === 'ready') {
                this.headers['Session-Id'] = data.sessionId;
                this.lavalinkSessionId = data.sessionId;
            }
            else if (data.op === 'event') {
                if (data.type === 'TrackEndEvent') {
                    const connection = getVoiceConnection(data.guildId);
                    if (connection) {
                        connection.destroy();
                    }
                }
            }
        });
        this.ws.on('close', () => {
            console.log('Connection Closed');
            this.createConnection();
        });
        this.ws.on('error', (err) => {
            console.error(err);
        });
    }
}

module.exports = WebSocketManager;
