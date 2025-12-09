const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const redmineService = require("./service/redmineService");
const issueService = require("./service/issueService");
const reportService = require("./service/reportService");
const workManageService = require("./service/workManageService");
const dabadahubService = require("./service/dabadahubService");
const { supabase, BUCKET_NAME } = require("./config/supabase");
const app = express();

app.use(fileUpload());

// configuration =========================
app.set("port", process.env.PORT || 3001);
app.use(cors());

// interceptor Function
const logger = function (req, res, next) {
  // Put the preprocessing here.
  console.log("[URI]" + decodeURI(req.url));
  next();
};

// API 목록 조회 (루트 경로)
app.get("/", (req, res) => {
  const apiList = {
    name: "RedManager API Server",
    version: "1.0.0",
    endpoints: {
      "Redmine": [
        { method: "GET", path: "/redmine", description: "레드마인 이슈 목록 조회" },
        { method: "GET", path: "/getRedmineIssueById/:id", description: "레드마인 이슈 상세 조회" },
        { method: "GET", path: "/getRedmineProjectList", description: "레드마인 프로젝트 목록 조회" },
        { method: "GET", path: "/getRedmineUserList", description: "레드마인 유저 목록 조회" },
        { method: "POST", path: "/createRedmineIssue", description: "레드마인 이슈 생성" },
        { method: "GET", path: "/syncAllIssue/", description: "전체 이슈 동기화" },
      ],
      "Issue": [
        { method: "POST", path: "/getIssueList/", description: "이슈 목록 조회" },
        { method: "POST", path: "/getIssueListCount/", description: "이슈 카운트 조회" },
        { method: "GET", path: "/addRegistedIssue/:data", description: "등록된 이슈 추가" },
        { method: "GET", path: "/addIssueByData/:data", description: "데이터로 이슈 추가" },
        { method: "POST", path: "/addNewIssue/", description: "새 이슈 추가" },
        { method: "POST", path: "/updateIssue/", description: "이슈 수정" },
        { method: "GET", path: "/deleteIssue/:issue_idx", description: "이슈 삭제" },
      ],
      "Workflow": [
        { method: "POST", path: "/updateWorkflowData/", description: "워크플로우 데이터 수정" },
      ],
      "Filter": [
        { method: "POST", path: "/addSavedFilter/", description: "필터 저장" },
        { method: "GET", path: "/getSavedFilterList/", description: "저장된 필터 목록 조회" },
        { method: "GET", path: "/deleteSavedFilter/:data", description: "저장된 필터 삭제" },
        { method: "GET", path: "/updateDefaultFilter/:data", description: "기본 필터 설정" },
      ],
      "Category & Tag": [
        { method: "POST", path: "/addCategory/", description: "카테고리 추가" },
        { method: "POST", path: "/updateCategory/", description: "카테고리 수정" },
        { method: "GET", path: "/getTagList/", description: "태그 목록 조회" },
        { method: "GET", path: "/getCategoryList/", description: "카테고리 목록 조회" },
      ],
      "File": [
        { method: "GET", path: "/getImage/:issueIdx/:fileName", description: "이미지 다운로드 (Supabase)" },
        { method: "GET", path: "/getImageUrl/:issueIdx/:fileName", description: "이미지 공개 URL 조회 (Supabase)" },
        { method: "POST", path: "/fileUpload/", description: "파일 업로드 (Supabase)" },
        { method: "POST", path: "/fileDelete/", description: "파일 삭제 (Supabase)" },
        { method: "GET", path: "/getFileList/:data", description: "파일 목록 조회 (Supabase)" },
      ],
      "Report": [
        { method: "GET", path: "/getReportSummary/:data", description: "리포트 요약 조회" },
        { method: "GET", path: "/getReportTrendSummary/:data", description: "리포트 트렌드 요약 조회" },
        { method: "GET", path: "/getReportTrendSummaryComplete/:data", description: "리포트 트렌드 완료 요약 조회" },
        { method: "GET", path: "/get1YearIssue/:data", description: "1년 이상 미완료 일감 조회" },
        { method: "GET", path: "/get90DaysOverIssue/:data", description: "90일 이상 장기 일감 조회" },
        { method: "GET", path: "/getAverageTime/:data", description: "평균 소요 시간 조회" },
      ],
      "Dabadahub": [
        { method: "GET", path: "/getDabadahubConfig/", description: "다바다허브 설정 조회" },
        { method: "POST", path: "/saveDabadahubConfig/", description: "다바다허브 설정 저장" },
        { method: "POST", path: "/saveLink/", description: "링크 저장" },
        { method: "GET", path: "/getLinkList/", description: "링크 목록 조회" },
        { method: "POST", path: "/saveMemo/", description: "메모 저장" },
        { method: "GET", path: "/getMemoList/", description: "메모 목록 조회" },
        { method: "POST", path: "/actionCountor/", description: "통계 저장" },
        { method: "GET", path: "/getStatistics/:data", description: "통계 조회" },
        { method: "GET", path: "/checkLinkAvailability", description: "링크 가용성 체크" },
      ],
    },
  };
  res.json(apiList);
});

