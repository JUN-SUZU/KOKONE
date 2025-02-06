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
                document.getElementById('error').innerText = 'ログインに成功しました。3秒後にリダイレクトします。';
                setTimeout(() => {
                    window.location.href = '/dashboard/';
                }, 3000);
            }
        });
    } else {
        console.error('Failed to authenticate. Continue to login with Discord.');
    }
});
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
        credentials: 'include',
    };
    fetch('https://dashboard.kokone.jun-suzu.net/login/api/', options).then((res) => {
        if (res.status === 200) {
            res.json().then((data) => {
                if (data.result === 'success') {
                    // localStorage.setItem('dAccount', JSON.stringify({ dId: data.userID, dToken: data.token }));
                    // set cookie dId only
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
