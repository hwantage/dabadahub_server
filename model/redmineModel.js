const Redmine = require("node-redmine");
const config = require("../config/baseconfig");
const { supabase, BUCKET_NAME } = require("../config/supabase");

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
  createRedmineIssue: async function (issue, callback) {
    const uploadPath = config.getUploadPath() + "redmine/";
    let uploadedFiles = [];

    try {
      // Supabase Storage에서 파일 목록 조회
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(uploadPath);

      if (listError) {
        console.error("파일 목록 조회 오류:", listError);
        // 오류가 있어도 이슈 생성은 진행
        createredmine.create_issue(issue, function (err, data) {
          if (err) {
            console.log(err);
            callback(err);
          } else {
            console.log(data);
            callback(data);
          }
        });
        return;
      }

      // 실제 파일만 필터링 (폴더나 placeholder 제외)
      const files = (fileList || []).filter(
        (item) => item.name && item.name !== ".emptyFolderPlaceholder"
      );

      if (files.length > 0) {
        let fcount = files.length;

        for (const file of files) {
          const filePath = `${uploadPath}${file.name}`;

          // Supabase Storage에서 파일 다운로드
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filePath);

          if (downloadError) {
            console.error("파일 다운로드 오류:", downloadError);
            fcount--;
            continue;
          }

          // Blob을 Buffer로 변환
          const arrayBuffer = await fileData.arrayBuffer();
          const content = Buffer.from(arrayBuffer);

          // Redmine에 파일 업로드
          createredmine.upload(content, function (err, data) {
            if (err) {
              console.log(err);
              fcount--;
              return;
            }

            uploadedFiles.push({
              token: data.upload.token,
              filename: file.name,
            });

            // Supabase Storage에서 파일 삭제
            supabase.storage
              .from(BUCKET_NAME)
              .remove([filePath])
              .then(({ error: deleteError }) => {
                if (deleteError) {
                  console.error("파일 삭제 오류:", deleteError);
                }
              });

            // 마지막 파일이 업로드되면 create_issue 메소드 호출
            if (--fcount === 0) {
              issue = { issue: { ...issue.issue, uploads: uploadedFiles } };

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
        }
      } else {
        // 업로드할 파일이 없으면 바로 이슈 생성
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
    } catch (err) {
      console.error("이슈 생성 중 오류:", err);
      callback(err);
    }
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
