# 良友制衣店 - 后端服务

## 快速部署

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填入你的小程序 AppID、AppSecret 和数据库信息
```

### 3. 初始化数据库
用 MySQL 客户端执行 schema.sql：
```bash
mysql -u root -p < schema.sql
```

### 4. 启动服务
```bash
# 开发模式
node app.js

# 正式运行（推荐使用 PM2）
npm install -g pm2
pm2 start app.js --name liangyou-tailor
```

### 5. 配置 Nginx + SSL
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 6. 配置小程序
1. 将域名添加到微信小程序后台 -> 开发 -> 服务器域名 -> request 合法域名
2. 修改 miniprogram/utils/api.js 中的 BASE_URL 为你的域名

## 环境变量说明

| 变量 | 说明 | 必填 |
|------|------|------|
| APPID | 小程序 AppID | 是 |
| APPSECRET | 小程序 AppSecret | 是 |
| DB_HOST | MySQL 主机地址 | 是 |
| DB_USER | MySQL 用户名 | 是 |
| DB_PASSWORD | MySQL 密码 | 是 |
| DB_NAME | 数据库名 | 否（默认 liangyou_tailor） |
| PORT | 服务端口 | 否（默认 3000） |