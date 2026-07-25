const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    isAdmin: false, theme: "day",
    displayName: "", avatarSrc: "",
    expectedInTime: "09:00", expectedOutTime: "19:00",
    introPreview: "", addressPreview: "",
    shopIntro: "良友制衣店 —— 三十余载匠心传承，专注衣物修补、窗帘定制与羽绒服定制。一针一线，皆是对品质的坚守；一朝一夕，只为不负您的信赖。",
    shopAddress: "聊城市东昌府区柳园街道龙山西街运河人家四号楼良友制衣店"
  },

  onLoad: function () {
    this.setData({
      isAdmin: app.globalData.isAdmin,
      theme: app.globalData.theme, pageClass: app.globalData.theme === "night" ? "night-mode" : "",
      openid: app.globalData.openid || "",
      displayName: "用户" + (app.globalData.openid || "").slice(-4)
    });
    this.computePreviews();
  },

 onShow: function () {
   var that = this;
   app.waitForReady(function() {
      that.loadStatus();
    });
  },
  loadStatus: function () {
    api.request("/status", { action: "get" }).then(res => {
      if (res) {
        this.setData({
          expectedInTime: res.expectedInTime || "09:00",
          expectedOutTime: res.expectedOutTime || "19:00"
        });
      }
    });
  },

  computePreviews: function () {
    const intro = this.data.shopIntro || "";
    const addr = this.data.shopAddress || "";
    this.setData({
      introPreview: intro.length > 10 ? intro.slice(0, 10) + "..." : intro,
      addressPreview: addr.length > 10 ? addr.slice(0, 10) + "..." : addr
    });
  },

  onEditInTime: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    wx.showModal({
      title: "修改默认上班时间", content: "", editable: true,
      placeholderText: "当前: " + this.data.expectedInTime + "  格式: HH:MM",
      success: function (res) {
        if (res.confirm && res.content) {
          const time = res.content.trim();
          if (!/^\d{2}:\d{2}$/.test(time)) { wx.showToast({ title: "格式错误", icon: "none" }); return; }
          api.request("/status", { action: "update", expectedInTime: time }).then(() => {
            that.setData({ expectedInTime: time });
            wx.showToast({ title: "已更新" });
          });
        }
      }
    });
  },

  onEditOutTime: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    wx.showModal({
      title: "修改默认下班时间", content: "", editable: true,
      placeholderText: "当前: " + this.data.expectedOutTime + "  格式: HH:MM",
      success: function (res) {
        if (res.confirm && res.content) {
          const time = res.content.trim();
          if (!/^\d{2}:\d{2}$/.test(time)) { wx.showToast({ title: "格式错误", icon: "none" }); return; }
          api.request("/status", { action: "update", expectedOutTime: time }).then(() => {
            that.setData({ expectedOutTime: time });
            wx.showToast({ title: "已更新" });
          });
        }
      }
    });
  },

  onShowShopIntro: function () {
    wx.showModal({ title: "店铺介绍", content: this.data.shopIntro, showCancel: false });
  },

  onShowShopAddress: function () {
    wx.showModal({ title: "店铺地址", content: this.data.shopAddress, showCancel: false });
  },

  onEditShopIntro: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    wx.showModal({
      title: "编辑店铺介绍", content: "", editable: true,
      placeholderText: this.data.shopIntro,
      success: function (res) {
        if (res.confirm && res.content !== undefined) {
          that.setData({ shopIntro: res.content });
          that.computePreviews();
        }
      }
    });
  },

  onEditShopAddress: function () {
    if (!this.data.isAdmin) return;
    const that = this;
    wx.showModal({
      title: "编辑店铺地址", content: "", editable: true,
      placeholderText: this.data.shopAddress,
      success: function (res) {
        if (res.confirm && res.content !== undefined) {
          that.setData({ shopAddress: res.content });
          that.computePreviews();
        }
      }
    });
  },

  onInitAdmin: function () {
    if (this.data.isAdmin) { wx.showToast({ title: "已是管理员", icon: "none" }); return; }
    const that = this;
    wx.showModal({
      title: "初始化管理员",
      content: "确认将当前账号设为商家管理员？此操作仅可执行一次。",
      success: function (res) {
        if (res.confirm) {
          api.request("/init", { firstInit: true }).then(res => {
            if (res.success) {
              app.globalData.isAdmin = true;
              that.setData({ isAdmin: true });
              wx.showToast({ title: "初始化成功", icon: "success" });
            } else {
              wx.showToast({ title: res.errMsg || "初始化失败", icon: "none" });
            }
          });
        }
      }
    });
  }
});
