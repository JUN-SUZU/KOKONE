let settings = {};
let userID = localStorage.getItem('userID'), token = localStorage.getItem('token');
if (!userID || !token) {
    document.getElementById('error').innerText = 'Discordにログインする必要があります。3秒後にリダイレクトします。';
    document.getElementById('error').style.display = 'block';
    setTimeout(() => {
        window.location.href = '/login/';
    }, 3000);
}
else fetch('/api/user/' + userID + '/dashboard/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ token: token })
}).then(response => {
    if (response.status === 200) {
        return response.json();
    } else {
        throw new Error('Failed to fetch data');
    }
}).then(data => {
    if (data.status === 'success') {
        document.getElementById('accountIcon').innerText = data.data.iconURL;
        document.getElementById('meIcon').innerText = data.data.iconURL;
        document.getElementById('accountName').innerText = data.data.globalUsername;
        const { clientData, guildsData } = data.data;
        guildsData.forEach(guild => {
            let guildElement = document.createElement('div');
            guildElement.className = 'server__icon';
            guildElement.id = guild.id;
            guildElement.innerHTML = `
                <img src="${guild.iconURL}" alt="${guild.name}のサーバーアイコン">
            `;
            guildElement.onclick = () => {
                serverChange(guild.id);
            }
            document.getElementById('serversList').appendChild(guildElement);
        });
    }
    else {
        document.getElementById('error').innerText = data.message;
        document.getElementById('error').style.display = 'block';
        localStorage.removeItem('userID');
        localStorage.removeItem('token');
        setTimeout(() => {
            window.location.href = '/login/';
        }, 3000);
    }
}).catch(error => {
    console.error(error);
});

let currentPage = ['me', 'profile'];

function serverChange(guildID) {// 個人用設定はguildIDがme
    if (currentPage[0] === guildID) return;
    let guild = settings[guildID];
    document.getElementById('serverName').innerText = guild.name;
    document.getElementById(guildID).classList.add('selected');
    if (guildID === 'me') {
        document.getElementsByClassName('me__tabs__list')[0].style.display = 'block';
        document.getElementsByClassName('server__tabs__list')[0].style.display = 'none';
        refreshPage('me', 'profile');
    }
    else {
        document.getElementsByClassName('me__tabs__list')[0].style.display = 'none';
        document.getElementsByClassName('server__tabs__list')[0].style.display = 'block';
        refreshPage('server', 'profile');
    }
}

function refreshPage(type, page) {
    if (currentPage[0] === type && currentPage[1] === page) return;
    loadPageData(page);
    document.getElementsByClassName('page__content__' + currentPage[1])[0].style.display = 'none';
    document.getElementsByClassName('page__content__' + page)[0].style.display = 'block';
    currentPage = [type, page];
}

function loadPageData(page) {
    if (page === 'profile') {
        // プロフィールページのデータを取得
        // アイコン
        // 名前
        // 自己紹介
        // 好きな楽曲
        // 好きなアーティスト
        // 好きなジャンル
        // 曲・アーティスト・ジャンルの公開設定
    }
    else if (page === 'playlists') {
        // プレイリストページのデータを取得
        // プレイリスト一覧
        // プレイリストの作成・編集・削除
        // 公式プレイリストの追加
    }
}
