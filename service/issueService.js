const config = require("../config/baseconfig");
const issueModel = require("../model/issueModel");
const fs = require("fs");
const fsPromises = require("fs").promises;
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

  getFileList: function (req, res) {
    const uploadPath = config.getUploadPath() + req.params.data + "/";

    fs.readdir(uploadPath, function (error, filelist) {
      res.send(JSON.stringify(filelist));
    });
  },

  fileDelete: function (req, res) {
    let data = JSON.parse(req.query[0]);
    const uploadPath = config.getUploadPath() + data.issue_idx + "/";
    let result = "success";
    let resultMessage = "File is deleted";

    try {
      fs.unlinkSync(uploadPath + data.fileName, { recursive: false });
    } catch (err) {
      console.error(err);
      result = "fail";
      resultMessage = "File not exist.";
    }

    res.send({
      status: result,
      message: resultMessage,
      data: {
        name: data.fileName,
        issue_idx: data.issue_idx,
      },
    });
  },
  // 파일 삭제 함수를 Promise로 변환합니다.
  unlinkFile: function (filePath) {
    return fsPromises
      .unlink(filePath)
      .then(() => {
        console.log("파일 삭제 완료 : ", filePath);
      })
      .catch((err) => {
        console.error("파일 삭제 중 오류 발생:", err);
        throw err; // 에러를 다시 던져서 상위 함수에서 처리할 수 있도록 합니다.
      });
  },
  fileUpload: function (req, res) {
    console.log("파일 업로드를 시작합니다.", req.body.issue_idx);
    console.log("파일 업로드를 시작합니다. overwrite", req.body.overwrite);
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }
    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let file = req.files.file;
    const uploadPath = config.getUploadPath() + req.body.issue_idx + "/";

    // 디렉토리 생성
    fs.mkdirSync(uploadPath, { recursive: true });
    let fileName = file.name;
    if (typeof req.body.overwrite === "undefined") {
      // 파일 이름 중복 확인
      let flag = true;
      let count = 0;

      while (flag) {
        if (fs.existsSync(uploadPath + fileName)) {
          count++;
          fileName = count + "_" + file.name;
        } else {
          flag = false;
        }
      }
      // Use the mv() method to place the file somewhere on your server
      file.mv(uploadPath + fileName, function (err) {
        if (err) {
          console.log(err);
          return res.status(500).send(err);
        }
        console.log("파일 업로드 완료 : ", uploadPath + fileName);
        console.log(fileName, file.mimetype, file.size, req.body.issue_idx);
        res.send({
          status: true,
          message: "File is uploaded",
          data: {
            fileName: fileName,
            mimetype: file.mimetype,
            size: file.size,
            issue_idx: req.body.issue_idx,
          },
        });
      });
    } else {
      this.unlinkFile(uploadPath + fileName)
        .then(() => {
          console.log("파일 업데이트를 위해 삭제 : ", uploadPath + fileName);
          // Use the mv() method to place the file somewhere on your server
          file.mv(uploadPath + fileName, function (err) {
            if (err) {
              console.log(err);
              return res.status(500).send(err);
            }
            console.log("파일 업로드 완료 : ", uploadPath + fileName);
            console.log(fileName, file.mimetype, file.size, req.body.issue_idx);
            res.send({
              status: true,
              message: "File is uploaded",
              data: {
                fileName: fileName,
                mimetype: file.mimetype,
                size: file.size,
                issue_idx: req.body.issue_idx,
              },
            });
          });
        })
        .catch((err) => {
          res.status(500).send(err);
        });
    }
  },
};
