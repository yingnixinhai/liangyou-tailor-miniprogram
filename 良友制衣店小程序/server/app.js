const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({ storage: storage });
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// ===== 加载环境变量 =====
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
        }
      }
    }
  }
} catch (e) {}
const APPID = process.env.APPID || '';
const APPSECRET = process.env.APPSECRET || '';
const PORT = parseInt(process.env.PORT || '3000');

// ===== 数据库连接 =====
let pool = null;
async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'liangyou_tailor',
      waitForConnections: true,
      connectionLimit: 3,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

// ===== 工具函数 =====
function uuid() { return crypto.randomUUID(); }

function now() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

// ===== 微信 code2session =====
async function code2Session(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`;
  const data = await fetchUrl(url);
  if (data.errcode) throw new Error(data.errmsg || '微信登录失败');
  return data.openid;
}

// ===== Token验证 =====
async function validateToken(token) {
  if (!token) throw new Error('缺少令牌');
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT openid FROM sessions WHERE token = ?', [token]);
    if (rows.length === 0) throw new Error('令牌无效');
    return rows[0].openid;
  } finally { conn.release(); }
}

async function isAdmin(openid) {
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT id FROM admins WHERE openid = ?', [openid]);
    return rows.length > 0;
  } finally { conn.release(); }
}

// ===== 启动Express =====
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

// ===== 图片上传
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.json({ success: false, errMsg: '没有上传文件' });
  }
  const url = '/uploads/' + req.file.filename;
  return res.json({ success: true, url: url, filename: req.file.filename });
});

// ===== 登录 =====
app.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.json({ success: false, errMsg: '缺少code' });

    const openid = await code2Session(code);
    const token = uuid();
    const admin = await isAdmin(openid);

    const conn = await (await getPool()).getConnection();
    try {
      await conn.query('INSERT INTO sessions (token, openid) VALUES (?, ?)', [token, openid]);
      return res.json({ success: true, openid, isAdmin: admin, token });
    } finally { conn.release(); }
  } catch (e) {
    return res.json({ success: false, errMsg: e.message });
  }
});

// ===== 订单CRUD =====
app.post('/order', async (req, res) => {
  try {
    const openid = await validateToken(req.body.token);
    const admin = await isAdmin(openid);

    switch (req.body.action) {
      case 'create': return res.json(await createOrder(req.body, openid, admin));
      case 'list': return res.json(await listOrders(req.body, openid, admin));
      case 'getDetail': return res.json(await getOrderDetail(req.body, openid, admin));
      case 'update': return res.json(await updateOrder(req.body, openid, admin));
      case 'delete': return res.json(await deleteOrder(req.body, openid, admin));
      case 'updateStatus': return res.json(await updateOrderStatus(req.body, openid, admin));
      default: return res.json({ success: false, errMsg: '未知操作' });
    }
  } catch (e) {
    return res.json({ success: false, errMsg: e.message });
  }
});

async function createOrder(body, openid, admin) {
  const { orderRequirements, imageFileIDs, customerName, customerPhone, expectedCompletionTime, orderAmount } = body;
  if (!orderRequirements || !orderRequirements.trim())
    return { success: false, errMsg: '订单需求不能为空' };

  const id = uuid();
  const name = customerName || ('用户' + openid.slice(-4));
  const conn = await (await getPool()).getConnection();
  try {
    await conn.query(
      'INSERT INTO orders (id, order_requirements, image_fileids, customer_name, customer_phone, customer_openid, created_by, status, expected_completion_time, order_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, orderRequirements.trim(), imageFileIDs ? JSON.stringify(imageFileIDs) : '[]', name, customerPhone || '', openid, admin ? 'shop' : 'user', admin ? 'incomplete' : 'unpaid', expectedCompletionTime || null, orderAmount || null]
    );
    return { success: true, data: { _id: id } };
  } finally { conn.release(); }
}

async function listOrders(body, openid, admin) {
  const { status, page = 1, pageSize = 20 } = body;
  const offset = (page - 1) * pageSize;
  let where = '';
  const params = [];
  if (status && ['unpaid', 'incomplete', 'completed'].includes(status)) {
    where = 'WHERE status = ?'; params.push(status);
  }
  if (!admin) {
    where += (where ? ' AND' : 'WHERE') + ' customer_openid = ?';
    params.push(openid);
  }
  const sortField = status === 'completed' ? 'completion_time' : status === 'incomplete' ? 'expected_completion_time' : 'created_at';
  const conn = await (await getPool()).getConnection();
  try {
    const [countRes] = await conn.query(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const [rows] = await conn.query(`SELECT * FROM orders ${where} ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    return { success: true, data: rows.map(formatOrder), total: countRes[0].total, page, pageSize };
  } finally { conn.release(); }
}

