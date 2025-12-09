const config = require("../config/baseconfig");
const mysql = require("pg");
const pool = require("./dbpool_pg");
const namedSql = require("yesql").pg; //https://github.com/pihvi/yesql

module.exports = {
  updateWorkflowData: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });
    pool.connect(function (error, client, release) {
      if (error) throw error;
      var sql = `UPDATE redmanager.workmanage SET`;
      if (data?.status_idx !== undefined) sql += `  status_idx = :status_idx`;
      if (data?.startdate !== undefined)
        data.startdate === "null"
          ? (sql += ` startdate = null`)
          : (sql += `  startdate = :startdate`);
      if (data?.completedate !== undefined)
        data.completedate === "null"
          ? (sql += ` completedate = null`)
          : (sql += `  completedate = :completedate`);
      sql += ` WHERE issue_idx = :issue_idx`;
      sql += ` AND progress_idx = :progress_idx`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);

      client.query(mappedSql, function (error, result) {
        if (error) console.log(error);
        var sql2 = `UPDATE redmanager.issuelist SET updatedate = now(), is_updated = false WHERE issue_idx = :issue_idx;`;
        const mappedSql2 = namedSql(sql2)(data);
        if (config.getDebugMode()) console.log(mappedSql2);
        client.query(mappedSql2, function (error, result) {
          release();
          if (error) console.log(error);
          callback(result);
        });
      });
    });
  },
};
