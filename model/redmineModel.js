const Redmine = require("node-redmine");
const fs = require("fs");
const config = require("../config/baseconfig");

const redmine = new Redmine(config.getHost(), config.getAccount());
const createredmine = new Redmine(config.getHost(), config.getCreaterAccount());

module.exports = {
  getRedmineIssueList: function (callback) {
    redmine.issues({ limit: 10, assigned_to_id: 519 }, function (err, data) {
      if (err) console.log(err);
      callback(data);
    });
  },

  getRedmineIssueById: function (id, callback) {
    //var params = {include: 'attachments,journals,watchers'};
    var params = null;
    redmine.get_issue_by_id(Number(id), params, function (err, data) {
      if (err) console.log(err);
      callback(data);
    });
  },

  getRedmineProjectList: function (callback) {
    redmine.projects(
      { include: "trackers, issue_categories, enabled_modules" },
      function (err, data) {
        if (err) console.log(err);
        callback(data);
      }
    );
  },

  // 이슈 생성
  /* 
    var issue = {
      issue: {
        project_id: state.project_id,
        subject: state.subject,
        assigned_to_id: state.assigned_to_id,
        description: state.description,
        due_date: state.due_date,
        author: "183", // 등록자 김정환 => 안먹힘. ㅠ.ㅠ 강병균이 등록자되 됨.
        priority: "2", // 우선순위:보통
        status: "1", // 신규
        custom_fields: [{ value: "내부 개발", id: 13 }],
      }
    };
  */
  createRedmineIssue: function (issue, callback) {
    /*
    var dummyresult = {
      issue: {
        id: 179267,
        project: {
          id: 151,
          name: "DLP+ Center 2.0 (2014-03)",
        },
        tracker: {
          id: 4,
          name: "기능요청",
        },
        status: {
          id: 1,
          name: "신규",
        },
        priority: {
          id: 2,
          name: "보통",
        },
        author: {
          id: 233,
          name: "강병균",
        },
        assigned_to: {
          id: 183,
          name: "김정환",
        },
        subject: "test",
        description: "test\r\n\r\n실험",
        start_date: "2022-09-16",
        due_date: "2022-09-16",
        done_ratio: 10,
        is_private: false,
        estimated_hours: null,
        total_estimated_hours: null,
        custom_fields: [
          {
            id: 5,
            name: "관계자",
            multiple: true,
            value: [],
          },
          {
            id: 6,
            name: "개발담당",
            value: null,
          },
        ],
        created_on: "2022-09-16T10:03:10Z",
        updated_on: "2022-09-16T10:03:10Z",
        closed_on: null,
      },
    };
    //callback(dummyresult);
    */

    // /upload/redmine 폴더에 업로드 되어 있는 파일을 레드마인에 업로드
    const uploadPath = config.getUploadPath() + "redmine/";
    let uploadedFiles = [];

    fs.readdir(uploadPath, function (error, filelist) {
      let fcount = filelist.length;

      if (fcount > 0) {
        filelist.forEach((fileName) => {
          const content = fs.readFileSync(uploadPath + fileName);
          createredmine.upload(content, function (err, data) {
            if (err) console.log(err);
            uploadedFiles.push({
              token: data.upload.token,
              filename: fileName,
            });

            fs.unlinkSync(uploadPath + fileName, { recursive: false }); // 업로드 완료된 파일 삭제

            // 마지막 파일이 업로드되면 create_issue 메소드 호출
            if (--fcount === 0) {
              issue = { issue: { ...issue.issue, uploads: uploadedFiles } }; // 업로드할 json 에 파일 목록 추가

              createredmine.create_issue(issue, function (err, data) {
                if (err) {
                  console.log(err);
                  callback(err);
                } else {
                  console.log(data);
                  callback(data);
                }
              });
            }
          });
        });
      } else {
        createredmine.create_issue(issue, function (err, data) {
          if (err) {
            console.log(err);
            callback(err);
          } else {
            console.log(data);
            callback(data);
          }
        });
      }
    });
  },

  // 삭제 기능은 UI에서 구현하지 않았음.
  deleteIssue: function (id, callback) {
    redmine.delete_issue(Number(id), function (err, data) {
      if (err) console.log(err);
      callback(data);
    });
  },

  // 사용자 목록 조회
  getRedmineUserList: function (callback) {
    return getUsers(0, null, callback);
  },

  // 특정 사용자 정보 조회 (사용안함 -> 필요시 활용할 것)
  /* parameters:
      include (optional): a comma separated list of associations to include in the response:
        memberships : adds extra information about user's memberships and roles on the projects
        groups (added in 2.1) : adds extra information about user's groups
  */
  getRedmineUser: async function (id, callback) {
    redmine.get_user_by_id(
      Number(id),
      { include: "memberships,groups" },
      function (err, data) {
        if (err) console.log(err);
        callback(data);
      }
    );
  },

  // 사용자 정보 업데이트
  // status는 변경되지만 {"ErrorCode":204,"Message":"No Content"} 에러가 발생함.
  /* http://redmine.somansa.com/redmine/users/519.json
    var user = {
      user: {
        login: 'aaa',
        firstname: 'bbb',
        lastname: 'ccc',
        mail: 'ddd@ddd.com',
        password: 'password',
        status: '3'
      }
    };
  */
  setRedmineUser: async function (id, callback) {
    const user = {
      user: {
        status: 3,
      },
    };
    redmine.update_user(Number(id), user, function (err, data) {
      if (err) console.log(err);
      callback(data);
    });
  },
};

