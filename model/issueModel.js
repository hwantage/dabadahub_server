const config = require("../config/baseconfig");
const pool = require("./dbpool_pg");
const namedSql = require("yesql").pg; //https://github.com/pihvi/yesql

makeFilteredQuery = (data) => {
  let sql = "";
  if (data?.product_idx != undefined && data?.product_idx != "")
    sql += ` AND a.product_idx  =  ANY(:product_idx)`;
  if (data?.category_idx != undefined && data?.category_idx != "")
    sql += ` AND a.category_idx  =  ANY(:category_idx)`;
  if (data?.priority_idx != undefined && data?.priority_idx != "")
    sql += ` AND a.priority_idx  =  ANY(:priority_idx)`;
  if (data?.progress_idx != undefined && data?.progress_idx != "")
    sql += ` AND a.progress_idx  =  ANY(:progress_idx)`;
  if (data?.status_idx != undefined && data?.status_idx != "")
    sql += ` AND b.status_idx  =  ANY(:status_idx)`;
  if (data?.issue_status != undefined && data?.issue_status != "")
    sql += ` AND a.issue_status  =  ANY(:issue_status)`;
  if (data?.issue_subject != undefined && data?.issue_subject != "")
    sql += ` AND (a.issue_subject ilike '%' || :issue_subject || '%' or a.issue_assigned_to ilike '%' || :issue_subject || '%')`;
  if (data?.issue_number != undefined && data?.issue_number != "")
    sql += ` AND a.issue_number like '%' || :issue_number || '%'`;
  if (data?.issue_startDate != undefined && data?.issue_startDate != "")
    sql += ` AND a.issue_created_on > :issue_startDate`;
  if (data?.issue_endDate != undefined && data?.issue_endDate != "")
    sql += ` AND a.issue_created_on < :issue_endDate`;
  if (
    data?.is_updated != undefined &&
    data?.is_updated != "" &&
    data?.is_updated == true
  )
    sql += ` AND a.is_updated = :is_updated`;
  if (data?.issue_tag != undefined && data?.issue_tag != "")
    sql += ` AND a.issue_tag  =  ANY(:issue_tag)`;

  if (
    data?.syncFlag != undefined &&
    data?.syncFlag != "" &&
    data?.syncFlag == true
  )
    sql += ` AND a.issue_number !=   '임시'`;
  return sql;
};

