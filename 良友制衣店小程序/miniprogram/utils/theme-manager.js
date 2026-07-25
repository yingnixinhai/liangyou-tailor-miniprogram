
/**
 * 主题管理器
 * 控制白天模式（day）/ 暗夜模式（night）的切换
 */
const themeManager = {
  setDayMode: function () {
    wx.removeStorageSync('theme');
    wx.setStorageSync('theme', 'day');
    this._applyTheme('day');
  },

  setNightMode: function () {
    wx.removeStorageSync('theme');
    wx.setStorageSync('theme', 'night');
    this._applyTheme('night');
  },

  toggle: function () {
    const current = wx.getStorageSync('theme') || 'day';
    if (current === 'day') {
      this.setNightMode();
    } else {
      this.setDayMode();
    }
  },

  getCurrent: function () {
    return wx.getStorageSync('theme') || 'day';
  },

  _applyTheme: function (theme) {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page && page.setData) {
        page.setData({ theme: theme });
      }
    });
    // 为当前页面添加/移除 night-mode 样式类
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.selectComponent && currentPage.setThemeClass) {
      currentPage.setThemeClass(theme);
    }
  }
};

module.exports = themeManager;
