# [KOKONE](https://kokone.jun-suzu.net)

## KOKONE は、Discord の音楽 BOT です。

YouTube の音楽を再生できます。URL,検索ワード,プレイリストの再生に対応しています。音量の調整や、ループ再生や、キューに登録などの一般的な機能は全て備えています。

## コマンド

- `/play` : 音楽を再生します。
- `/stop` : 音楽を停止します。
- `/skip` : 次の曲にスキップします。
- `/pause` : 音楽を一時停止します。
- `/resume` : 一時停止している音楽を再び再生します。
- `/repeat` : ループ再生を切り替えます。
- `/queue` : キューに登録されている曲を表示します。
- `/shuffle` : キューに登録されている曲をシャッフルします。
- `/history` : 再生履歴を表示します。
- `/volume` : 音量を調整します。

## 使い方

1. まず、`/play`コマンドを使って音楽を再生します。
2. `/play`コマンドの後に、URL や検索ワードを入力してください。
3. 音楽が再生されます。

## 声優さん

VOICEVOX冥鳴ひまり(話速1.09, 音高0.06, 抑揚0.78)

## File Structure

```bash
tree -n -I "node_modules" . -o structure
```

## MySQL

```sql
mysql> DESC guilds;
+----------+-------------+------+-----+---------+-------+
| Field    | Type        | Null | Key | Default | Extra |
+----------+-------------+------+-----+---------+-------+
| guild_id | varchar(20) | NO   | PRI | NULL    |       |
| options  | json        | YES  |     | NULL    |       |
| volume   | double      | YES  |     | 30      |       |
| queue    | json        | YES  |     | NULL    |       |
| history  | json        | YES  |     | NULL    |       |
+----------+-------------+------+-----+---------+-------+
```

## ライセンス

MIT ライセンスです。

## 作者

[JUN-SUZU](https://jun-suzu.net)
© 2024 JUN-SUZU

## バージョン

1.2.0

## 追加予定の機能

- [ ] ダッシュボードの追加