// redmine 사용자 정보 조회 (페이징 처리) http://redmine.somansa.com/redmine/users.json?limit=100&group_id=270
/* Optional filters:
    status: get only users with the given status. See app/models/principal.rb for a list of available statuses. Supply an empty value to match all users regardless of their status. Default is 1 (active users). Possible values are:
      1: Active (User can login and use their account)
      2: Registered (User has registered but not yet confirmed their email address or was not yet activated by an administrator. User can not login)
      3: Locked (User was once active and is now locked, User can not login)
    name: filter users on their login, firstname, lastname and mail ; if the pattern contains a space, it will also return users whose firstname match the first word or lastname match the second word.
    group_id: get only users who are members of the given group
  */
const getUsers = function (offset, mergedData, callback) {
  redmine.users(
    { status: 1, group_id: 270, limit: 100, offset: offset }, // 파라미터 전달. limit 은 최대가 100개임., group_id: 270(ux기획팀)
    function (err, data) {
      // redmine 결과 Callback 처리
      if (err) console.log(err);
      if (mergedData === null) mergedData = data; // 처음이면 객체 그대로 할당
      else {
        const mergedUser = mergedData.users.concat(data.users); // 두 번째 부터 사용자 정보만 병합
        mergedData.users = mergedUser; // mergedData 에 병합된 사용자 정보로 치환
      }
      offset += 100; // offset 증가
      if (data) {
        if (offset > data.total_count) {
          callback(mergedData); // offset 이 총 개수보다 커지면 부모의 callback 함수로 mergedData 전달
        } else {
          getUsers(offset, mergedData, callback); // offset 까지 도달 안했으면 재귀 호출
        }
      } else {
        callback(mergedData); // offset 이 총 개수보다 커지면 부모의 callback 함수로 mergedData 전달
      }
    }
  );
};
/*****************/
/*redmine API 호출 리스트*/
/*****************/
/*
issues //이슈리스트
get_issue_by_id // 이슈 id로 찾기
create_issue // 이슈 생성
update_issue // 이슈 수정
delete_issue // 이수 삭제
add_watcher // 감시자 추가
remove_watcher // 감시자 삭제
projects // 프로젝트 리스트
get_project_by_id //프로젝트 id로 찾기
create_project // 프로젝트 생성
update_project //프로젝트 수정
delete_project //프로젝트 삭제
users //사용자 리스트
get_user_by_id // 사용자 아이디로 찾기
current_user // 뭔지모름
create_user // 유저생성
update_user //유저 수정
delete_user //유저 삭제

등등.. 자세한 정보는
D:\redManager\redManager\server\node_modules\node-redmine\lib\redmine.js 참조

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
