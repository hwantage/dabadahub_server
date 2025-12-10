const axios = require("axios");
const https = require("https");
const config = require("../config/baseconfig");
const dabadahubModel = require("../model/dabadahubModel");
const { supabase, BUCKET_NAME } = require("../config/supabase");

// Supabase Storage 헬퍼 함수
const storageHelper = {
  // 파일 읽기 (JSON)
  async readJsonFile(filePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      if (error.message.includes("not found") || error.message.includes("Object not found")) {
        return null; // 파일이 없으면 null 반환
      }
      throw error;
    }

    const text = await data.text();
    return JSON.parse(text);
  },

  // 파일 쓰기 (JSON)
  async writeJsonFile(filePath, jsonData) {
    const content = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([content], { type: "application/json" });

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: "application/json",
        upsert: true, // 파일이 있으면 덮어쓰기
      });

    if (error) {
      throw error;
    }

    return true;
  },
};

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
  getDabadahubConfig: async function (req, res) {
    console.log(req.connection.remoteAddress);
    const uploadPath = config.getUploadPath();
    const ip = req.connection.remoteAddress;
    console.log("Client IP:", ip);

    const filePath = `${uploadPath}dabadahub.config.json`;

    try {
      let configData = await storageHelper.readJsonFile(filePath);

      if (configData === null) {
        configData = [];
      }

      dabadahubModel.dbCountorVisitors(ip); // 방문자수 업데이트
      res.status(200).send(configData);
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },

  // 다바다허브 환경 설정 저장
  saveDabadahubConfig: async function (req, res) {
    const uploadPath = config.getUploadPath();
    const data = JSON.parse(req.query[0]);

    const filePath = `${uploadPath}dabadahub.config.json`;

    if (data.password !== "skfdkfkuxrlghlrxla") {
      return res.status(200).send("invalid password");
    }

    try {
      // JSON 데이터 파싱
      const configData = {
        ...data,
        category: JSON.parse(data.category),
        autoKeyword: JSON.parse(data.autoKeyword),
        statistics: JSON.parse(data.statistics),
      };
      delete configData.password;

      // Supabase Storage에 파일 쓰기
      await storageHelper.writeJsonFile(filePath, configData);
      res.status(200).send("success");
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },

  // 링크 저장, 수정, 삭제
  saveLink: async function (req, res) {
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
    const filePath = `${uploadPath}dabadahub.json`;

    try {
      // 파일 읽기
      let linkData = await storageHelper.readJsonFile(filePath);

      if (linkData === null) {
        linkData = [];
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

      // Supabase Storage에 파일 쓰기
      await storageHelper.writeJsonFile(filePath, linkData);
      res.status(200).send("success");
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },

  // 링크 목록 조회
  getLinkList: async function (req, res) {
    const uploadPath = config.getUploadPath();
    const filePath = `${uploadPath}dabadahub.json`;

    try {
      let linkData = await storageHelper.readJsonFile(filePath);

      if (linkData === null) {
        linkData = [];
      }

      res.status(200).send(linkData);
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },

  // 메모 저장, 수정, 삭제
  saveMemo: async function (req, res) {
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
    const filePath = `${uploadPath}dabadahub.memo.json`;

    try {
      // 파일 읽기
      let memoData = await storageHelper.readJsonFile(filePath);

      if (memoData === null) {
        memoData = [];
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

      // Supabase Storage에 파일 쓰기
      await storageHelper.writeJsonFile(filePath, memoData);

      const ip = req.connection.remoteAddress;
      !data.isDelete && dabadahubModel.dbCountorSavedresource(ip, "memo");
      res.status(200).send("success");
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },

  // 메모 목록 조회
  getMemoList: async function (req, res) {
    const uploadPath = config.getUploadPath();
    const filePath = `${uploadPath}dabadahub.memo.json`;

    try {
      let memoData = await storageHelper.readJsonFile(filePath);

      if (memoData === null) {
        memoData = [];
      }

      // 현재 시간
      const currentTime = new Date();

      // datetime 값이 3시간 이상 차이나는 데이터 제거
      const filteredMemoData = memoData.filter((memo) => {
        const memoTime = new Date(memo.datetime);
        const timeDifference = (currentTime - memoTime) / (1000 * 60 * 60); // 시간으로 변환
        return timeDifference <= 3 || !memo.autoDelete; // 3시간 이내의 데이터만 유지
      });

      // 필터링된 데이터가 원본과 다르면 저장
      if (filteredMemoData.length !== memoData.length) {
        await storageHelper.writeJsonFile(filePath, filteredMemoData);
      }

      // 정렬
      filteredMemoData.sort((a, b) => {
        return new Date(b.datetime) - new Date(a.datetime);
      });

      res.status(200).send(filteredMemoData);
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
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
    res.status(200).send("success");
  },

  getStatistics: async function (req, res) {
    let data = JSON.parse(req.params.data);
    const ip = req.connection.remoteAddress;
    data = { ...data, ip: ip };

    // config 파일에서 점수 계산 기준 조회
    const uploadPath = config.getUploadPath();
    const filePath = `${uploadPath}dabadahub.config.json`;

    try {
      let configData = await storageHelper.readJsonFile(filePath);

      if (configData === null) {
        configData = { statistics: [] };
      }

      for (const item of configData.statistics || []) {
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
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  },
};
