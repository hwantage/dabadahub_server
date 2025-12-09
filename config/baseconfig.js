module.exports = {
  // 디버깅 모드 On/Off
  getDebugMode: function () {
    return true;
  },

  // 사용할 데이터베이스 종류  (pg, mysql)
  getDBType: function () {
    return "pg";
  },

  // 레드마인 Host url
  getHost: function () {
    return "http://redmine.somansa.com/redmine";
  },

  // 레드마인 Admin Account
  getAccount: function () {
    const account = {
      username: "kvirus",
      password: "sms980502!",
    };
    return account;
  },

  // 레드마인 Admin Account
  getCreaterAccount: function () {
    const account = {
      username: "hwan77",
      password: "tnflstkfkd1!",
    };
    return account;
  },

  // 이미지 업로드 Path
  getUploadPath: function () {
    //return "/redmanager/views/public/upload/";
    return "/redmanager/views/build/upload/";
  },
};
