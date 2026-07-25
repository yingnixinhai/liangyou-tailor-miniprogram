with open("miniprogram/pages/home/index.js", "r", encoding="utf-8") as f:
    c = f.read()

# Move API call outside setTimeout, keep only overlay hide in timeout
old = """    }).then(res => {
      setTimeout(() => {
        if (res.success) {
          const theme = newIsInStore ? "day" : "night";
          that.setData({ isInStore: newIsInStore, theme: theme });
          that.applyTheme(theme);
          that.computeDisplayValues(theme, newIsInStore);
        } else {
          wx.showToast({ title: res.errMsg || '\u64cd\u4f5c\u5931\u8d25', icon: 'none' });
        }
        that.setData({ isAnimating: false });
      }, 550);
    })"""

new = """    }).then(res => {
      if (res.success) {
        const theme = newIsInStore ? "day" : "night";
        that.setData({ isInStore: newIsInStore, theme: theme });
        that.applyTheme(theme);
        that.computeDisplayValues(theme, newIsInStore);
      } else {
        wx.showToast({ title: res.errMsg || '\u64cd\u4f5c\u5931\u8d25', icon: 'none' });
      }
    }).catch(err => {
      console.error('\u5207\u6362\u72b6\u6001\u5931\u8d25', err);
      wx.showToast({ title: '\u8bf7\u6c42\u5931\u8d25: ' + (err.errMsg || '\u7f51\u7edc\u9519\u8bef'), icon: 'none' });
    });
    setTimeout(() => {
      that.setData({ isAnimating: false });
      that.computeDisplayValues(that.data.theme, that.data.isInStore);
    }, 550);"""

c = c.replace(old, new)

with open("miniprogram/pages/home/index.js", "w", encoding="utf-8") as f:
    f.write(c)
print("OK: API runs in parallel, switch during animation")
