const axios = require("axios");
const https = require("https");
const fs = require("fs");
const path = require("path");
const config = require("../config/baseconfig");
const dabadahubModel = require("../model/dabadahubModel");

module.exports = {
  /* 다바다허브 API */

  // 연결 상태 체크
  checkLinkAvailability: function (req, res) {
    let url = req.query.url;
    console.log(url);

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const timeoutMs = 7000; // 7 seconds
    axios
      .get(url, {
        httpsAgent: agent,
        withCredentials: true,
        timeout: timeoutMs,
      })
      .then((response) => {
        if (response.status === 200) {
          console.log("연결상태 ok");
          res.status(200).send("ok");
        } else {
          console.log("연결상태 fail");
          res.status(404).send("fail");
        }
      })
      .catch((error) => {
        console.log("연결 에러 :", error.message);
        res.status(404).send(error.message);
      });
  },

  // 다바다허브 기본 환경 설정 조회
  getDabadahubConfig: function (req, res) {
    console.log(req.connection.remoteAddress);
    const uploadPath = config.getUploadPath();
    const ip = req.connection.remoteAddress;
    console.log("Client IP:", ip);
    const data = [];
    const filePath = path.join(uploadPath, `dabadahub.config.json`);
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          fileData = "[]";
        } else {
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let configData;
      try {
        configData = JSON.parse(fileData);

        dabadahubModel.dbCountorVisitors(ip); // 방문자수 업데이트
        //db.close();
      } catch (parseErr) {
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }

      res.status(200).send(configData);
    });
  },

  // 다바다허브 환경 설정 저장
  saveDabadahubConfig: function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = JSON.parse(req.query[0]);

    const filePath = path.join(uploadPath, `dabadahub.config.json`);

    if (data.password !== "skfdkfkuxrlghlrxla") {
      return res.status(200).send("invalid password");
    }
    let configData;
    // 파일 읽기
    fs.readFile(filePath, "utf8", (err, fileData) => {
      try {
        // JSON 데이터 파싱
        configData = {
          ...data,
          category: JSON.parse(data.category),
          autoKeyword: JSON.parse(data.autoKeyword),
          statistics: JSON.parse(data.statistics),
        };
      } catch (parseErr) {
        // JSON 파싱 오류 발생시 서버 오류 응답
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }
      delete configData.password;
      // 파일 쓰기
      fs.writeFile(
        filePath,
        JSON.stringify(configData, null, 2),
        "utf8",
        (writeErr) => {
          if (writeErr) {
            console.error(writeErr);
            return res.status(500).send(writeErr);
          }
          res.status(200).send("success");
        }
      );
    });
  },

  // 링크 저장, 수정, 삭제
  saveLink: function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = JSON.parse(req.query[0]);

    console.log(data);
    /* 
    {
      isEdit: true,
      category: '카테고리 1:개발 환경, 2:기타 리소스', // 필수
      url: '연결 주소', // 필수
      description: '설명', // 필수
      account: '로그인 아이디', // optional
      password: '로그인 비밀번호', // optional
      linkimage: '링크 확인 이미지', // optional
    } 
    */
    const filePath = path.join(uploadPath, `dabadahub.json`);

    // 파일 읽기
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          // 파일이 없으면 빈 배열로 시작
          fileData = "[]";
        } else {
          // 그 외의 오류 발생시 서버 오류 응답
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let linkData;
      try {
        // JSON 데이터 파싱
        linkData = JSON.parse(fileData);
      } catch (parseErr) {
        // JSON 파싱 오류 발생시 서버 오류 응답
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }

      if (data.isDelete) {
        const index = linkData.findIndex((item) => item.url === data.url);

        if (index !== -1) {
          linkData.splice(index, 1);
        } else {
          return res.status(500).send("삭제할 데이터가 존재하지 않습니다.");
        }
      } else if (data.isEdit) {
        const index = linkData.findIndex((item) => item.url === data.url);

        if (index !== -1) {
          linkData[index] = data;
        } else {
          return res.status(500).send("변경할 데이터가 존재하지 않습니다.");
        }
      } else {
        // 중복 확인
        let keyUrl = "";

        if (data.url.includes("loginPortalForm.sms")) {
          keyUrl =
            data.url.split("loginPortalForm.sms")[0] + "loginPortalForm.sms";
        } else if (data.url.includes("DLPCenterEDR")) {
          keyUrl = data.url.split("DLPCenterEDR")[0] + "DLPCenterEDR";
        } else if (data.url.includes("DLPCenter")) {
          keyUrl = data.url.split("DLPCenter")[0] + "DLPCenter";
        } else if (data.url.includes("/cm")) {
          keyUrl = data.url.split("/cm")[0] + "/cm";
        } else {
          keyUrl = data.url;
        }

        // 계정관리 포탈 등록시 중복 제외 처리
        const isDuplicated = linkData.some((item) => {
          const itemKeyUrl = item.url.includes("loginPortalForm.sms")
            ? item.url.split("loginPortalForm.sms")[0] + "loginPortalForm.sms"
            : item.url;
          return item.url.includes("loginPortalForm.sms")
            ? itemKeyUrl === keyUrl
            : itemKeyUrl.startsWith(keyUrl);
        });

        if (isDuplicated) {
          return res.status(200).send("url duplicated");
        }

        // 데이터 추가
        linkData.push(data);
      }

      // 파일 쓰기
      fs.writeFile(
        filePath,
        JSON.stringify(linkData, null, 2),
        "utf8",
        (writeErr) => {
          if (writeErr) {
            console.error(writeErr);
            return res.status(500).send(writeErr);
          }
          res.status(200).send("success");
        }
      );
    });
  },

  // 링크 목록 조회
  getLinkList: function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = [];
    const filePath = path.join(uploadPath, `dabadahub.json`);
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          // 파일이 없으면 빈 배열로 시작
          fileData = "[]";
        } else {
          // 그 외의 오류 발생시 서버 오류 응답
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let linkData;
      try {
        // JSON 데이터 파싱
        linkData = JSON.parse(fileData);
      } catch (parseErr) {
        // JSON 파싱 오류 발생시 서버 오류 응답
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }

      res.status(200).send(linkData);
    });
  },

  // 메모 저장, 수정, 삭제
  saveMemo: function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = JSON.parse(req.query[0]);

    console.log(data);
    /* 
    {
      isEdit: true,
      key: '고유식별번호', // 필수
      title: '제목', // 필수
      contents: '내용',
      datetime: '등록시간', // 필수
    } 
    */
    const filePath = path.join(uploadPath, `dabadahub.memo.json`);

    // 파일 읽기
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          // 파일이 없으면 빈 배열로 시작
          fileData = "[]";
        } else {
          // 그 외의 오류 발생시 서버 오류 응답
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let memoData;
      try {
        // JSON 데이터 파싱
        memoData = JSON.parse(fileData);
      } catch (parseErr) {
        // JSON 파싱 오류 발생시 서버 오류 응답
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }

      if (data.isDelete) {
        const index = memoData.findIndex((item) => item.key === data.key);
        if (index !== -1) {
          memoData.splice(index, 1);
        } else {
          return res.status(500).send("삭제할 데이터가 존재하지 않습니다.");
        }
      } else if (data.isEdit) {
        const index = memoData.findIndex((item) => item.key === data.key);
        if (index !== -1) {
          memoData[index] = data;
        } else {
          return res.status(500).send("변경할 데이터가 존재하지 않습니다.");
        }
      } else {
        // 데이터 추가
        memoData.push(data);
      }

      // 파일 쓰기
      fs.writeFile(
        filePath,
        JSON.stringify(memoData, null, 2),
        "utf8",
        (writeErr) => {
          if (writeErr) {
            console.error(writeErr);
            return res.status(500).send(writeErr);
          }
          const ip = req.connection.remoteAddress;
          !data.isDelete && dabadahubModel.dbCountorSavedresource(ip, "memo");
          res.status(200).send("success");
        }
      );
    });
  },

  // 메모 목록 조회
  getMemoList: function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = [];
    const filePath = path.join(uploadPath, `dabadahub.memo.json`);
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          // 파일이 없으면 빈 배열로 시작
          fileData = "[]";
        } else {
          // 그 외의 오류 발생시 서버 오류 응답
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let memoData;
      try {
        // JSON 데이터 파싱
        memoData = JSON.parse(fileData);
      } catch (parseErr) {
        // JSON 파싱 오류 발생시 서버 오류 응답
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }

      // 현재 시간
      const currentTime = new Date();

      // datetime 값이 3시간 이상 차이나는 데이터 제거
      memoData = memoData.filter((memo) => {
        const memoTime = new Date(memo.datetime);
        const timeDifference = (currentTime - memoTime) / (1000 * 60 * 60); // 시간으로 변환
        return timeDifference <= 3 || !memo.autoDelete; // 3시간 이내의 데이터만 유지
      });

      // 수정된 데이터를 파일에 다시 저장
      fs.writeFile(filePath, JSON.stringify(memoData), "utf8", (writeErr) => {
        if (writeErr) {
          console.error(writeErr);
          return res.status(500).send(writeErr);
        }

        memoData.sort((a, b) => {
          return new Date(b.datetime) - new Date(a.datetime);
        });
        res.status(200).send(memoData);
      });
    });
  },

  actionCountor: function (req, res) {
    const data = JSON.parse(req.query[0]);
    console.log(data);
    /* 
    { 
	    "action" : "link",  // link, memo, auth, prop
	    "url" : "https://..."  // link 일 때만 유효
    }    
    */
    const ip = req.connection.remoteAddress;
    dabadahubModel.dbCountorSavedresource(ip, data.action);
    if (data.action === "link") dabadahubModel.dbCountorTopurls(ip, data.url);
  },

  getStatistics: function (req, res) {
    let data = JSON.parse(req.params.data);
    const ip = req.connection.remoteAddress;
    data = { ...data, ip: ip };

    // config 파일에서 점수 계산 기준 조회
    const uploadPath = config.getUploadPath();

    const filePath = path.join(uploadPath, `dabadahub.config.json`);
    fs.readFile(filePath, "utf8", (err, fileData) => {
      if (err) {
        if (err.code === "ENOENT") {
          fileData = "[]";
        } else {
          console.error(err);
          return res.status(500).send(err);
        }
      }

      let configData;
      try {
        configData = JSON.parse(fileData);

        for (const item of configData.statistics) {
          if (item.action === "link") {
            data = {
              ...data,
              linkTime: item.value.time,
              linkTyping: item.value.typing,
            };
          } else if (item.action === "auth") {
            data = {
              ...data,
              authTime: item.value.time,
              authTyping: item.value.typing,
            };
          } else if (item.action === "prop") {
            data = {
              ...data,
              propTime: item.value.time,
              propTyping: item.value.typing,
            };
          } else if (item.action === "memo") {
            data = {
              ...data,
              memoTime: item.value.time,
              memoTyping: item.value.typing,
            };
          }
        }

        dabadahubModel.getStatistics(data, (rows) => {
          console.log(rows);
          res.send(JSON.stringify(rows));
        });
      } catch (parseErr) {
        console.error(parseErr);
        return res.status(500).send(parseErr);
      }
    });
  },
};