// 이미지 다운로드 (Supabase Storage)
app.get("/getImage/:issueIdx/:fileName", async (req, res) => {
  const { issueIdx, fileName } = req.params;
  const filePath = `issues/${issueIdx}/${fileName}`;

  try {
    // Supabase Storage에서 파일 다운로드
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      console.error("Error downloading image file:", error);
      return res.status(404).send("File not found");
    }

    // 파일의 확장자를 추출하여 Content-Type 설정
    const extension = fileName.split(".").pop().toLowerCase();
    let contentType = "application/octet-stream";

    switch (extension) {
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
      case "png":
        contentType = "image/png";
        break;
      case "gif":
        contentType = "image/gif";
        break;
      case "webp":
      case "webp2":
        contentType = "image/webp";
        break;
    }

    // Blob을 Buffer로 변환하여 전송
    const buffer = Buffer.from(await data.arrayBuffer());
    res.writeHead(200, { "Content-Type": contentType });
    res.end(buffer);
  } catch (err) {
    console.error("Error reading image file:", err);
    res.status(500).send("Internal Server Error");
  }
});

// 이미지 공개 URL 조회 (Supabase Storage)
app.get("/getImageUrl/:issueIdx/:fileName", (req, res) => {
  const { issueIdx, fileName } = req.params;
  const filePath = `issues/${issueIdx}/${fileName}`;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  res.json({ url: data.publicUrl });
});

// 레드마인 조회(Using Redmine Rest API)
app.get("/redmine", logger, (req, res) => {
  redmineService.getRedmineIssueList(req, res);
});

app.get("/getRedmineIssueById/:id", logger, (req, res) => {
  redmineService.getRedmineIssueById(req, res);
});

app.get("/getRedmineProjectList", logger, (req, res) => {
  redmineService.getRedmineProjectList(req, res);
});

app.get("/getRedmineUserList", logger, (req, res) => {
  redmineService.getRedmineUserList(req, res);
});

app.post("/createRedmineIssue", logger, (req, res) => {
  redmineService.createRedmineIssue(req, res);
});

// 관리 대상 이슈 목록 조회 (From Database)
app.post("/getIssueList/", logger, (req, res) => {
  issueService.getIssueList(req, res);
});

// 관리 대상 이슈 카운트 조회 (From Database)
app.post("/getIssueListCount/", logger, (req, res) => {
  issueService.getIssueListCount(req, res);
});

// 이슈 삽입 - IssueList Table
app.get("/addRegistedIssue/:data", logger, (req, res) => {
  issueService.addRegistedIssue(req, res);
});
app.get("/addIssueByData/:data", logger, (req, res) => {
  issueService.addIssueByData(req, res);
});
//app.get('/addNewIssue/:data', (req, res) => {issueService.addNewIssue(req, res) })
app.post("/addNewIssue/", logger, (req, res) => {
  issueService.addNewIssue(req, res);
});

// 이슈 수정 - IssueList Table
// app.get('/updateIssue/:data', (req, res) => { issueService.updateIssue(req, res) })
app.post("/updateIssue/", logger, (req, res) => {
  issueService.updateIssue(req, res);
});

//app.get('/updateWorkflowData/:data', (req, res) => { workManageService.updateWorkflowData(req, res) })
app.post("/updateWorkflowData/", logger, (req, res) => {
  workManageService.updateWorkflowData(req, res);
});

