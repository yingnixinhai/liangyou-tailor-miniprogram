const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    activeTab: "unpaid",
    orders: [],
    isAdmin: false,
    theme: "day",
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad: function () {
    this.setData({ isAdmin: app.globalData.isAdmin, theme: app.globalData.theme, pageClass: app.globalData.theme === "night" ? "night-mode" : "" });
  },

  onShow: function () {
    this.loadOrders(true);
  },

  loadOrders: function (reset = false) {
    if (this.data.loading) return;
    const that = this;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    api.request("/order", { action: "list", status: this.data.activeTab, page, pageSize: this.data.pageSize })
      .then(res => {
        if (res.success) {
          that.setData({
            orders: reset ? res.data : that.data.orders.concat(res.data),
            page, hasMore: res.data.length >= that.data.pageSize, loading: false
          });
        } else {
          that.setData({ loading: false });
          wx.showToast({ title: res.errMsg || "加载失败", icon: "none" });
        }
      }).catch(err => {
        that.setData({ loading: false });
        console.error("加载订单失败", err);
      });
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.detail.key });
    this.loadOrders(true);
  },

  onOrderTap: function (e) {
    wx.navigateTo({ url: "/pages/orders/detail/index?id=" + e.detail.orderId });
  },

  onCreateOrder: function () {
    wx.navigateTo({ url: "/pages/orders/create/index" });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders(false);
    }
  }
});