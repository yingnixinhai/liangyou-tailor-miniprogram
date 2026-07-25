# 🧵 良友制衣店 - 微信小程序

服装定制门店的订单管理与工作状态展示小程序。

## 功能

- **订单管理** — 商家/用户创建订单，按状态（未交付/未完成/已完成）分类管理，支持图片上传
- **工作状态** — 实时显示商家在店/不在店状态，带白天/暗夜主题自动切换
- **账户管理** — 微信用户静默登录，商家管理员权限控制

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序原生（WXML + WXSS + JS） |
| 后端 | Node.js + Express.js |
| 数据库 | MySQL |
| 部署 | 自建服务器 + Nginx + Let's Encrypt SSL |

## 项目结构

```
├── server/                   ← 后端代码（部署到服务器）
│   ├── app.js                ← Express 服务主程序
│   ├── db.js                 ← MySQL 连接池
│   ├── schema.sql            ← 数据库建表脚本
│   ├── package.json          ← Node.js 依赖
│   └── .env.example          ← 环境变量模板
│
├── serverless/               ← 腾讯云 SCF 备选方案
│
└── miniprogram/              ← 微信小程序前端
    ├── app.js / app.json / app.wxss
    ├── utils/
    │   ├── api.js            ← HTTP 请求封装
    │   └── theme-manager.js  ← 白天/暗夜主题切换
    ├── pages/
    │   ├── home/             ← 首页（工作状态展示）
    │   ├── orders/           ← 订单列表、创建、详情
    │   └── profile/          ← 个人信息、商家设置
    └── components/
        ├── order-card/       ← 订单卡片组件
        └── status-tabs/      ← 状态标签栏组件
```

## 快速开始

### 前置要求

- Node.js 16+
- MySQL 5.7+
- 微信小程序开发者工具
- 一个拥有公网 IP 的服务器（用于部署后端）

### 后端部署

```bash
# 1. 将 server/ 目录上传到服务器
# 2. 安装依赖
cd server
npm install

# 3. 初始化数据库
mysql -u root -p < schema.sql

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写以下配置：
#   APPID      - 小程序 AppID
#   APPSECRET  - 小程序 AppSecret（微信公众平台获取）
#   DB_HOST    - MySQL 主机地址
#   DB_USER    - MySQL 用户名
#   DB_PASSWORD - MySQL 密码

# 5. 启动服务
node app.js

# 6.（推荐）使用 PM2 持久化运行
npm install -g pm2
pm2 start app.js --name liangyou-tailor
```

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 小程序端配置

1. 打开 `miniprogram/utils/api.js`
2. 将 `BASE_URL` 替换为你的服务器域名（如 `https://your-domain.com`）
3. 在微信公众平台 → 开发 → 开发设置 → 服务器域名中，添加该域名到 `request` 合法域名
4. 用微信开发者工具打开项目，预览

### 管理员初始化

首次使用时，进入小程序「我的」页面，长按「顾客」标签，即可将当前账号设为商家管理员。

## API 接口

| 路由 | 说明 |
|------|------|
| `POST /login` | 微信登录（code 换 openid） |
| `POST /order` | 订单 CRUD（按 action 分发） |
| `POST /status` | 工作状态获取/更新 |
| `POST /init`  | 管理员初始化 |

## 设计要点

- **支付状态** — 仅作标记状态，无实际支付集成（线下收款）
- **用户登录** — 静默登录，通过 `wx.login` 获取 openid，无感体验
- **主题切换** — 在店时白天模式（白底黑字），不在店时暗夜模式（黑底白字）
- **订单状态** — 未交付 → 未完成 → 已完成，仅商家可操作流转