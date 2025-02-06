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
document.addEventListener('DOMContentLoaded', function () {
    // Your code here...
    console.log('Hello from the dashboard!');
    const equalizer = document.getElementById('equalizer');// canvas element
    drawEqualizer(equalizer);
    // connect to the server using WebSocket
    const socket = new WebSocket('wss://dashboard.kokone.jun-suzu.net/ws');
    socket.onopen = function() {
        console.log('WebSocket connection established.');
        socket.send(JSON.stringify({ type: 'auth', dId, dToken }));
    };
});

let diffEqualizer = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
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
        diffEqualizer[i-1] && Math.abs(diffEqualizer[i] - diffEqualizer[i-1]) > 0.05 ? diffEqualizer[i-1] += (diffEqualizer[i] - diffEqualizer[i-1]) * 0.1 : null;
        diffEqualizer[i+1] && Math.abs(diffEqualizer[i] - diffEqualizer[i+1]) > 0.05 ? diffEqualizer[i+1] += (diffEqualizer[i] - diffEqualizer[i+1]) * 0.1 : null;
        const lineHeight = Math.max(10, Math.min(maxHeight, diffEqualizer[i] * maxHeight));
        ctx.fillStyle = `hsl(${diffEqualizer[i] * 360}, 100%, 96%)`;
        const xLeft = width / 4 + (-i) * (gap + 2);
        // ctx.fillRect(xLeft, height - lineHeight, 2, lineHeight);
        // ctx.fillRect(xRight, height - lineHeight, 2, lineHeight);
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
        // 100ms wait before next frame
        setTimeout(() => drawEqualizer(equalizer), 16);
    });
}
