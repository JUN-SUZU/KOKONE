const config = require('../config.json');
async function sendREST(url, method, data) {
        const response = await fetch('http://127.0.0.1:2333/v4' + url, {
            method: method,
            headers: {
                'Authorization': config.lavalink.password,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return response.json();
    }
class RESTManager {
    constructor(wsm) {
        this.WebSocketManager = wsm;
    }
    
    async loadTracks(identifier) {
        return await sendREST('/loadtracks?identifier=' + identifier, 'GET');
    }
    async decodeTrack(track) {
        return await sendREST('/decodetrack?encodedTrack=' + track, 'GET');
    }
    async decodeTracks(tracks) {
        return await sendREST('/decodetracks', 'POST', tracks);
    }
    async getPlayers() {
        return await sendREST('/sessions/' + this.WebSocketManager.lavalinkSessionId + '/players', 'GET');
    }
    async getPlayer(guildId) {
        return await sendREST('/sessions/' + this.WebSocketManager.lavalinkSessionId + '/players/' + guildId, 'GET');
    }
    async updatePlayer(guildId, data) {
        return await sendREST(`/sessions/${this.WebSocketManager.lavalinkSessionId}/players/${guildId}?noReplace=true`, 'PATCH', data);
    }
    async destroyPlayer(guildId) {
        return await sendREST(`/sessions/${this.WebSocketManager.lavalinkSessionId}/players/${guildId}`, 'DELETE');
    }
    async updateSession(data) {
        return await sendREST(`/sessions/${this.WebSocketManager.lavalinkSessionId}`, 'PATCH', data);
    }
}

module.exports = RESTManager;
