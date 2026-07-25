const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    activeTab: "incomplete",
    orders: [],
    isAdmin: false,
    theme: "day",
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    batchMode: false,
    selectedIds: [],
    batchActionLabel: "",
    batchAllLabel: "",
    selectAllLabel: "全选"
  },

 onLoad: function () {
   this.setData({ isAdmin: app.globalData.isAdmin, theme: app.globalData.theme, pageClass: app.globalData.theme === "night" ? "night-mode" : "" });
   this.computeBatchLabels();
 },

  onShow: function () {
    var that = this;
    app.waitForReady(function() { that.loadOrders(true); });
  },

  loadOrders: function (reset) {
    if (reset === undefined) reset = true;
    if (this.data.loading) return;
    var that = this;
    var page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    api.request("/order", { action: "list", status: this.data.activeTab, page: page, pageSize: this.data.pageSize })
      .then(function (res) {
        if (res.success) {
          that.setData({
            orders: reset ? res.data : that.data.orders.concat(res.data),
            page: page, hasMore: res.data.length >= that.data.pageSize, loading: false
          });
          that.computeBatchLabels();
        } else {
          that.setData({ loading: false });
          wx.showToast({ title: res.errMsg || "加载失败", icon: "none" });
        }
      }).catch(function (err) {
        that.setData({ loading: false });
        console.error("加载订单失败", err);
      });
  },

  computeBatchLabels: function () {
    var tab = this.data.activeTab;
    var batchAll = "", batchAction = "";
    if (tab === "unpaid") {
      batchAll = "一键交付";
      batchAction = "批量已交付";
    } else if (tab === "incomplete") {
      batchAll = "一键完成";
      batchAction = "批量已完成";
    } else {
      batchAll = "一键回退";
      batchAction = "批量回退";
    }
    this.setData({ batchAllLabel: batchAll, batchActionLabel: batchAction });
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.detail.key, selectedIds: [], batchMode: false });
    this.loadOrders(true);
  },

  onOrderTap: function (e) {
    if (this.data.batchMode) {
      this.toggleSelection(e.detail.orderId);
    } else {
      wx.navigateTo({ url: "/pages/orders/detail/index?id=" + e.detail.orderId });
    }
  },

  toggleSelection: function (orderId) {
    var ids = this.data.selectedIds;
    var idx = ids.indexOf(orderId);
    if (idx > -1) {
      ids.splice(idx, 1);
    } else {
      ids.push(orderId);
    }
    var allLabel = ids.length === this.data.orders.length ? "取消全选" : "全选";
    this.setData({ selectedIds: ids, selectAllLabel: allLabel });
  },

  onToggleBatchMode: function () {
    this.setData({ batchMode: !this.data.batchMode, selectedIds: [], selectAllLabel: "全选" });
  },

  onSelectAll: function () {
    var ids = this.data.selectedIds;
    if (ids.length === this.data.orders.length) {
      this.setData({ selectedIds: [], selectAllLabel: "全选" });
    } else {
      var allIds = this.data.orders.map(function(o) { return o._id; });
      this.setData({ selectedIds: allIds, selectAllLabel: "取消全选" });
    }
  },

  onBatchDelete: function () {
    var that = this;
    var ids = this.data.selectedIds;
    if (ids.length === 0) { wx.showToast({ title: "请选择订单", icon: "none" }); return; }
    wx.showModal({
      title: "确认删除", content: "确定删除选中的 " + ids.length + " 个订单？",
      success: function (r) {
        if (r.confirm) {
          api.request("/order", { action: "batchDelete", orderIds: ids }).then(function (res) {
            if (res.success) {
              wx.showToast({ title: "已删除 " + res.deletedCount + " 个", icon: "success" });
              that.setData({ batchMode: false, selectedIds: [] });
              that.loadOrders(true);
            } else {
              wx.showToast({ title: res.errMsg || "操作失败", icon: "none" });
            }
          });
        }
      }
    });
  },

  onBatchUpdateStatus: function () {
    var that = this;
    var ids = this.data.selectedIds;
    if (ids.length === 0) { wx.showToast({ title: "请选择订单", icon: "none" }); return; }
    var statusMap = { unpaid: "incomplete", incomplete: "completed", completed: "incomplete" };
    var newStatus = statusMap[this.data.activeTab];
    var labelMap = { unpaid: "已交付", incomplete: "已完成", completed: "回退" };
    wx.showModal({
      title: "确认操作",
      content: "将选中的 " + ids.length + " 个订单设为" + labelMap[this.data.activeTab] + "？",
      success: function (r) {
        if (r.confirm) {
          api.request("/order", { action: "batchUpdateStatus", orderIds: ids, newStatus: newStatus }).then(function (res) {
            if (res.success) {
              wx.showToast({ title: "已更新 " + res.updatedCount + " 个", icon: "success" });
              that.setData({ batchMode: false, selectedIds: [] });
              that.loadOrders(true);
            } else {
              wx.showToast({ title: res.errMsg || "操作失败", icon: "none" });
            }
          });
        }
      }
    });
  },

  onBatchAllDelete: function () {
    var that = this;
    var statusMap = { unpaid: "未交付", incomplete: "未完成", completed: "已完成" };
    wx.showModal({
      title: "确认全部删除",
      content: "确定删除当前标签下所有" + statusMap[this.data.activeTab] + "订单？",
      success: function (r) {
        if (r.confirm) {
          api.request("/order", { action: "batchAllDelete", status: that.data.activeTab }).then(function (res) {
            if (res.success) {
              wx.showToast({ title: "已删除 " + res.deletedCount + " 个", icon: "success" });
              that.loadOrders(true);
            } else {
              wx.showToast({ title: res.errMsg || "操作失败", icon: "none" });
            }
          });
        }
      }
    });
  },

  onBatchAllAction: function () {
    var that = this;
    var statusMap = { unpaid: "未交付", incomplete: "未完成", completed: "已完成" };
    var nextMap = { unpaid: "incomplete", incomplete: "completed", completed: "incomplete" };
    var labelMap = { unpaid: "交付", incomplete: "完成", completed: "回退" };
    var tab = this.data.activeTab;
    wx.showModal({
      title: "确认全部" + labelMap[tab],
      content: "将当前标签下所有" + statusMap[tab] + "订单设为" + labelMap[tab] + "？",
      success: function (r) {
        if (r.confirm) {
          api.request("/order", { action: "batchAllUpdateStatus", status: tab, newStatus: nextMap[tab] }).then(function (res) {
            if (res.success) {
              wx.showToast({ title: "已更新 " + res.updatedCount + " 个", icon: "success" });
              that.loadOrders(true);
            } else {
              wx.showToast({ title: res.errMsg || "操作失败", icon: "none" });
            }
          });
        }
      }
    });
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
