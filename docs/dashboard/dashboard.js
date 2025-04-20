if (window.top !== window.self) document.body.innerHTML = "";
let userData = {};
fetch('https://dashboard.kokone.jun-suzu.net/auth/api/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    credentials: 'include',
}).then((res) => {
    if (res.status === 200) {
        res.json().then((data) => {
            if (data.result === 'success') {
                console.log('Logged in successfully.');
                userData = { username: data.username, globalName: data.globalName, avatar: data.avatar };
            } else {
                console.error('Failed to authenticate. Continue to login with Discord.');
                window.location.href = 'https://kokone.jun-suzu.net/login/';
            }
        });
    } else {
        console.error('Failed to authenticate. Continue to login with Discord.');
        window.location.href = 'https://kokone.jun-suzu.net/login/';
    }
});

let selectedGuild = 0;
let guilds = [];
let handlers = {};

// connect to the server using WebSocket
let socket;
const connectWebSocket = () => {
    socket = new WebSocket('wss://dashboard.kokone.jun-suzu.net/ws');
    socket.onopen = () => {
        console.log('WebSocket connection established.');
        socket.send(JSON.stringify({ action: 'greeting', data: 'Hello from the dashboard!' }));
    };
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'greeting') {
            console.log('Received a greeting from the server:', data.details);
        }
        else if (data.action === 'getUserSettings') {
            console.log('Received user settings.');
            const userSettings = data.details;
        }
        else if (data.action === 'getGuilds') {
            console.log('Received guilds.');
            guilds = data.details;
            const guildList = document.getElementById('servers');
            guildList.innerHTML = '';
            for (let i = 0; i < guilds.length; i++) {
                const guildButton = document.createElement('button');
                const guildIcon = document.createElement('img');
                guildIcon.src = guilds[i].icon ?? '../assets/img/discord-mark-white.svg';
                guildIcon.alt = 'サーバーアイコン。';
                guildIcon.className = 'server__icon';
                guildButton.appendChild(guildIcon);
                guildButton.addEventListener('click', () => {
                    selectedGuild = i;
                    socket.send(JSON.stringify({ action: 'getGuildData', guildID: guilds[i].id }));
                });
                guildList.appendChild(guildButton);
            }
            if (guilds.length > 0) {
                guildList.children[0].click();
            }
        }
        else if (data.action === 'getGuildData') {
            console.log('Received guild data.');
            const guildData = data.details;
            document.getElementById('volume').value = guildData.volume;
            document.getElementById('volumeLabel').innerText = "音量: " + guildData.volume + "%";
            if (guilds[selectedGuild].playing) {
                document.getElementById('mcover').src = `https://img.youtube.com/vi/${guildData.queue[0].videoId}/default.jpg`;
                refreshSeekbar(guildData.playingTime);
                socket.send(JSON.stringify({ action: 'getVideoData', videoID: guildData.queue[0].videoId, flag: 'playing' }));
            }
        }
        else if (data.action === 'getVideoData') {
            console.log('Received video data.');
            const videoData = data.details;
            if (videoData.flag === 'playing') {
                document.getElementById('mtitle').innerText = videoData['video_title'];
                document.getElementById('martist').innerText = videoData['channel_title'];
            }
        }
    };
    socket.onclose = () => {
        console.log('WebSocket connection closed.');
        setTimeout(connectWebSocket, 1000);
    };
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
};
connectWebSocket();

