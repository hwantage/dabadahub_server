const config = require("../config/baseconfig");
const issueModel = require("../model/issueModel");
const { supabase, BUCKET_NAME } = require("../config/supabase");

module.exports = {
  getIssueList: function (req, res) {
    let data = JSON.parse(req.query[0]);
    issueModel.getIssueList(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getIssueListCount: function (req, res) {
    let data = JSON.parse(req.query[0]);
    issueModel.getIssueListCount(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  addNewIssue: function (req, res) {
    let data = JSON.parse(req.query[0]);
    issueModel.addNewIssue(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getSavedFilterList: function (req, res) {
    issueModel.getSavedFilterList((rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  addCategory: function (req, res) {
    //let data = JSON.parse(req.params.data);
    let data = JSON.parse(req.query[0]);
    issueModel.addCategory(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  updateCategory: function (req, res) {
    //let data = JSON.parse(req.params.data);
    let data = JSON.parse(req.query[0]);
    issueModel.updateCategory(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  addSavedFilter: function (req, res) {
    //let data = JSON.parse(req.params.data);
    let data = JSON.parse(req.query[0]);
    issueModel.addSavedFilter(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  deleteSavedFilter: function (req, res) {
    issueModel.deleteSavedFilter(req.params.data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  updateDefaultFilter: function (req, res) {
    let data = JSON.parse(req.params.data);
    issueModel.updateDefaultFilter(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getTagList: function (req, res) {
    issueModel.getTagList((rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getCategoryList: function (req, res) {
    issueModel.getCategoryList((rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  updateIssue: function (req, res) {
    let data = JSON.parse(req.query[0]);
    issueModel.updateIssue(data, (rows) => {
      console.log(rows);
      res.send(JSON.stringify(rows));
    });
  },

  deleteIssue: function (req, res) {
    issueModel.deleteIssue(req.params.issue_idx, (rows) => {
      console.log(rows);
      res.send(JSON.stringify(rows));
    });
  },

  // Supabase Storage를 이용한 파일 목록 조회
  getFileList: async function (req, res) {
    const folderPath = `issues/${req.params.data}`;

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath);

      if (error) {
        console.error("파일 목록 조회 오류:", error);
        return res.send(JSON.stringify([]));
      }

      // 파일 이름만 추출
      const fileList = data
        .filter((item) => item.name !== ".emptyFolderPlaceholder")
        .map((item) => item.name);

      res.send(JSON.stringify(fileList));
    } catch (err) {
      console.error("파일 목록 조회 중 오류:", err);
      res.send(JSON.stringify([]));
    }
  },

  // Supabase Storage를 이용한 파일 삭제
  fileDelete: async function (req, res) {
    let data = JSON.parse(req.query[0]);
    const filePath = `issues/${data.issue_idx}/${data.fileName}`;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error("파일 삭제 오류:", error);
        return res.send({
          status: "fail",
          message: error.message,
          data: {
            name: data.fileName,
            issue_idx: data.issue_idx,
          },
        });
      }

      console.log("파일 삭제 완료:", filePath);
      res.send({
        status: "success",
        message: "File is deleted",
        data: {
          name: data.fileName,
          issue_idx: data.issue_idx,
        },
      });
    } catch (err) {
      console.error("파일 삭제 중 오류:", err);
      res.send({
        status: "fail",
        message: err.message,
        data: {
          name: data.fileName,
          issue_idx: data.issue_idx,
        },
      });
    }
  },

  // Supabase Storage를 이용한 파일 업로드
  fileUpload: async function (req, res) {
    console.log("파일 업로드를 시작합니다.", req.body.issue_idx);
    console.log("파일 업로드를 시작합니다. overwrite", req.body.overwrite);

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;
    let fileName = file.name;
    const folderPath = `issues/${req.body.issue_idx}`;

    try {
      // overwrite가 없을 경우 파일명 중복 체크
      if (typeof req.body.overwrite === "undefined") {
        const { data: existingFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list(folderPath);

        if (existingFiles) {
          const existingNames = existingFiles.map((f) => f.name);
          let count = 0;
          let originalName = fileName;

          while (existingNames.includes(fileName)) {
            count++;
            fileName = `${count}_${originalName}`;
          }
        }
      }

      const filePath = `${folderPath}/${fileName}`;

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.data, {
          contentType: file.mimetype,
          upsert: req.body.overwrite ? true : false,
        });

      if (error) {
        console.error("파일 업로드 오류:", error);
        return res.status(500).send({
          status: false,
          message: error.message,
        });
      }

      // 공개 URL 가져오기
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

      console.log("파일 업로드 완료:", filePath);
      console.log(fileName, file.mimetype, file.size, req.body.issue_idx);

      res.send({
        status: true,
        message: "File is uploaded",
        data: {
          fileName: fileName,
          mimetype: file.mimetype,
          size: file.size,
          issue_idx: req.body.issue_idx,
          url: publicUrl,
        },
      });
    } catch (err) {
      console.error("파일 업로드 중 오류:", err);
      res.status(500).send({
        status: false,
        message: err.message,
      });
    }
  },
};
