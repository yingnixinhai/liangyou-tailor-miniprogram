
Component({
  properties: {
    activeTab: {
      type: String,
      value: "unpaid"
    },
    theme: {
      type: String,
      value: "day"
    }
  },

  data: {
    tabs: [
      { key: "unpaid", label: "未交付" },
      { key: "incomplete", label: "未完成" },
      { key: "completed", label: "已完成" }
    ],
    pageClass: ""
  },

  observers: {
    'theme': function (theme) {
      this.setData({
        pageClass: theme === 'night' ? 'night-mode' : ''
      });
    }
  },

  methods: {
    onTabTap: function (e) {
      const key = e.currentTarget.dataset.key;
      if (key !== this.data.activeTab) {
        this.triggerEvent("change", { key });
      }
    }
  }
});