module.exports = {
  getIssueList: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `select 
                      a.issue_idx, 
                      a.issue_color,
                      a.issue_tag,
                      a.issue_number,
                      a.issue_subject,
                      a.issue_status,
                      a.issue_assigned_to,
                      a.memo,
                      a.progress_idx,
                      a.product_idx,
                      a.category_idx,
                      a.priority_idx,
                      a.delaycount,
                      a.is_updated,
                      a.syncdate,
                      a.createdate,
                      a.issue_created_on,
                      b.status_idx, 
                      b.startdate, 
                      b.completedate,
                      (SELECT COALESCE(json_agg(json_build_object(
                        'issue_idx', issue_idx,
                        'progress_idx', progress_idx,
                        'status_idx', status_idx,
                        'startdate', startdate,
                        'completedate', completedate
                        )) , '[]') from redmanager.workmanage where issue_idx=a.issue_idx) as "workflow" 
                    from redmanager.issuelist a inner join redmanager.workmanage b 
                    on a.issue_idx = b.issue_idx and a.progress_idx = b.progress_idx `;
      sql += ` where 1=1 and deletedate is null`;
      sql += makeFilteredQuery(data);
      // Ordering
      if (data?.order != undefined && data?.order != "") {
        if (data.order === "ascend") sql += ` order by ` + data.field + ` asc`;
        // SQL function arguments can only be used as data values, not as identifiers
        else if (data.order === "descend")
          sql += ` order by ` + data.field + ` desc`;
      } else {
        // Default order
        sql += ` order by a.createdate desc`;
      }
      // Paging
      if (data?.page_size != undefined && data?.page_size != "") {
        sql += ` limit :page_size offset (:page_current-1)*:page_size`;
      }

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

  getIssueListCount: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `select sum(progresscount)::integer as totalcount, 
                      SUM(CASE WHEN result.progress_idx = 1 THEN progresscount ELSE 0 END)::integer as "1",
                      SUM(CASE WHEN result.progress_idx = 2 THEN progresscount ELSE 0 END)::integer as "2",
                      SUM(CASE WHEN result.progress_idx = 3 THEN progresscount ELSE 0 END)::integer as "3",
                      SUM(CASE WHEN result.progress_idx = 4 THEN progresscount ELSE 0 END)::integer as "4",
                      SUM(CASE WHEN result.progress_idx = 5 THEN progresscount ELSE 0 END)::integer as "5",
                      SUM(CASE WHEN result.progress_idx = 6 THEN progresscount ELSE 0 END)::integer as "6",
                      SUM(CASE WHEN result.progress_idx = 7 THEN progresscount ELSE 0 END)::integer as "7"
                   from (select a.progress_idx, count(*)  as progresscount from redmanager.issuelist a, redmanager.workmanage b  
                         where a.issue_idx=b.issue_idx and a.progress_idx=b.progress_idx`;
      sql += makeFilteredQuery(data);
      sql += ` and deletedate is null`;
      sql += ` group by a.progress_idx) as result`;

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

  // 일감 등록
  addNewIssue: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = ``;
      if (data?.issue_number === undefined || data?.issue_number === "") {
        // 임시 일감 등록
        sql = `INSERT INTO redmanager.issuelist(issue_subject) values(:issue_subject)  returning issue_idx`;
      } else {
        // 기존 레드마인 일감 등록
        //sql =  `insert into redmanager.issuelist(issue_number, issue_subject, issue_status, issue_assigned_to) values(:issue_number, :issue_subject, :issue_status, :issue_assigned_to)`;
        sql = `INSERT INTO redmanager.issuelist(issue_number, issue_subject, issue_status, issue_assigned_to, issue_created_on)
                SELECT :issue_number, :issue_subject, :issue_status, :issue_assigned_to, :issue_created_on 
                    FROM redmanager.issuelist
                    WHERE NOT EXISTS (
                        SELECT 'X' 
                        FROM redmanager.issuelist
                        WHERE 
                            issue_number=:issue_number
                    ) limit 1 returning issue_idx`; // Insert 수행 후 입력된 issue_idx 반환 처리
      }
      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        if (result.rowCount > 0) {
          var sql =
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            ` ,1);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,2);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,3);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,4);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,5);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,6);`;
          sql +=
            `insert into redmanager.workmanage(issue_idx, progress_idx) values(` +
            result.rows[0].issue_idx +
            `  ,7);`;
          if (config.getDebugMode()) console.log(sql);
          client.query(sql, function (error, result_sub) {
            release();
            if (error) console.log(error);
            callback(result); // 부모 Result 결과 전달.
          });
        } else {
          release();
          if (error) console.log(error);
          callback(result);
        }
      });
    });
  },

  // 저장된 필터 조회
  getSavedFilterList: function (callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `select 
                      filter_idx, 
                      filter_name,
                      filter_content,
                      isdefaultfilter
                    from redmanager.savedfilter order by filter_idx `;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result.rows);
      });
    });
  },

  // 새 카테고리 저장
  addCategory: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `insert into redmanager.categoryInfo(category_idx, category_name) values((select max(category_idx)+1 from redmanager.categoryinfo), :category_name)`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },
  // 카테고리 이름 변경
  updateCategory: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `update redmanager.categoryInfo set category_name=:category_name where category_idx = :category_idx`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },

  // 새 필터 저장
  addSavedFilter: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `insert into redmanager.savedfilter(filter_name, filter_content, isdefaultfilter) values(:filter_name, :filter_content, '0')`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },

  // 필터 삭제
  deleteSavedFilter: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `delete from redmanager.savedfilter where filter_idx=$1`;

      client.query(sql, [data], function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },

  // Default 필터
  updateDefaultFilter: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `update redmanager.savedfilter set isdefaultfilter=0`;
      client.query(sql, function (error, result) {
        if (error) {
          console.log(error);
        }
      });

      sql = `update redmanager.savedfilter set isdefaultfilter=:isdefaultfilter where filter_idx=:filter_idx`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);
      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },

  updateIssue: function (data, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `UPDATE redmanager.issuelist SET`;
      sql += ` updatedate = now()`;

      if (data?.issue_color != undefined) sql += `, issue_color = :issue_color`;
      if (data?.issue_tag != undefined) sql += `, issue_tag = :issue_tag`;
      if (data?.issue_number != undefined)
        sql += `, issue_number = :issue_number`;
      if (data?.issue_subject != undefined)
        sql += `, issue_subject = :issue_subject`;
      if (data?.issue_status != undefined)
        sql += `, issue_status = :issue_status`;
      if (data?.issue_assigned_to != undefined)
        sql += `, issue_assigned_to = :issue_assigned_to`;
      if (data?.product_idx != undefined) sql += `, product_idx = :product_idx`;
      if (data?.category_idx != undefined)
        sql += `, category_idx = :category_idx`;
      if (data?.priority_idx != undefined)
        sql += `, priority_idx = :priority_idx`;
      if (data?.progress_idx != undefined)
        sql += `, progress_idx = :progress_idx`;
      if (data?.delaycount != undefined) sql += `, delaycount = :delaycount`;
      if (data?.memo != undefined) sql += `, memo = :memo`;
      if (data?.is_syncdate_update == true) sql += `, syncdate = now()`;

      if (data?.is_updated == true) sql += `, is_updated = true`;
      else sql += `, is_updated = false`;

      sql += ` WHERE issue_idx = :issue_idx`;

      const mappedSql = namedSql(sql)(data);
      if (config.getDebugMode()) console.log(mappedSql);

      client.query(mappedSql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },

  // 태그 필터 목록 조회
  getTagList: function (callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `select 
                      distinct
                      issue_tag || '(' || count(*) || ')' as label,
                      issue_tag as value, 
                      count(*) as count
                    from 
                      redmanager.issuelist 
                    where 
                      issue_tag<>'' 
                      and issue_tag is not null 
                      and deletedate is null
                    group by issue_tag`;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result.rows);
      });
    });
  },

  // 카테고리 목록 조회
  getCategoryList: function (callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `select 
                      category_name  
                    from 
                      redmanager.categoryInfo 
                    order by 
                      category_idx`;
      if (config.getDebugMode()) console.log(sql);
      client.query(sql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result.rows);
      });
    });
  },

  // 이슈 삭제 처리
  deleteIssue: function (issue_idx, callback) {
    pool.on("error", (error) => {
      console.log("Unexpected error on idle client", error);
      callback("Unexpected error on idle client");
    });

    pool.connect(function (error, client, release) {
      if (error) throw error;
      let sql = `UPDATE redmanager.issuelist SET deletedate = now()`;
      sql += ` WHERE issue_idx = '` + issue_idx + `'`;
      client.query(sql, function (error, result) {
        release();
        if (error) {
          console.log(error);
        }
        callback(result);
      });
    });
  },
};
