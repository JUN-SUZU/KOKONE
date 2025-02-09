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

+-------------+-------------+------+-----+---------+-------+
| Field       | Type        | Null | Key | Default | Extra |
+-------------+-------------+------+-----+---------+-------+
| client_id   | varchar(20) | NO   | PRI | NULL    |       |
| options     | json        | YES  |     | NULL    |       |
| token       | varchar(16) | YES  |     | NULL    |       |
| user_name   | text        | YES  |     | NULL    |       |
| global_name | text        | YES  |     | NULL    |       |
| avatar_url  | text        | YES  |     | NULL    |       |
+-------------+-------------+------+-----+---------+-------+

### videoCache

+---------------+--------------+------+-----+---------+-------+
| Field         | Type         | Null | Key | Default | Extra |
+---------------+--------------+------+-----+---------+-------+
| video_id      | varchar(100) | NO   | PRI | NULL    |       |
| video_title   | varchar(120) | YES  |     | NULL    |       |
| channel_title | varchar(100) | YES  |     | NULL    |       |
+---------------+--------------+------+-----+---------+-------+
