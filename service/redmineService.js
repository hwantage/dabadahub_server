const redmineModel = require("../model/redmineModel");
const issueModel = require("../model/issueModel");

module.exports = {
  getRedmineIssueList: function (req, res) {
    redmineModel.getRedmineIssueList((result) => {
      res.send(JSON.stringify(result));
    });
  },

  getRedmineIssueById: function (req, res) {
    redmineModel.getRedmineIssueById(req.params.id, (result) => {
      res.send(JSON.stringify(result));
    });
  },

  getRedmineProjectList: function (req, res) {
    /*
    var result = {
      projects: [
        {
          id: 116,
          name: "[HyBoost]",
        },
      ],
      total_count: 74,
      offset: 0,
      limit: 25,
    };
    res.send(JSON.stringify(result));
    */
    redmineModel.getRedmineProjectList((result) => {
      res.send(JSON.stringify(result));
    });
  },

  getRedmineUserList: function (req, res) {
    /*
    var result = {
      users: [
        { id: 116, firstname: "홍길동" },
        { id: 112, firstname: "이순신" },
      ],
      total_count: 74,
      offset: 0,
      limit: 25,
    };
    res.send(JSON.stringify(result));
    */
    redmineModel.getRedmineUserList((result) => {
      res.send(JSON.stringify(result));
    });
  },

  createRedmineIssue: function (req, res) {
    let issue = JSON.parse(req.query[0]);
    redmineModel.createRedmineIssue(issue, (result) => {
      // 결과 성공시 디비에 일감 정보 저장
      if (result.hasOwnProperty("issue")) {
        const jsonData = {
          issue_number: result.issue.id,
          issue_subject: result.issue.subject,
          issue_status: result.issue.status.name,
          issue_assigned_to: result.issue.assigned_to.name,
          issue_created_on: result.issue.created_on,
        };

        issueModel.addNewIssue(jsonData, (rows) => {
          res.send(JSON.stringify(result));
        });
      } else {
        res.send(JSON.stringify(result));
      }
    });
  },

  // 일감 전체 동기화
  syncAllIssue: function (req, res) {
    let total = 0;
    let updated = 0;
    // issueService 를 통해 전체 일감 번호 목록 조회
    const data = { syncFlag: true }; // 임시 인 일감을 제외하도록 플래그 세팅
    issueModel.getIssueList(data, (rows) => {
      total = Array.from(rows).length;
      // for문으로 루프 돌면서 일감 하나씩 조회
      Array.from(rows).map((row, index) => {
        // redmine 조회
        redmineModel.getRedmineIssueById(row.issue_number, (result) => {
          console.log(result);
          if (result !== undefined) {
            // 변경된 내용이 있는지 비교
            if (
              row.issue_status !== result.issue.status.name ||
              row.issue_assigned_to !== result.issue.assigned_to.name ||
              row.issue_subject !== result.issue.subject
            ) {
              // 변경이 되었다면 issueService를 통해 업데이트 처리
              const jsonData = {
                issue_idx: row.issue_idx,
                issue_subject: result.issue.subject,
                issue_status: result.issue.status.name,
                issue_assigned_to: result.issue.assigned_to.name,
                is_updated: true,
                is_syncdate_update: true,
              };
              console.log(jsonData);
              issueModel.updateIssue(jsonData, (result) => {
                updated++;
              });
            }
          }
        });
      });

      // 수행 결과 리턴. (전체 대상과 업데이트된 개수) 다음 코드 참고하여 수정 필요.  https://flaviocopes.com/javascript-async-await-array-map/
      let result = { total: total, updated: updated };
      res.send(JSON.stringify(result));
    });
  },
};
/*
{
    issue: {
      id: 161616,
      project: { id: 55, name: '[QA2Team]' },
      tracker: { id: 5, name: '시험요청' },
      status: { id: 9, name: '배포준비중' },
      priority: { id: 2, name: '보통' },
      author: { id: 153, name: '박중환' },
      assigned_to: { id: 372, name: '김연효' },
      fixed_version: { id: 254, name: 'Privacy-i 6.0' },
      subject: '[P6.0][KB카드] USB Mobile 예외요청 API 개발 요청의 건. ',
      description: '*1. 제품/버젼(빌드버젼또는수정날짜) :* P6.0\r\n' ',
      start_date: '2019-12-23',
      due_date: '2020-01-31',
      done_ratio: 100,
      spent_hours: 0,
      custom_fields: [
        [Object], [Object],
        [Object], [Object],
        [Object], [Object],
        [Object], [Object],
        [Object], [Object],
        [Object], [Object],
        [Object], [Object],
        [Object], [Object]
      ],
      created_on: '2020-01-22T06:48:37Z',
      updated_on: '2020-05-08T08:31:51Z'
    }
  }

*/