// 이슈 삭제
app.get("/deleteIssue/:issue_idx", logger, (req, res) => {
  issueService.deleteIssue(req, res);
});
// 새 카테고리 저장
app.post("/addCategory/", logger, (req, res) => {
  issueService.addCategory(req, res);
});
// 카테고리 이름 변경
app.post("/updateCategory/", logger, (req, res) => {
  issueService.updateCategory(req, res);
});

// 새 필터 저장
app.post("/addSavedFilter/", logger, (req, res) => {
  issueService.addSavedFilter(req, res);
});
// 저장된 필터 목록 조회
app.get("/getSavedFilterList/", logger, (req, res) => {
  issueService.getSavedFilterList(req, res);
});
// 필터 삭제
app.get("/deleteSavedFilter/:data", logger, (req, res) => {
  issueService.deleteSavedFilter(req, res);
});
// 필터 Default 필터 적용
app.get("/updateDefaultFilter/:data", logger, (req, res) => {
  issueService.updateDefaultFilter(req, res);
});

// 저장된 필터 목록 조회
app.get("/getTagList/", logger, (req, res) => {
  issueService.getTagList(req, res);
});

// 카테고리 목록 조회
app.get("/getCategoryList/", logger, (req, res) => {
  issueService.getCategoryList(req, res);
});

// 전체 동기화
app.get("/syncAllIssue/", logger, logger, (req, res) => {
  redmineService.syncAllIssue(req, res);
});

// 파일 업로드
app.post("/fileUpload/", logger, (req, res) => {
  issueService.fileUpload(req, res);
});

// 파일 삭제
app.post("/fileDelete/", logger, (req, res) => {
  issueService.fileDelete(req, res);
});

// 파일 목록 조회
app.get("/getFileList/:data", logger, (req, res) => {
  issueService.getFileList(req, res);
});

/* 리포트 */
// 리포트 Summary 조회
app.get("/getReportSummary/:data", logger, (req, res) => {
  reportService.getReportSummary(req, res);
});

// 리포트 TrendSummary 조회
app.get("/getReportTrendSummary/:data", logger, (req, res) => {
  reportService.getReportTrendSummary(req, res);
});

// 리포트 TrendSummary 개발 완료 조회
app.get("/getReportTrendSummaryComplete/:data", logger, (req, res) => {
  reportService.getReportTrendSummaryComplete(req, res);
});

// 1년 이상 미완료 일감
app.get("/get1YearIssue/:data", logger, (req, res) => {
  reportService.get1YearIssue(req, res);
});

// 90일 이상 장기 일감
app.get("/get90DaysOverIssue/:data", logger, (req, res) => {
  reportService.get90DaysOverIssue(req, res);
});

// 평균 소요 시간
app.get("/getAverageTime/:data", logger, (req, res) => {
  reportService.getAverageTime(req, res);
});

/* 다바다허브 API */

// 다바다허브 기본 환경 설정 조회
app.get("/getDabadahubConfig/", logger, (req, res) => {
  dabadahubService.getDabadahubConfig(req, res);
});
app.post("/saveDabadahubConfig/", logger, (req, res) => {
  dabadahubService.saveDabadahubConfig(req, res);
});

// 링크 저장
app.post("/saveLink/", logger, (req, res) => {
  dabadahubService.saveLink(req, res);
});

// 링크 목록 조회
app.get("/getLinkList/", logger, (req, res) => {
  dabadahubService.getLinkList(req, res);
});

// 메모 저장
app.post("/saveMemo/", logger, (req, res) => {
  dabadahubService.saveMemo(req, res);
});

// 메모 목록 조회
app.get("/getMemoList/", logger, (req, res) => {
  dabadahubService.getMemoList(req, res);
});

// 통계 저장
app.post("/actionCountor/", logger, (req, res) => {
  dabadahubService.actionCountor(req, res);
});

// 통계 조회
app.get("/getStatistics/:data", logger, (req, res) => {
  dabadahubService.getStatistics(req, res);
});

// 다바다허브 연결 상태 체크
app.get("/checkLinkAvailability", logger, (req, res) => {
  dabadahubService.checkLinkAvailability(req, res);
});

// Listen - 로컬 환경에서만 포트 지정하여 실행
if (process.env.NODE_ENV !== "production") {
  app.listen(app.get("port"), "0.0.0.0", () => {
    console.log(app.get("port") + "번 포트로 서버를 시작합니다.");
  });
}

// Vercel Serverless Function용 export
module.exports = app;