async function getOrderDetail(body, openid, admin) {
  const { orderId } = body;
  if (!orderId) return { success: false, errMsg: '缺少订单ID' };
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return { success: false, errMsg: '订单不存在' };
    const order = formatOrder(rows[0]);
    if (!admin && order.customerOpenId !== openid) return { success: false, errMsg: '无权访问此订单' };
    return { success: true, data: order };
  } finally { conn.release(); }
}

async function updateOrder(body, openid, admin) {
  const { orderId } = body;
  if (!orderId) return { success: false, errMsg: '缺少订单ID' };
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return { success: false, errMsg: '订单不存在' };
    const order = rows[0];
    if (!admin) {
      if (order.customer_openid !== openid) return { success: false, errMsg: '无权修改此订单' };
      if (order.status !== 'unpaid') return { success: false, errMsg: '仅可修改未支付订单' };
    }
    const updates = []; const params = [];
    if (body.orderRequirements !== undefined) { updates.push('order_requirements = ?'); params.push(body.orderRequirements.trim()); }
    if (body.customerName !== undefined) { updates.push('customer_name = ?'); params.push(body.customerName); }
    if (body.customerPhone !== undefined) { updates.push('customer_phone = ?'); params.push(body.customerPhone); }
    if (body.imageFileIDs !== undefined) { updates.push('image_fileids = ?'); params.push(JSON.stringify(body.imageFileIDs)); }
    if (admin) {
      if (body.expectedCompletionTime !== undefined) { updates.push('expected_completion_time = ?'); params.push(body.expectedCompletionTime); }
      if (body.orderAmount !== undefined) { updates.push('order_amount = ?'); params.push(Number(body.orderAmount)); }
    }
    if (updates.length === 0) return { success: true };
    updates.push('last_updated_at = ?'); params.push(now()); params.push(orderId);
    await conn.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
    return { success: true };
  } finally { conn.release(); }
}

async function deleteOrder(body, openid, admin) {
  const { orderId } = body;
  if (!orderId) return { success: false, errMsg: '缺少订单ID' };
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return { success: false, errMsg: '订单不存在' };
    const order = rows[0];
    if (!admin) {
      if (order.customer_openid !== openid) return { success: false, errMsg: '无权删除此订单' };
      if (order.status !== 'unpaid') return { success: false, errMsg: '仅可删除未支付订单' };
    }
    await conn.query('DELETE FROM orders WHERE id = ?', [orderId]);
    return { success: true };
  } finally { conn.release(); }
}

async function updateOrderStatus(body, openid, admin) {
  if (!admin) return { success: false, errMsg: '仅商家可操作' };
  const { orderId, newStatus } = body;
  if (!orderId || !newStatus) return { success: false, errMsg: '参数不完整' };
  if (!['unpaid', 'incomplete', 'completed'].includes(newStatus)) return { success: false, errMsg: '无效的状态' };
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return { success: false, errMsg: '订单不存在' };
    if (newStatus === 'completed') {
      await conn.query('UPDATE orders SET status = ?, completion_time = ?, last_updated_at = ? WHERE id = ?', [newStatus, now(), now(), orderId]);
    } else {
      await conn.query('UPDATE orders SET status = ?, completion_time = NULL, last_updated_at = ? WHERE id = ?', [newStatus, now(), orderId]);
    }
    return { success: true };
  } finally { conn.release(); }
}

