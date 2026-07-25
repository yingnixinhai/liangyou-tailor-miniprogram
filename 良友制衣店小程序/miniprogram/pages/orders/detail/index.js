const app = getApp();
const api = require("../../../utils/api");

Page({
  data: {
    order: null, isAdmin: false, theme: "day", loading: true,
    images: [], hasImages: false, statusText: "", statusActions: [],
    reqText: "", createTime: "--", expectedTime: "--", completeTime: "--",
    amountText: "", showAmount: false, customerName: "", customerPhone: "", orderStatus: ""
  },

  onLoad: function (options) {
    this.setData({ isAdmin: app.globalData.isAdmin, theme: app.globalData.theme, pageClass: app.globalData.theme === "night" ? "night-mode" : "" });
    if (options.id) this.loadOrder(options.id);
  },

  loadOrder: function (orderId) {
    const that = this;
    this.setData({ loading: true });
    api.request("/order", { action: "getDetail", orderId }).then(res => {
      if (res.success) {
        const order = res.data;
        const orderStatus = order.status || "";
        const hasImages = order.imageFileIDs && order.imageFileIDs.length > 0;
        const showAmount = order.orderAmount !== undefined && order.orderAmount !== null;
        that.setData({
          order, images: order.imageFileIDs || [], hasImages, loading: false,
          statusText: that.getStatusText(order.status),
          statusActions: that.getStatusActions(order.status),
          reqText: order.orderRequirements || "",
          createTime: that._formatDate(order.createdAt),
          expectedTime: that._formatDate(order.expectedCompletionTime),
          completeTime: that._formatDate(order.completionTime),
          amountText: showAmount ? "¥" + Number(order.orderAmount).toFixed(2) : "",
          showAmount, customerName: order.customerName || "",
          customerPhone: order.customerPhone || "未填写", orderStatus
        });
      } else {
        wx.showToast({ title: "加载失败", icon: "none" });
        that.setData({ loading: false });
      }
    }).catch(err => {
      console.error("加载详情失败", err);
      that.setData({ loading: false });
    });
  },

  getStatusText: function (status) {
    return { unpaid: "未交付", incomplete: "未完成", completed: "已完成" }[status] || "未知";
  },

  getStatusActions: function (status) {
    const actions = [];
    if (status === "unpaid") actions.push({ nextStatus: "incomplete", label: "已交付" });
    else if (status === "incomplete") actions.push({ nextStatus: "completed", label: "已完成" });
    else if (status === "completed") actions.push({ nextStatus: "incomplete", label: "回退到未完成" });
    return actions;
  },

  onStatusAction: function (e) {
    if (!this.data.isAdmin) return;
    const that = this;
    const newStatus = e.currentTarget.dataset.nextStatus;
    wx.showModal({
      title: "确认操作",
      content: "确定将订单状态改为" + this.getStatusText(newStatus) + "？",
      success: function (res) {
        if (res.confirm) that.doStatusUpdate(newStatus);
      }
    });
  },

  doStatusUpdate: function (newStatus) {
    api.request("/order", { action: "updateStatus", orderId: this.data.order._id, newStatus }).then(res => {
      if (res.success) {
        wx.showToast({ title: "状态已更新", icon: "success" });
        this.loadOrder(this.data.order._id);
      } else {
        wx.showToast({ title: res.errMsg || "更新失败", icon: "none" });
      }
    });
  },

  onEdit: function () {
    const order = this.data.order;
    if (!order) return;
    if (!this.data.isAdmin && order.status !== "unpaid") {
      wx.showToast({ title: "仅可编辑未交付订单", icon: "none" }); return;
    }
    wx.navigateTo({ url: "/pages/orders/create/index?id=" + order._id });
  },

  onDelete: function () {
    const that = this;
    const order = this.data.order;
    if (!order) return;
    if (!this.data.isAdmin && order.status !== "unpaid") {
      wx.showToast({ title: "仅可删除未交付订单", icon: "none" }); return;
    }
    wx.showModal({
      title: "确认删除", content: "确定要删除此订单吗？此操作不可恢复。",
      success: function (res) {
        if (res.confirm) {
          api.request("/order", { action: "delete", orderId: order._id }).then(res => {
            if (res.success) {
              wx.showToast({ title: "已删除", icon: "success" });
              setTimeout(() => wx.navigateBack(), 1500);
            } else {
              wx.showToast({ title: res.errMsg || "删除失败", icon: "none" });
            }
          });
        }
      }
    });
  },

  onPreviewImage: function (e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: this.data.images, current: url });
  },

  _formatDate: function (dateVal) {
    if (!dateVal) return "--";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "--";
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const h = d.getHours().toString().padStart(2, "0");
    const min = d.getMinutes().toString().padStart(2, "0");
    return y + "-" + m + "-" + day + " " + h + ":" + min;
  }
});