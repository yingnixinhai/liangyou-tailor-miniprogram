
Component({
  properties: {
    order: {
      type: Object,
      value: {}
    },
    theme: {
      type: String,
      value: "day"
    }
  },

  data: {
    displayTime: "",
    timeLabel: "",
    statusText: "",
    showImage: false,
    imageSrc: "",
    customerName: "",
    requirementText: "",
    statusClass: "",
    pageClass: ""
  },

  observers: {
    'order': function (order) {
      if (!order) return;
      let timeLabel = "";
      let displayTime = "";

      switch (order.status) {
        case "unpaid":
          timeLabel = "创建";
          displayTime = this._formatDate(order.createdAt);
          break;
        case "incomplete":
          timeLabel = "预计";
          displayTime = this._formatDate(order.expectedCompletionTime);
          break;
        case "completed":
          timeLabel = "完成";
          displayTime = this._formatDate(order.completionTime);
          break;
      }

      const statusText = order.status === 'unpaid' ? '未交付'
        : order.status === 'incomplete' ? '未完成'
        : '已完成';

      const showImage = order.imageFileIDs && order.imageFileIDs.length > 0;
      const imageSrc = showImage ? order.imageFileIDs[0] : '../../images/default-order.png';
      const pageClass = this.data.theme === 'night' ? 'night-mode' : '';

      this.setData({
        timeLabel,
        displayTime,
        statusText,
        showImage,
        statusClass: order.status,
        imageSrc,
        customerName: order.customerName || '匿名用户',
        requirementText: order.orderRequirements || '',
        pageClass
      });
    }
  },

  methods: {
    _formatDate: function (dateVal) {
      if (!dateVal) return "--";
      const d = new Date(dateVal);
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const day = d.getDate().toString().padStart(2, "0");
      const hour = d.getHours().toString().padStart(2, "0");
      const min = d.getMinutes().toString().padStart(2, "0");
      return month + "/" + day + " " + hour + ":" + min;
    },

    onCardTap: function () {
      this.triggerEvent("cardtap", { orderId: this.data.order._id });
    }
  }
});