// ===== 工作状态 =====
app.post('/status', async (req, res) => {
  try {
    const conn = await (await getPool()).getConnection();
    try {
      if (req.body.action === 'get') {
        const [rows] = await conn.query('SELECT * FROM work_status WHERE id = ?', ['WORK_STATUS_SINGLE_RECORD']);
        if (rows.length === 0) {
          return res.json({ success: true, isInStore: true, expectedInTime: '09:00', expectedOutTime: '19:00', statusNote: '' });
        }
        return res.json({ success: true, ...formatStatus(rows[0]) });
      }
      if (req.body.action === 'update') {
        const openid = await validateToken(req.body.token);
        if (!(await isAdmin(openid))) return res.json({ success: false, errMsg: '仅商家可操作' });
        const sets = []; const params = [];
        if (req.body.isInStore !== undefined) { sets.push('is_in_store = ?'); params.push(req.body.isInStore ? 1 : 0); }
        if (req.body.statusNote !== undefined) { sets.push('status_note = ?'); params.push(req.body.statusNote); }
        if (req.body.expectedStatusTime) { sets.push('expected_status_time = ?'); params.push(req.body.expectedStatusTime); }
        if (req.body.expectedInTime) { sets.push('expected_in_time = ?'); params.push(req.body.expectedInTime); }
        if (req.body.expectedOutTime) { sets.push('expected_out_time = ?'); params.push(req.body.expectedOutTime); }
        sets.push('updated_at = ?'); params.push(now()); params.push('WORK_STATUS_SINGLE_RECORD');
        await conn.query('INSERT INTO work_status (id) VALUES (?) ON DUPLICATE KEY UPDATE id = id', ['WORK_STATUS_SINGLE_RECORD']);
        await conn.query(`UPDATE work_status SET ${sets.join(', ')} WHERE id = ?`, params);
        return res.json({ success: true });
      }
      return res.json({ success: false, errMsg: '未知操作' });
    } finally { conn.release(); }
  } catch (e) { return res.json({ success: false, errMsg: e.message }); }
});

// ===== 初始化 =====
app.post('/init', async (req, res) => {
  try {
    const openid = await validateToken(req.body.token);
    const results = [];
    const conn = await (await getPool()).getConnection();
    try {
      if (req.body.firstInit === true) {
        const [existing] = await conn.query('SELECT id FROM admins WHERE openid = ?', [openid]);
        if (existing.length === 0) { await conn.query('INSERT INTO admins (openid) VALUES (?)', [openid]); results.push('admin_created'); }
        else { results.push('admin_exists'); }
      }
      const [sRows] = await conn.query('SELECT id FROM work_status WHERE id = ?', ['WORK_STATUS_SINGLE_RECORD']);
      if (sRows.length === 0) { await conn.query('INSERT INTO work_status (id) VALUES (?)', ['WORK_STATUS_SINGLE_RECORD']); results.push('status_created'); }
      else { results.push('status_exists'); }
      results.push('orders_collection_ready');
      return res.json({ success: true, isAdmin: req.body.firstInit === true, openid, results });
    } finally { conn.release(); }
  } catch (e) { return res.json({ success: false, errMsg: e.message }); }
});

// ===== 字段映射 =====
function formatOrder(row) {
  return {
    _id: row.id, orderRequirements: row.order_requirements,
    createdAt: row.created_at, expectedCompletionTime: row.expected_completion_time,
    imageFileIDs: row.image_fileids ? JSON.parse(row.image_fileids) : [],
    orderAmount: row.order_amount, status: row.status,
    completionTime: row.completion_time, customerName: row.customer_name,
    customerPhone: row.customer_phone, customerOpenId: row.customer_openid,
    createdBy: row.created_by, lastUpdatedAt: row.last_updated_at
  };
}
function formatStatus(row) {
  return {
    _id: row.id, isInStore: row.is_in_store === 1,
    expectedInTime: row.expected_in_time, expectedOutTime: row.expected_out_time,
    expectedStatusTime: row.expected_status_time, statusNote: row.status_note, updatedAt: row.updated_at
  };
}

// ===== 启动 =====
app.listen(PORT, () => {
  console.log('良友制衣店后端启动成功');
  console.log('端口:', PORT);
  console.log('接口: /login, /order, /status, /init');
  if (!APPID || !APPSECRET) console.warn('警告: 未配置 APPID/APPSECRET');
});
