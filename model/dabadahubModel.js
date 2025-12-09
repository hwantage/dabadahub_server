const config = require("../config/baseconfig");
const pool = require("./dbpool_pg");
const namedSql = require("yesql").pg; //https://github.com/pihvi/yesql

const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 월을 두 자리수로 변환
  return year + month;
};

module.exports = {
  // 방문객 카운터
  dbCountorVisitors: function (ip) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      const currentDate = getCurrentDate();

      const sql = `INSERT INTO redmanager.dabada_visitors (date, ip, cnt) VALUES ('${currentDate}', '${ip}', 1) ON CONFLICT (date, ip) DO UPDATE SET cnt = dabada_visitors.cnt + 1`;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) console.log(error);
      });
    });
  },

  // 액션 카운터 저장
  dbCountorSavedresource: function (ip, action) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      // 현재 날짜를 가져옴
      const currentDate = getCurrentDate();

      const sql = `INSERT INTO redmanager.dabada_savedresource (date, ip, action, cnt) VALUES ('${currentDate}', '${ip}', '${action}', 1) ON CONFLICT (date, ip, action) DO UPDATE SET cnt = dabada_savedresource.cnt + 1`;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) console.log(error);
      });
    });
  },

  // Top Url 저장
  dbCountorTopurls: function (ip, url) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      // 현재 날짜를 가져옴
      const currentDate = getCurrentDate();
      const sql = `INSERT INTO redmanager.dabada_topurls (date, ip, url, cnt) VALUES ('${currentDate}', '${ip}', '${url}', 1) ON CONFLICT (date, ip, url) DO UPDATE SET cnt = dabada_topurls.cnt + 1`;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) console.log(error);
      });
    });
  },

  getStatistics: function (data, callback) {
    console.log(data);
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = ``;
      if (data.type === "private") {
        sql = `select 
        (select :ip) as myip,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_visitors where date = :date and ip = :ip) as visit_cnt,
        (select count(*) from redmanager.dabada_visitors where date = :date and ip = :ip) as active_cnt,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='auth' and ip = :ip) * :authTime as time_cnt_auth,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='link' and ip = :ip) * :linkTime as time_cnt_link,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='prop' and ip = :ip) * :propTime as time_cnt_prop,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='memo' and ip = :ip) * :memoTime as time_cnt_memo,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='auth' and ip = :ip) * :authTyping as typing_cnt_auth,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='link' and ip = :ip) * :linkTyping as typing_cnt_link,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='prop' and ip = :ip) * :propTyping as typing_cnt_prop,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='memo' and ip = :ip) * :memoTyping as typing_cnt_memo,
        (select json_build_object(
                'date', json_agg(to_char(to_date(a.date, 'YYYYMM'), 'YYYY"년"MM"월"')),
                'time', json_agg(a.time_cnt),
                'typing', json_agg(a.typing_cnt)
            )
        from (
          SELECT * FROM (
            SELECT
                date,
                SUM(CASE WHEN a.action = 'link' THEN cnt ELSE 0 END) * :linkTime +
                SUM(CASE WHEN a.action = 'auth' THEN cnt ELSE 0 END) * :authTime +
                SUM(CASE WHEN a.action = 'prop' THEN cnt ELSE 0 END) * :propTime +
                SUM(CASE WHEN a.action = 'memo' THEN cnt ELSE 0 END) * :memoTime AS time_cnt,
                SUM(CASE WHEN a.action = 'link' THEN cnt ELSE 0 END) * :linkTyping +
                SUM(CASE WHEN a.action = 'auth' THEN cnt ELSE 0 END) * :authTyping +
                SUM(CASE WHEN a.action = 'prop' THEN cnt ELSE 0 END) * :propTyping +
                SUM(CASE WHEN a.action = 'memo' THEN cnt ELSE 0 END) * :memoTyping  AS typing_cnt
            FROM
                redmanager.dabada_savedresource a
            WHERE 
                date <= :date and ip = :ip
            GROUP BY
                date
            order by date desc
            limit 6
          ) t order by date asc
        ) a) as trend,
        (select json_agg(json_build_object(
              'seq', a.seq,
              'url', a.url,
              'cnt', a.cnt
              ))
          from
          (select ROW_NUMBER() OVER (ORDER BY sum(cnt) DESC) as seq, url, sum(cnt) as cnt 
            from redmanager.dabada_topurls
            where date = :date and ip = :ip
            group by date, url order by sum(cnt) desc) a
        ) as topurls`;
      } else {
        sql = `select 
        (select :ip) as myip,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_visitors where date = :date) as visit_cnt,
        (select count(*) from redmanager.dabada_visitors where date = :date) as active_cnt,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='auth') * :authTime as time_cnt_auth,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='link') * :linkTime as time_cnt_link,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='prop') * :propTime as time_cnt_prop,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='memo') * :memoTime as time_cnt_memo,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='auth') * :authTyping as typing_cnt_auth,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='link') * :linkTyping as typing_cnt_link,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='prop') * :propTyping as typing_cnt_prop,
        (select COALESCE(sum(cnt), 0) from redmanager.dabada_savedresource where date = :date and action='memo') * :memoTyping as typing_cnt_memo,
        (select json_build_object(
                'date', json_agg(to_char(to_date(a.date, 'YYYYMM'), 'YYYY"년"MM"월"')),
                'time', json_agg(a.time_cnt),
                'typing', json_agg(a.typing_cnt)
            )
        from (
          SELECT * FROM (
            SELECT
                date,
                SUM(CASE WHEN a.action = 'link' THEN cnt ELSE 0 END) * :linkTime +
                SUM(CASE WHEN a.action = 'auth' THEN cnt ELSE 0 END) * :authTime +
                SUM(CASE WHEN a.action = 'prop' THEN cnt ELSE 0 END) * :propTime +
                SUM(CASE WHEN a.action = 'memo' THEN cnt ELSE 0 END) * :memoTime AS time_cnt,
                SUM(CASE WHEN a.action = 'link' THEN cnt ELSE 0 END) * :linkTyping +
                SUM(CASE WHEN a.action = 'auth' THEN cnt ELSE 0 END) * :authTyping +
                SUM(CASE WHEN a.action = 'prop' THEN cnt ELSE 0 END) * :propTyping +
                SUM(CASE WHEN a.action = 'memo' THEN cnt ELSE 0 END) * :memoTyping  AS typing_cnt
            FROM
                redmanager.dabada_savedresource a
            WHERE 
                date <= :date
            GROUP BY
                date
            order by date desc
            limit 6
          ) t order by date asc
        ) a) as trend,
        (select json_agg(json_build_object(
              'seq', a.seq,
              'url', a.url,
              'cnt', a.cnt
              ))
          from
          (select ROW_NUMBER() OVER (ORDER BY sum(cnt) DESC) as seq, url, sum(cnt) as cnt 
            from redmanager.dabada_topurls
            where date = :date
            group by date, url order by sum(cnt) desc) a
        ) as topurls`;
      }

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result.rows);
      });
    });
  },
};
