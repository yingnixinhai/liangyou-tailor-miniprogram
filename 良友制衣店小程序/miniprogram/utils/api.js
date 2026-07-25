// API 请求封装 - 替代 wx.cloud.callFunction
// 部署后替换为你的服务器域名（需 HTTPS）
let BASE_URL = 'https://legend.nm.cn/miniprogram';

let _token = '';
let _openid = '';
try {
  _token = wx.getStorageSync('session_token') || '';
  _openid = wx.getStorageSync('openid') || '';
} catch (e) {}

function request(path, data = {}) {
  return new Promise(function(resolve, reject) {
    if (_token) data.token = _token;
    wx.request({
      url: BASE_URL + path,
      method: 'POST',
      data: data,
      timeout: 10000,
      success: function(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject({ errMsg: 'Network error ' + res.statusCode });
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

function login() {
  return new Promise(function(resolve, reject) {
    wx.login({
      success: function(res) {
        if (res.code) {
          request('/login', { code: res.code }).then(function(result) {
            if (result.success) {
              _token = result.token;
              _openid = result.openid;
              wx.setStorageSync('session_token', result.token);
              wx.setStorageSync('openid', result.openid);
              resolve({ openid: result.openid, isAdmin: result.isAdmin });
            } else {
              reject(result);
            }
          }).catch(reject);
        } else {
          reject({ errMsg: 'login code failed' });
        }
      },
      fail: reject
    });
  });
}

function logout() {
  _token = '';
  _openid = '';
  wx.removeStorageSync('session_token');
  wx.removeStorageSync('openid');
}

function setBaseUrl(url) {
  BASE_URL = url;
}

module.exports = {
  request: request,
  login: login,
  logout: logout,
  setBaseUrl: setBaseUrl,
  BASE_URL: BASE_URL,
  get token() { return _token; },
  get openid() { return _openid; }
};