let userID = localStorage.getItem('userID');
let token = localStorage.getItem('token');
if (userID && token) {
    window.location.href = '/dashboard/';
}
// GETのパラメータを取得
let url = new URL(window.location.href);
let code = url.searchParams.get('code');
if (code) {
    // POSTリクエストを送信
    document.getElementById('error').innerText = 'ログイン中...サーバーからの応答を待っています。';
    document.getElementById('error').style.display = 'block';
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code }),
    };
    fetch('https://dashboard.kokone.jun-suzu.net/login/api/', options).then((res) => {
        if (res.status === 200) {
            res.json().then((data) => {
                if (data.result === 'success') {
                    localStorage.setItem('userID', data.userID);
                    localStorage.setItem('token', data.token);
                    document.getElementById('error').innerText = 'ログインに成功しました。3秒後にリダイレクトします。';
                    setTimeout(() => {
                        window.location.href = '/dashboard/';
                    }, 3000);
                } else {
                    document.getElementById('error').innerText = 'ログインに失敗しました。再度お試しください。';
                }
            });
        } else {
            console.error('Failed to fetch data');
        }
    });
}
