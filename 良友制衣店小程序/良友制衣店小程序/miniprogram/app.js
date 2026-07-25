const themeMgr = require('./utils/theme-manager');
const api = require('./utils/api');

App({
  onLaunch: function () {
    this.globalData = {
      openid: "",
      isAdmin: false,
      userInfo: null,
      theme: "day",
      token: "",
      ready: false
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
      that.globalData.ready = true;
      return res;
    }).catch(err => {
      that.globalData.ready = true;
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

  waitForReady: function(callback) {
    if (this.globalData.ready) {
      callback();
    } else {
      setTimeout(() => this.waitForReady(callback), 100);
    }
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