const mysql = require('mysql');
const util = require('util');
const config = require('./config.json');

class DB {
    constructor() {
        this.connection = mysql.createConnection({
            host: config.mysql.host,
            user: config.mysql.user,
            password: config.mysql.password,
            database: config.mysql.database,
            charset: 'utf8mb4'
        });
    }

    async exec(query) {
        this.connection.query = util.promisify(this.connection.query);
        try {
            return await this.connection.query(query);
        } catch (err) {
            console.log(err);
        }
    }
}

module.exports = DB;
