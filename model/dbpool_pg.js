const pg = require("pg");
const config = require("../config/dbconn_pg");

let pool = new pg.Pool(config);

module.exports = pool;
