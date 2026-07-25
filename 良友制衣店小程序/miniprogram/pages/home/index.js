const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    isInStore: true, isAdmin: false,
    statusNote: "", expectedInTime: "09:00", expectedOutTime: "19:00",
    expectedStatusTime: "", theme: "day", isAnimating: false,
    // Computed display values
    pageClass: "", buClass: "", heroShiftClass: "",
    expectedLabel: "", toggleLabel: "",
    btnClass: "", switchClass: ""
  },

  onLoad: function () {
    this.setData({ isAdmin: app.globalData.isAdmin });
    this.computeDisplayValues('day', true);
  },

  onShow: function () {
    this.loadStatus();
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
      btnClass: this.data.isAnimating ? "btn-disabled" : "",
      switchClass: this.data.isAnimating ? "switch-active" : ""
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
    if (!this.data.isAdmin || this.data.isAnimating) return;
    const that = this;
    this.setData({ isAnimating: true });

    const newIsInStore = !this.data.isInStore;
    const now = new Date();
    let expectedStatusTime;
    if (newIsInStore) {
      const [h, m] = this.data.expectedOutTime.split(":");
      expectedStatusTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
    } else {
      const [h, m] = this.data.expectedInTime.split(":");
      expectedStatusTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
    }

    api.request("/status", {
      action: "update", isInStore: newIsInStore,
      expectedStatusTime: expectedStatusTime.toISOString()
    }).then(res => {
      if (res.success) {
        const theme = newIsInStore ? "day" : "night";
        that.setData({ isInStore: newIsInStore, theme: theme });
        that.applyTheme(theme);
        that.computeDisplayValues(theme, newIsInStore);
      }
      setTimeout(() => {
        that.setData({ isAnimating: false });
        that.computeDisplayValues(that.data.theme, that.data.isInStore);
      }, 600);
    }).catch(err => {
      console.error("切换状态失败", err);
      that.setData({ isAnimating: false });
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