class controlButtonEvent {
    constructor() {
        const init = () => {
            document.getElementById('volume').addEventListener('input', () => {
                const volume = document.getElementById('volume').value;
                document.getElementById('volumeLabel').innerText = "音量: " + volume + "%";
                socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'volume', value: volume }));
            });
            document.getElementById('muteButton').addEventListener('click', () => {
                document.getElementById('volume').value = 0;
                document.getElementById('volume').dispatchEvent(new Event('input'));// trigger input event
            });
            document.getElementById('shuffleButton').addEventListener('click', () => {
                socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'shuffle' }));
            });
            document.getElementById('playButton').addEventListener('click', () => {
                if (guilds[selectedGuild].playing) {
                    document.getElementById('playButton').innerHTML = '<ion-icon name="play"></ion-icon>';
                    socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'pause' }));
                }
                else {
                    document.getElementById('playButton').innerHTML = '<ion-icon name="pause"></ion-icon>';
                    socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'play' }));
                }
            });
            // document.getElementById('pauseButton').addEventListener('click', () => {
            //     socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'pause' }));
            // });
            document.getElementById('skipButton').addEventListener('click', () => {
                socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'skip' }));
            });
            document.getElementById('stopButton').addEventListener('click', () => {
                socket.send(JSON.stringify({ action: 'controlPlayer', guildID: guilds[selectedGuild].id, control: 'stop' }));
            });
        }
        init();
    }
}

new controlButtonEvent();

// refresh seekbar
function refreshSeekbar(playingTime) {
    if (handlers.playingTime) clearInterval(handlers.playingTime);
    handlers.playingTime = setInterval(() => {
        const now = new Date().getTime();
        let elapsed = playingTime.totalPlayedTime;// unit: ms
        elapsed += playingTime.playStartTime != null ? now - playingTime.playStartTime : 0;
        const percentage = elapsed / playingTime.musicLength / 10;
        if (percentage > 100) {
            clearInterval(handlers.playingTime);
            return;
        }
        document.getElementById('seekbarLine').style.width = percentage + '%';
        document.getElementById('seekbarThumb').style.left = percentage + '%';
        document.getElementById('seekbarTime').innerText = `再生位置: ${Math.floor(elapsed / 60000)}:${("00" + Math.floor(elapsed / 1000) % 60).slice(-2)}`;
    }, 500);
}


// draw equalizer
let diffEqualizer = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const equalizer = document.getElementById('equalizer');
drawEqualizer(equalizer);
async function drawEqualizer(equalizer) {
    const ctx = equalizer.getContext('2d');
    const width = equalizer.width;
    const height = equalizer.height;
    const gap = 3;
    const maxHeight = height * 0.8;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 10; i++) {
        diffEqualizer[i] += Math.random() * 0.1 - 0.05;
        diffEqualizer[i] = Math.max(0, Math.min(1, diffEqualizer[i]));
        diffEqualizer[i - 1] && Math.abs(diffEqualizer[i] - diffEqualizer[i - 1]) > 0.05 ? diffEqualizer[i - 1] += (diffEqualizer[i] - diffEqualizer[i - 1]) * 0.1 : null;
        diffEqualizer[i + 1] && Math.abs(diffEqualizer[i] - diffEqualizer[i + 1]) > 0.05 ? diffEqualizer[i + 1] += (diffEqualizer[i] - diffEqualizer[i + 1]) * 0.1 : null;
        const lineHeight = Math.max(10, Math.min(maxHeight, diffEqualizer[i] * maxHeight));
        ctx.fillStyle = `hsl(${diffEqualizer[i] * 360}, 100%, 96%)`;
        const xLeft = width / 4 + (-i) * (gap + 2);
        // 角を丸くする
        ctx.beginPath();
        ctx.moveTo(xLeft, height);
        ctx.lineTo(xLeft, height - lineHeight);
        ctx.arc(xLeft + 1, height - lineHeight, 1, 0, Math.PI, true);
        ctx.lineTo(xLeft + 2, height - lineHeight);
        ctx.lineTo(xLeft + 2, height);
        ctx.fill();
        const xRight = width * 3 / 4 + i * (gap + 2);
        ctx.beginPath();
        ctx.moveTo(xRight, height);
        ctx.lineTo(xRight, height - lineHeight);
        ctx.arc(xRight + 1, height - lineHeight, 1, 0, Math.PI, true);
        ctx.lineTo(xRight + 2, height - lineHeight);
        ctx.lineTo(xRight + 2, height);
        ctx.fill();
    }
    requestAnimationFrame(() => {
        setTimeout(() => drawEqualizer(equalizer), 16);// 16ms wait before next frame
    });
}
