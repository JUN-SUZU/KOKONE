# データベース

## 名称

Database: KOKONE
table: guilds / clients / videoCache

## テーブル

### guilds

+----------+-------------+------+-----+---------+-------+
| Field    | Type        | Null | Key | Default | Extra |
+----------+-------------+------+-----+---------+-------+
| guild_id | varchar(20) | NO   | PRI | NULL    |       |
| options  | json        | YES  |     | NULL    |       |
| volume   | double      | YES  |     | 30      |       |
| queue    | json        | YES  |     | NULL    |       |
| history  | json        | YES  |     | NULL    |       |
+----------+-------------+------+-----+---------+-------+

### clients

CREATE TABLE clients (client_id varchar(20) primary key, user_name text, global_name text, avatar_url text, token varchar(16), refresh_token varchar(32), expires_on datetime, locale varchar(3), guilds json, options json);
+---------------+-------------+------+-----+---------+-------+
| Field         | Type        | Null | Key | Default | Extra |
+---------------+-------------+------+-----+---------+-------+
| client_id     | varchar(20) | NO   | PRI | NULL    |       |
| user_name     | text        | YES  |     | NULL    |       |
| global_name   | text        | YES  |     | NULL    |       |
| avatar_url    | text        | YES  |     | NULL    |       |
| token         | varchar(16) | YES  |     | NULL    |       |
| refresh_token | varchar(32) | YES  |     | NULL    |       |
| expires_on    | datetime    | YES  |     | NULL    |       |
| locale        | varchar(3)  | YES  |     | NULL    |       |
| guilds        | json        | YES  |     | NULL    |       |
| options       | json        | YES  |     | NULL    |       |
+---------------+-------------+------+-----+---------+-------+

### videoCache

+---------------+--------------+------+-----+---------+-------+
| Field         | Type         | Null | Key | Default | Extra |
+---------------+--------------+------+-----+---------+-------+
| video_id      | varchar(100) | NO   | PRI | NULL    |       |
| video_title   | varchar(120) | YES  |     | NULL    |       |
| channel_title | varchar(100) | YES  |     | NULL    |       |
+---------------+--------------+------+-----+---------+-------+
