const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    isInStore: true, isAdmin: false,
    statusNote: "", expectedInTime: "09:00", expectedOutTime: "19:00",
    expectedStatusTime: "", theme: "day",
    // Computed display values
    pageClass: "", buClass: "", heroShiftClass: "",
    expectedLabel: "", toggleLabel: "",
    btnClass: ""
  },

  onLoad: function () {
    this.setData({ isAdmin: app.globalData.isAdmin });
    this.computeDisplayValues('day', true);
  },

  onShow: function () {
    var that = this;
    app.waitForReady(function() {
      that.setData({ isAdmin: app.globalData.isAdmin });
      that.loadStatus();
    });
  },

  loadStatus: function () {
    const that = this;
    api.request("/status", { action: "get" }).then(res => {
      if (res) {
        that.setData({
          isInStore: res.isInStore, statusNote: res.statusNote || "",
          expectedInTime: res.expectedInTime || "09:00",
          expectedOutTime: res.expectedOutTime || "19:00",
          expectedStatusTime: res.expectedStatusTime || "",
          theme: res.isInStore ? "day" : "night"
        });
        that.applyTheme(res.isInStore ? "day" : "night");
        that.computeDisplayValues(res.isInStore ? "day" : "night", res.isInStore);
      }
    }).catch(err => console.error("获取工作状态失败", err));
  },

  computeDisplayValues: function (theme, isInStore) {
    this.setData({
      pageClass: theme === "night" ? "night-mode" : "",
      buClass: theme === "day" ? "bu-hidden" : "bu-visible",
      heroShiftClass: theme === "night" ? "hero-shifted" : "",
      expectedLabel: isInStore ? "预计下班" : "预计上班",
      toggleLabel: isInStore ? "下班" : "上班",
      btnClass: "",
    });
  },

  applyTheme: function (theme) {
    if (theme === "night") {
      wx.setNavigationBarColor({ frontColor: "#ffffff", backgroundColor: "#1A1A1A" });
    } else {
      wx.setNavigationBarColor({ frontColor: "#000000", backgroundColor: "#FFFFFF" });
    }
  },

  onToggleStatus: function () {
    console.log('toggle clicked, isAdmin=' + this.data.isAdmin);
    if (!this.data.isAdmin) return;
    const that = this;
    const newIsInStore = !this.data.isInStore;
    // 立即切换模式（无动画）
    var theme = newIsInStore ? "day" : "night";
    that.setData({ isInStore: newIsInStore, theme: theme });
    that.applyTheme(theme);
    that.computeDisplayValues(theme, newIsInStore);
    const now = new Date();
    let expectedStatusTime;
    if (newIsInStore) {
      const [h, m] = this.data.expectedOutTime.split(":");
      expectedStatusTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
    } else {
      const [h, m] = this.data.expectedInTime.split(":");
      expectedStatusTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
    }

    // 构造预计切换时间字符串
    var expTimeStr = expectedStatusTime.getFullYear() + '-' +
      String(expectedStatusTime.getMonth()+1).padStart(2,'0') + '-' +
      String(expectedStatusTime.getDate()).padStart(2,'0') + ' ' +
      String(expectedStatusTime.getHours()).padStart(2,'0') + ':' +
      String(expectedStatusTime.getMinutes()).padStart(2,'0') + ':' +
      String(expectedStatusTime.getSeconds()).padStart(2,'0');

    // 发送 API 请求（并行，不等待响应即切换模式）
    api.request("/status", {
      action: "update", isInStore: newIsInStore,
      expectedStatusTime: expTimeStr
    }).then(function (res) {
      if (!res.success) {
        wx.showToast({ title: res.errMsg || '操作失败', icon: 'none' });
      }
    }).catch(function (err) {
      console.error('切换状态失败', err);
      wx.showToast({ title: '请求失败: ' + (err.errMsg || '网络错误'), icon: 'none' });
    });

  },

  onEditNote: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    wx.showModal({
      title: "编辑备注", content: "", editable: true,
      placeholderText: "输入状态备注...",
      success: function (r) {
        if (r.confirm && r.content !== undefined) {
          api.request("/status", { action: "update", statusNote: r.content }).then(() => {
            that.setData({ statusNote: r.content });
          });
        }
      }
    });
  },

  onEditExpectedTime: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    const current = this.data.isInStore ? this.data.expectedOutTime : this.data.expectedInTime;
    wx.showModal({
      title: "编辑预计时间", content: "", editable: true,
      placeholderText: "当前: " + current + " 输入 HH:MM",
      success: function (r) {
        if (r.confirm && r.content) {
          const t = r.content.trim();
          if (!/^\d{2}:\d{2}$/.test(t)) { wx.showToast({ title: "格式错误", icon: "none" }); return; }
          const field = that.data.isInStore ? "expectedOutTime" : "expectedInTime";
          api.request("/status", { action: "update", [field]: t }).then(() => {
            that.setData({ [field]: t });
          });
        }
      }
    });
  }
});
