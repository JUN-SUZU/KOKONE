# データベース

## 名称

Database: KOKONE
table: guilds / clients

## テーブル

### guilds

| カラム名 | データ型 | NULL | デフォルト | その他 |
| guild_id | varchar(20) | YES | NULL | PRIMARY KEY |
| options | json | YES | NULL | |
| volume | double | YES | 30 | |

### clients

| カラム名 | データ型 | NULL | デフォルト | その他 |
| user_id | varchar(20) | YES | NULL | PRIMARY KEY |
| options | json | YES | NULL | |
