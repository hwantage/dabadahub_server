const pool = require("./dbpool_pg");
const config = require("../config/baseconfig");

// Initialize table if it doesn't exist
const initTable = () => {
  pool.connect((error, client, release) => {
    if (error) {
      console.error("DB Connection error during push table init", error);
      return;
    }
    const sql = `
      CREATE TABLE IF NOT EXISTS dabada_push_messages (
        id SERIAL PRIMARY KEY,
        target_ip VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        action_url VARCHAR(1000),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    client.query(sql, (err, result) => {
      release();
      if (err) console.error("Error creating push messages table", err);
      else if (config.getDebugMode()) console.log("Push messages table initialized");
    });
  });
};

initTable();

module.exports = {
  savePushMessage: function (ip, type, title, message, actionUrl, callback) {
    pool.connect((error, client, release) => {
      if (error) {
        console.error("Unexpected error on idle client", error);
        callback(error, null);
        return;
      }
      
      const sql = `
        INSERT INTO dabada_push_messages (target_ip, type, title, message, action_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
      `;
      const values = [ip, type || 'default', title, message, actionUrl || null];
      
      if (config.getDebugMode()) console.log("savePushMessage SQL: ", sql, values);
      
      client.query(sql, values, (err, result) => {
        release();
        if (err) {
          console.error(err);
          callback(err, null);
        } else {
          callback(null, result.rows[0]);
        }
      });
    });
  },

  getPushList: function (ip, callback) {
    pool.connect((error, client, release) => {
      if (error) {
        console.error("Unexpected error on idle client", error);
        callback(error, null);
        return;
      }
      
      const sql = `
        SELECT id, type, title, message, action_url, is_read, created_at 
        FROM dabada_push_messages 
        WHERE target_ip = $1 
        ORDER BY created_at DESC
        LIMIT 100
      `;
      
      client.query(sql, [ip], (err, result) => {
        release();
        if (err) {
          console.error(err);
          callback(err, null);
        } else {
          callback(null, result.rows);
        }
      });
    });
  },

  markAsRead: function (id, ip, callback) {
    pool.connect((error, client, release) => {
      if (error) {
        console.error("Unexpected error on idle client", error);
        callback(error, null);
        return;
      }
      
      // Also ensure it matches the IP for minimal security
      const sql = `
        UPDATE dabada_push_messages 
        SET is_read = TRUE 
        WHERE id = $1 AND target_ip = $2
        RETURNING id
      `;
      
      client.query(sql, [id, ip], (err, result) => {
        release();
        if (err) {
          console.error(err);
          callback(err, null);
        } else {
          callback(null, result.rowCount > 0);
        }
      });
    });
  },
  
  getPushMessageById: function (id, ip, callback) {
    pool.connect((error, client, release) => {
      if (error) {
        console.error("Unexpected error on idle client", error);
        callback(error, null);
        return;
      }
      
      const sql = `
        SELECT id, type, title, message, action_url, is_read, created_at 
        FROM dabada_push_messages 
        WHERE id = $1 AND target_ip = $2
      `;
      
      client.query(sql, [id, ip], (err, result) => {
        release();
        if (err) {
          console.error(err);
          callback(err, null);
        } else {
          callback(null, result.rows[0]);
        }
      });
    });
  }
};