const app = getApp();
const api = require("../../../utils/api");

Page({
  data: {
    isAdmin: false,
    isEdit: false,
    orderId: "",
    orderRequirements: "",
    imageFileIDs: [],
    customerName: "",
    customerPhone: "",
    expectedCompletionTime: "",
    orderAmount: "",
    submitting: false,
    theme: "day"
  },

 onLoad: function (options) {
   this.setData({ isAdmin: app.globalData.isAdmin, theme: app.globalData.theme });
   this.setData({ pageClass: app.globalData.theme === "night" ? "night-mode" : "" });
   if (options.id) {
     wx.setNavigationBarTitle({ title: "编辑订单" });
     this.setData({ isEdit: true, orderId: options.id });
     // 优先使用详情页缓存的订单数据，避免再调 API
     if (app.globalData.editOrder && app.globalData.editOrder._id === options.id) {
       this.applyOrderData(app.globalData.editOrder);
       return;
     }
     // 缓存不存在时回退到 API 调用
     var that = this;
     app.waitForReady(function() { that.loadOrder(options.id); });
   }
 },
  applyOrderData: function (order) {
    this.setData({
      orderRequirements: order.orderRequirements || "",
      imageFileIDs: order.imageFileIDs || [],
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      expectedCompletionTime: order.expectedCompletionTime || "",
      orderAmount: order.orderAmount != null ? order.orderAmount.toString() : "",
    });
  },
 loadOrder: function (orderId) {
   var that = this;
   console.log("loadOrder called with orderId:", orderId);
   api.request("/order", { action: "getDetail", orderId }).then(function (res) {
     console.log("loadOrder response:", JSON.stringify(res));
      if (res.success) {
        var order = res.data;
        that.applyOrderData(order);
      } else {
        wx.showToast({ title: res.errMsg || "加载订单失败", icon: "none" });
      }
   }).catch(function (err) {
    console.error("加载订单失败", err);
    wx.showToast({ title: "加载订单失败", icon: "none" });
  });
  },


  onInputReq: function (e) { this.setData({ orderRequirements: e.detail.value }); },
  onInputName: function (e) { this.setData({ customerName: e.detail.value }); },
  onInputPhone: function (e) { this.setData({ customerPhone: e.detail.value }); },
  onInputTime: function (e) { this.setData({ expectedCompletionTime: e.detail.value }); },
  onInputAmount: function (e) { this.setData({ orderAmount: e.detail.value }); },

  onChooseImage: function () {
    const that = this;
    console.log("onChooseImage called");
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: function (res) {
        wx.showLoading({ title: "上传中..." });
        const filePath = res.tempFilePaths[0];
   wx.uploadFile({
          url: api.BASE_URL + '/upload', timeout: 30000,
          filePath: filePath,
          name: 'file',
          success: function (upRes) {
            try {
              const data = JSON.parse(upRes.data);
              if (data.success) {
                // 存完整 URL（api.BASE_URL 是前缀，data.url 是路径）
                const fullUrl = api.BASE_URL.replace(/\/miniprogram$/, '') + data.url;
                const fileIDs = that.data.imageFileIDs.concat([fullUrl]);
                that.setData({ imageFileIDs: fileIDs });
                wx.hideLoading();
              } else {
                wx.hideLoading();
                wx.showToast({ title: data.errMsg || "上传失败", icon: "none" });
              }
            } catch (e) {
              wx.hideLoading();
              wx.showToast({ title: "上传失败", icon: "none" });
            }
         },
          fail: function (e) {
            wx.hideLoading();
            wx.showToast({ title: "上传失败", icon: "none" });
            console.error("uploadFile failed:", e);
          },
          complete: function () {
            wx.hideLoading();
          }
        });
      }
    });
  },

  onRemoveImage: function (e) {
    const fileIDs = this.data.imageFileIDs;
    fileIDs.splice(e.currentTarget.dataset.index, 1);
    this.setData({ imageFileIDs: fileIDs });
  },

  onSubmit: function () {
    const that = this;
    const { orderRequirements, customerName, customerPhone, imageFileIDs } = this.data;
    if (!orderRequirements || !orderRequirements.trim()) {
      wx.showToast({ title: "请填写订单需求", icon: "none" }); return;
    }
    this.setData({ submitting: true });

    const data = {
      orderRequirements: orderRequirements.trim(),
      imageFileIDs: imageFileIDs,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined
    };
    if (this.data.isAdmin) {
      if (this.data.expectedCompletionTime) data.expectedCompletionTime = this.data.expectedCompletionTime;
      if (this.data.orderAmount) data.orderAmount = Number(this.data.orderAmount);
    }

    const action = this.data.isEdit ? "update" : "create";
    if (this.data.isEdit) data.orderId = this.data.orderId;

    api.request("/order", { action, ...data }).then(res => {
      if (res.success) {
        wx.showToast({ title: that.data.isEdit ? "修改成功" : "创建成功", icon: "success" });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: res.errMsg || "操作失败", icon: "none" });
        that.setData({ submitting: false });
      }
    }).catch(err => {
      console.error("操作失败", err);
      wx.showModal({
        title: "操作失败",
        content: "请检查：1. API地址是否配置 2. 后端服务是否启动",
        showCancel: false
      });
      that.setData({ submitting: false });
    });
  }
});
