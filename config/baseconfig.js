// 로컬 개발 환경에서는 .env 파일 사용
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

module.exports = {
  // 디버깅 모드 On/Off
  getDebugMode: function () {
    return true;
  },

  // 사용할 데이터베이스 종류  (pg, mysql)
  getDBType: function () {
    return "pg";
  },

  // Supabase Storage bucket 내 업로드 경로
  getUploadPath: function () {
    return "redmanager/upload/";
  },

  // Supabase Storage 공개 URL 기본 경로
  getStoragePublicUrl: function () {
    const supabaseUrl = process.env.SUPABASE_URL;
    const bucketName = process.env.SUPABASE_BUCKET_NAME;
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/`;
  },
};
