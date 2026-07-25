const themeMgr = require('./utils/theme-manager');
const api = require('./utils/api');

App({
  onLaunch: function () {
    this.globalData = {
      openid: "",
      isAdmin: false,
      userInfo: null,
      theme: "day",
      token: ""
    };

    // 静默登录
    this.silentLogin();
  },

  silentLogin: function () {
    const that = this;
    return api.login().then(res => {
      that.globalData.openid = res.openid;
      that.globalData.isAdmin = res.isAdmin;
      that.globalData.token = api.token;
      return res;
    }).catch(err => {
      console.error("登录失败", err);
      wx.showModal({
        title: "登录失败",
        content: "无法获取用户身份，请检查网络连接或API配置",
        showCancel: false
      });
      throw err;
    });
  },

  getThemeManager: function () {
    return themeMgr;
  },

  refreshTheme: function () {
    const that = this;
    return api.request('/status', { action: "get" }).then(res => {
      if (res && res.isInStore !== undefined) {
        if (res.isInStore) {
          themeMgr.setDayMode();
          that.globalData.theme = "day";
        } else {
          themeMgr.setNightMode();
          that.globalData.theme = "night";
        }
      }
      return res;
    });
  }
});