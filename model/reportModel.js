const config = require("../config/baseconfig");
const pool = require("./dbpool_pg");
const namedSql = require("yesql").pg; //https://github.com/pihvi/yesql

const makeCondition = (data) => {
  let condition = `and a.priority_idx  =  ANY(:priority_idx)`;

  if (data.dateType !== "all" && data.dateType !== "custom") {
    if (data.dateType === "3")
      condition += ` and a.issue_created_on >= current_timestamp + '-3 month'`;
    if (data.dateType === "6")
      condition += ` and a.issue_created_on >= current_timestamp + '-6 month'`;
    if (data.dateType === "12")
      condition += ` and a.issue_created_on >= current_timestamp + '-12 month'`;
  } else if (
    data.dateType === "custom" &&
    data.startDate !== "" &&
    data.endDate !== ""
  ) {
    condition += ` and a.issue_created_on between :startDate and :endDate`;
  }
  return condition;
};

module.exports = {
  getSummary: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;

      let sql =
        `select 
                  a.category_idx
                  , a.progress_idx
                  , a.priority_idx
                  , COUNT(*)
                  , COUNT(CASE WHEN status_idx=0 or status_idx=1 THEN 1 END) AS "대기"
                  , COUNT(CASE WHEN status_idx=2 THEN 1 END) AS "진행중"
                  , COUNT(CASE WHEN status_idx=3 THEN 1 END) AS "완료"
                from 
                  redmanager.issuelist a
                  , redmanager.workmanage b 
                where 
                  a.issue_idx=b.issue_idx 
                  and a.progress_idx=b.progress_idx
                  and a.progress_idx!=1
                  and a.deletedate is null
                  and a.issue_number != '임시'
                  ` +
        makeCondition(data) +
        `
                group by a.progress_idx, category_idx, priority_idx
                order by a.category_idx, a.progress_idx, a.priority_idx`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },

  getTrendSummary: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });
    /* parameters
          dateType: "all"|"3"|"6"|"12"|"custom"
          priority_idx: [0, 1, 2, 3]
          startDate: ""
          endDate: ""
          summaryType: "m"|"q"|"y"
          completeType: "dev"|"qa"


          -- 월별 쿼리
          select series.issue_created_on, COALESCE(count, 0) as count
	        from
	        (
	          SELECT to_char(issue_created_on, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM issue_created_on)::text)=1 THEN '0' END || EXTRACT(MONTH FROM issue_created_on) || '월' as issue_created_on
	          FROM generate_series((select issue_created_on from redmanager.issuelist where progress_idx!=1 order by issue_created_on asc limit 1)::timestamp, current_timestamp, '1 days') as issue_created_on  
	          group by to_char(issue_created_on, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM issue_created_on)::text)=1 THEN '0' END || EXTRACT(month FROM issue_created_on) || '월'
	        ) as series
	        left outer join
	        (
	          SELECT
	            to_char(issue_created_on, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM issue_created_on)::text)=1 THEN '0' END || EXTRACT(MONTH FROM issue_created_on) || '월' as issue_created_on,
	            COUNT(*) AS count
	          FROM
	            redmanager.issuelist as a
	          WHERE
	            progress_idx!=1
	          GROUP BY to_char(issue_created_on, 'YYYY'), extract(month from issue_created_on)
	        ) as data
	        on series.issue_created_on=data.issue_created_on
	        where series.issue_created_on is not null
	        order by series.issue_created_on

          -- 분기 쿼리
          select series.issue_created_on, COALESCE(count, 0) as count
          from
          (
            SELECT to_char(issue_created_on, 'YYYY') || ' ' || EXTRACT(QUARTER FROM issue_created_on) || 'Q' as issue_created_on
            FROM generate_series((select issue_created_on from redmanager.issuelist where progress_idx!=1 order by issue_created_on asc limit 1)::timestamp, current_timestamp, '1 days') as issue_created_on  
            group by to_char(issue_created_on, 'YYYY') || ' ' || EXTRACT(QUARTER FROM issue_created_on) || 'Q'
          ) as series
          left outer join
          (
            SELECT
              to_char(issue_created_on, 'YYYY') || ' ' || EXTRACT(QUARTER FROM issue_created_on) || 'Q' as issue_created_on,
              COUNT(*) AS count
            FROM
              redmanager.issuelist as a
            WHERE
              progress_idx!=1
            GROUP BY to_char(issue_created_on, 'YYYY'), extract(quarter from issue_created_on)
          ) as data
          on series.issue_created_on=data.issue_created_on
          where series.issue_created_on is not null
          order by series.issue_created_on

          -- 년 쿼리
            select series.issue_created_on, COALESCE(count, 0) as count
            from
            (
              SELECT to_char(issue_created_on, 'YYYY') || '년' as issue_created_on
              FROM generate_series((select issue_created_on from redmanager.issuelist where progress_idx!=1 order by issue_created_on asc limit 1)::timestamp, current_timestamp, '1 days') as issue_created_on  
              group by to_char(issue_created_on, 'YYYY') || '년'
            ) as series
            left outer join
            (
              SELECT
                to_char(issue_created_on, 'YYYY') || '년' as issue_created_on,
                COUNT(*) AS count
              FROM
                redmanager.issuelist as a
              WHERE
                progress_idx!=1
              GROUP BY to_char(issue_created_on, 'YYYY'), extract(year from issue_created_on)
            ) as data
            on series.issue_created_on=data.issue_created_on
            where series.issue_created_on is not null
            order by series.issue_created_on        
    */

    let seriesCondition = "",
      seriesGroupCondition = "",
      selectCondition = "",
      dateRangeCondition = "";

    if (data.summaryType === "month") {
      selectCondition = `to_char(issue_created_on, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM issue_created_on)::text)=1 THEN '0' ELSE '' END || EXTRACT(MONTH FROM issue_created_on) || '월' as issue_created_on`;
      seriesGroupCondition = ` group by to_char(issue_created_on, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM issue_created_on)::text)=1 THEN '0' ELSE '' END || EXTRACT(month FROM issue_created_on) || '월' `;
    }
    if (data.summaryType === "quarter") {
      selectCondition = `to_char(issue_created_on, 'YYYY') || ' ' || EXTRACT(QUARTER FROM issue_created_on) || 'Q' as issue_created_on`;
      seriesGroupCondition = ` group by to_char(issue_created_on, 'YYYY') || ' ' || EXTRACT(QUARTER FROM issue_created_on) || 'Q' `;
    }
    if (data.summaryType === "year") {
      selectCondition = `to_char(issue_created_on, 'YYYY') || '년' as issue_created_on`;
      seriesGroupCondition = ` group by to_char(issue_created_on, 'YYYY') || '년' `;
    }

    if (
      data.dateType === "3" ||
      data.dateType === "6" ||
      data.dateType === "12"
    ) {
      seriesCondition =
        `(current_timestamp + '-` +
        data.dateType +
        ` months')::timestamp, current_timestamp, '1 days'`;

      dateRangeCondition =
        `and issue_created_on >= (current_timestamp + '-` +
        data.dateType +
        ` months')::timestamp`;
    }
    if (data.dateType === "custom") {
      seriesCondition = `:startDate::timestamp, :endDate::timestamp, '1 days'`;
      dateRangeCondition = `and issue_created_on between :startDate::timestamp and :endDate::timestamp`;
    }
    if (data.dateType === "all") {
      seriesCondition = `(select issue_created_on from redmanager.issuelist where progress_idx!=1 order by issue_created_on asc limit 1)::timestamp, current_timestamp, '1 days'`;
      dateRangeCondition = ` `;
    }

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql =
        `
        select series.issue_created_on, COALESCE(count, 0) as count
        from
        (
          SELECT ` +
        selectCondition +
        `
          FROM generate_series(` +
        seriesCondition +
        `) as issue_created_on ` +
        seriesGroupCondition +
        `
        ) as series
        left outer join
        (
          SELECT
            ` +
        selectCondition +
        `,
            COUNT(*) AS count
          FROM 
            redmanager.issuelist as a
          WHERE 
            progress_idx!=1
            and deletedate is null
            and a.issue_number != '임시'
            and a.priority_idx  =  ANY(:priority_idx) ` +
        dateRangeCondition +
        seriesGroupCondition +
        `, extract(` +
        data.summaryType +
        ` from issue_created_on)
        ) as data
        on series.issue_created_on=data.issue_created_on
        order by series.issue_created_on
        `;
      console.log(sql);
      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },

  getTrendSummaryComplete: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });
    /* parameters
          dateType: "all"|"3"|"6"|"12"|"custom"
          priority_idx: [0, 1, 2, 3]
          startDate: ""
          endDate: ""
          summaryType: "m"|"q"|"y"
          completeType: "dev"|"qa"

          -- 분기 쿼리
          select series.completedate, COALESCE(count, 0) as count
            from
            (
              SELECT to_char(completedate, 'YYYY') || ' ' || EXTRACT(quarter FROM completedate) || 'Q' as completedate
              FROM generate_series('2021-01-01'::timestamp, '2022-03-31'::timestamp, '3 month') as completedate
            ) as series
            left outer join
            (
              SELECT
                to_char(completedate, 'YYYY') || ' ' || extract(quarter from completedate) || 'Q' as completedate,
                COUNT(*) AS count
              FROM 
                redmanager.workmanage as a
              WHERE 
                progress_idx=5
                and completedate between '2021-01-01'::timestamp and '2022-03-31'::timestamp
              GROUP BY to_char(completedate, 'YYYY'), extract(quarter from completedate)
            ) as data
            on series.completedate=data.completedate
            order by series.completedate

    */

    let seriesCondition = "",
      seriesGroupCondition = "",
      selectCondition = "",
      completeTypeValue = "5",
      dateRangeCondition = "";

    if (data.completeType === "dev") completeTypeValue = "5";
    // 개발
    else completeTypeValue = "7"; // 릴리즈

    if (data.summaryType === "month") {
      selectCondition = `to_char(completedate, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM completedate)::text)=1 THEN '0' ELSE '' END || EXTRACT(MONTH FROM completedate) || '월' as completedate`;
      seriesGroupCondition = ` group by to_char(completedate, 'YYYY') || ' ' || CASE WHEN LENGTH(EXTRACT(MONTH FROM completedate)::text)=1 THEN '0' ELSE '' END || EXTRACT(month FROM completedate) || '월' `;
    }
    if (data.summaryType === "quarter") {
      selectCondition = `to_char(completedate, 'YYYY') || ' ' || EXTRACT(QUARTER FROM completedate) || 'Q' as completedate`;
      seriesGroupCondition = ` group by to_char(completedate, 'YYYY') || ' ' || EXTRACT(QUARTER FROM completedate) || 'Q' `;
    }
    if (data.summaryType === "year") {
      selectCondition = `to_char(completedate, 'YYYY') || '년' as completedate`;
      seriesGroupCondition = ` group by to_char(completedate, 'YYYY') || '년' `;
    }

    if (
      data.dateType === "3" ||
      data.dateType === "6" ||
      data.dateType === "12"
    ) {
      seriesCondition =
        `(current_timestamp + '-` +
        data.dateType +
        ` months')::timestamp, current_timestamp, '1 days'`;

      dateRangeCondition =
        `and completedate >= (current_timestamp + '-` +
        data.dateType +
        ` months')::timestamp`;
    }
    if (data.dateType === "custom") {
      seriesCondition = `:startDate::timestamp, :endDate::timestamp, '1 days'`;
      dateRangeCondition = `and completedate between :startDate::timestamp and :endDate::timestamp`;
    }
    if (data.dateType === "all") {
      seriesCondition = `(select issue_created_on from redmanager.issuelist where progress_idx!=1 order by issue_created_on asc limit 1)::timestamp, current_timestamp, '1 days'`;
      dateRangeCondition = ` `;
    }

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql =
        `
        select series.completedate, COALESCE(count, 0) as count
        from
        (
          SELECT ` +
        selectCondition +
        `
          FROM generate_series(` +
        seriesCondition +
        `) as completedate ` +
        seriesGroupCondition +
        `
        ) as series
        left outer join
        (
          SELECT
            ` +
        selectCondition +
        `,
            COUNT(*) AS count
          FROM 
            redmanager.issuelist as a, redmanager.workmanage as b
          WHERE 
            a.issue_idx=b.issue_idx
            and a.deletedate is null
            and b.progress_idx=` +
        completeTypeValue +
        `
            and a.priority_idx  =  ANY(:priority_idx)
            and b.completedate is not null 
            and a.issue_number != '임시'
            and b.status_idx=3 ` +
        dateRangeCondition +
        seriesGroupCondition +
        `, extract(` +
        data.summaryType +
        ` from completedate)
        ) as data
        on series.completedate=data.completedate
        where series.completedate is not null
        order by series.completedate
        `;
      console.log(sql);
      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },

  get1YearIssue: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `SELECT 
          issue_idx, 
          issue_number, 
          issue_subject, 
          progress_idx, 
          priority_idx,
          issue_created_on
         FROM 
          redmanager.issuelist
         WHERE 
          issue_created_on <= current_timestamp + '-12 month' 
          and progress_idx !=1 
          and progress_idx !=6 
          and progress_idx !=7
          and deletedate is null
          and issue_number != '임시'
          and priority_idx  =  ANY(:priority_idx)
        `;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },

  get90DaysOverIssue: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `SELECT
                    a.progress_idx, count(*)
                from 
                    redmanager.issuelist a, 
                    redmanager.workmanage b
                where a.issue_idx=b.issue_idx
                    and a.progress_idx=b.progress_idx
                    and a.progress_idx!=1
                    and a.priority_idx  =  ANY(:priority_idx)
                    and a.deletedate is null
                    and a.issue_number != '임시'
                    and (b.startdate is null or b.startdate <= current_timestamp + '-90 days')
                    and b.completedate is null
                    and b.status_idx != 3
                    group by a.progress_idx
                    order by a.progress_idx
        `;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },

  getAverageTime: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `
        SELECT 
        (
          -- 개발 완료까지 평균 소요 시간 (일감 등록 일시 부터 개발 완료까지)
          select avg(b.completedate::date-a.issue_created_on::date)::int as interval
          from redmanager.issuelist a, redmanager.workmanage b
          where a.issue_idx=b.issue_idx
            and a.priority_idx  =  ANY(:priority_idx)
            and a.deletedate is null
            and a.issue_number != '임시'
            and b.progress_idx=5
            and b.status_idx=3
            and b.completedate is not null
        ) as devAverage,
        (
        -- 개발 완료 median
          select PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY resultSet.interval)::int as median FROM (
            select (b.completedate::date-a.issue_created_on::date)::int as interval
            from redmanager.issuelist a, redmanager.workmanage b
            where a.issue_idx=b.issue_idx
              and a.priority_idx  =  ANY(:priority_idx)  
              and a.deletedate is null
              and a.issue_number != '임시'
              and b.progress_idx=5
              and b.status_idx=3
              and b.completedate is not null
          ) as resultSet
        ) as devMedian,
        (
        -- 릴리즈 완료 까지 평균 소요 시간 (QA 시작 부터 릴리즈 완료까지)
          select avg(completedate::date-qastartdate::date)::int as interval
          from 
          (
            select (select startdate from redmanager.workmanage where issue_idx=b.issue_idx and progress_idx=6) as qaStartDate, completedate
            from redmanager.issuelist a, redmanager.workmanage b
            where a.issue_idx=b.issue_idx
              and a.priority_idx  =  ANY(:priority_idx)
              and a.deletedate is null
              and a.issue_number != '임시'
              and b.progress_idx=7
              and b.status_idx=3
              and b.completedate is not null
          ) as subResult
        ) as releaseAverage,
        (
          -- median
          SELECT PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY resultSet.interval)::int as median FROM (	
            select (completedate::date-qastartdate::date)::int as interval
            from 
            (
              select (select startdate from redmanager.workmanage where issue_idx=b.issue_idx and progress_idx=6) as qaStartDate, completedate
              from redmanager.issuelist a, redmanager.workmanage b
              where a.issue_idx=b.issue_idx
                and a.priority_idx  =  ANY(:priority_idx)
                and a.deletedate is null
                and a.issue_number != '임시'
                and b.progress_idx=7
                and b.status_idx=3
                and b.completedate is not null
            ) as subResult
          ) as resultSet
        ) as releaseMedian
        `;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result?.rows);
      });
    });
  },
};
