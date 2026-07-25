
const { getPool } = require('./db');
const crypto = require('crypto');

// 环境变量（由腾讯云SCF控制台配置）
const APPID = process.env.APPID || 'wx6fcc640247c997f4';
const APPSECRET = process.env.APPSECRET || '';

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ===== 微信 code → openid =====
async function code2Session(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg}`);
  }
  return data.openid;
}

// ===== 验证会话Token =====
async function validateToken(token) {
  if (!token) throw new Error('缺少令牌');
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT openid FROM sessions WHERE token = ?', [token]);
    if (rows.length === 0) throw new Error('令牌无效');
    return rows[0].openid;
  } finally {
    conn.release();
  }
}

// ===== 判断是否为管理员 =====
async function isAdmin(openid) {
  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT id FROM admins WHERE openid = ?', [openid]);
    return rows.length > 0;
  } finally {
    conn.release();
  }
}

// ===== 路由分发 =====
exports.main_handler = async (event, context) => {
  try {
    const path = event.path || '';
    let body = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch (e) {}
    }

    switch (path) {
      case '/login': return await handleLogin(body);
      case '/order': return await handleOrder(body);
      case '/status': return await handleStatus(body);
      case '/init': return await handleInit(body);
      default: return { success: false, errMsg: '未知路径: ' + path };
    }
  } catch (e) {
    return { success: false, errMsg: e.message || '服务器错误' };
  }
};

// ===== 登录 =====
async function handleLogin(body) {
  const { code } = body;
  if (!code) return { success: false, errMsg: '缺少code' };

  const openid = await code2Session(code);
  const token = uuid();
  const admin = await isAdmin(openid);

  const conn = await (await getPool()).getConnection();
  try {
    await conn.query('INSERT INTO sessions (token, openid) VALUES (?, ?)', [token, openid]);
    return { success: true, openid, isAdmin: admin, token };
  } finally {
    conn.release();
  }
}

// ===== 订单管理 =====
async function handleOrder(body) {
  const openid = await validateToken(body.token);
  const admin = await isAdmin(openid);

  switch (body.action) {
    case 'create': return await createOrder(body, openid, admin);
    case 'list': return await listOrders(body, openid, admin);
    case 'getDetail': return await getOrderDetail(body, openid, admin);
    case 'update': return await updateOrder(body, openid, admin);
    case 'delete': return await deleteOrder(body, openid, admin);
    case 'updateStatus': return await updateOrderStatus(body, openid, admin);
    default: return { success: false, errMsg: '未知操作' };
  }
}

async function createOrder(body, openid, admin) {
  const { orderRequirements, imageFileIDs, customerName, customerPhone, expectedCompletionTime, orderAmount } = body;
  if (!orderRequirements || !orderRequirements.trim()) {
    return { success: false, errMsg: '订单需求不能为空' };
  }

  const id = uuid();
  const name = customerName || ('用户' + openid.slice(-4));

  const conn = await (await getPool()).getConnection();
  try {
    await conn.query(
      `INSERT INTO orders (id, order_requirements, image_fileids, customer_name, customer_phone,
        customer_openid, created_by, status, expected_completion_time, order_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, orderRequirements.trim(),
        imageFileIDs ? JSON.stringify(imageFileIDs) : '[]',
        name, customerPhone || '', openid,
        admin ? 'shop' : 'user', admin ? 'incomplete' : 'unpaid',
        expectedCompletionTime || null, orderAmount || null
      ]
    );
    return { success: true, data: { _id: id } };
  } finally {
    conn.release();
  }
}

async function listOrders(body, openid, admin) {
  const { status, page = 1, pageSize = 20 } = body;
  const offset = (page - 1) * pageSize;

  let where = '';
  const params = [];
  if (status && ['unpaid', 'incomplete', 'completed'].includes(status)) {
    where = 'WHERE status = ?';
    params.push(status);
  }
  if (!admin) {
    where += (where ? ' AND' : 'WHERE') + ' customer_openid = ?';
    params.push(openid);
  }

  const sortField = status === 'completed' ? 'completion_time' :
    status === 'incomplete' ? 'expected_completion_time' : 'created_at';

  const conn = await (await getPool()).getConnection();
  try {
    const [countRes] = await conn.query(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const [rows] = await conn.query(
      `SELECT * FROM orders ${where} ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    // 转换字段名（snake_case → camelCase）
    const data = rows.map(formatOrder);
    return { success: true, data, total: countRes[0].total, page, pageSize };
  } finally {
    conn.release();
  }
}

async function getOrderDetail(body, openid, admin) {
  const { orderId } = body;
  if (!orderId) return { success: false, errMsg: '缺少订单ID' };

  const conn = await (await getPool()).getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return { success: false, errMsg: '订单不存在' };
    const order = formatOrder(rows[0]);
    if (!admin && order.customerOpenId !== openid) {
      return { success: false, errMsg: '无权访问此订单' };
    }
    return { success: true, data: order };
  } finally {
    conn.release();
  }
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

    const updates = [];
    const params = [];

    if (body.orderRequirements !== undefined) { updates.push('order_requirements = ?'); params.push(body.orderRequirements.trim()); }
    if (body.customerName !== undefined) { updates.push('customer_name = ?'); params.push(body.customerName); }
    if (body.customerPhone !== undefined) { updates.push('customer_phone = ?'); params.push(body.customerPhone); }
    if (body.imageFileIDs !== undefined) { updates.push('image_fileids = ?'); params.push(JSON.stringify(body.imageFileIDs)); }

    if (admin) {
      if (body.expectedCompletionTime !== undefined) { updates.push('expected_completion_time = ?'); params.push(body.expectedCompletionTime); }
      if (body.orderAmount !== undefined) { updates.push('order_amount = ?'); params.push(Number(body.orderAmount)); }
    }

    if (updates.length === 0) return { success: true };
    updates.push('last_updated_at = ?');
    params.push(now());
    params.push(orderId);

    await conn.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
    return { success: true };
  } finally {
    conn.release();
  }
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
  } finally {
    conn.release();
  }
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

    const sql = newStatus === 'completed'
      ? 'UPDATE orders SET status = ?, completion_time = ?, last_updated_at = ? WHERE id = ?'
      : 'UPDATE orders SET status = ?, completion_time = NULL, last_updated_at = ? WHERE id = ?';

    const params = newStatus === 'completed'
      ? [newStatus, now(), now(), orderId]
      : [newStatus, now(), orderId];

    await conn.query(sql, params);
    return { success: true };
  } finally {
    conn.release();
  }
}

// ===== 工作状态 =====
async function handleStatus(body) {
  const conn = await (await getPool()).getConnection();
  try {
    switch (body.action) {
      case 'get': {
        const [rows] = await conn.query('SELECT * FROM work_status WHERE id = ?', ['WORK_STATUS_SINGLE_RECORD']);
        if (rows.length === 0) {
          return { success: true, _id: 'WORK_STATUS_SINGLE_RECORD', isInStore: true, expectedInTime: '09:00', expectedOutTime: '19:00', statusNote: '' };
        }
        return { success: true, ...formatStatus(rows[0]) };
      }
      case 'update': {
        const openid = await validateToken(body.token);
        if (!(await isAdmin(openid))) return { success: false, errMsg: '仅商家可操作' };

        const sets = [];
        const params = [];
        if (body.isInStore !== undefined) { sets.push('is_in_store = ?'); params.push(body.isInStore ? 1 : 0); }
        if (body.statusNote !== undefined) { sets.push('status_note = ?'); params.push(body.statusNote); }
        if (body.expectedStatusTime) { sets.push('expected_status_time = ?'); params.push(body.expectedStatusTime); }
        if (body.expectedInTime) { sets.push('expected_in_time = ?'); params.push(body.expectedInTime); }
        if (body.expectedOutTime) { sets.push('expected_out_time = ?'); params.push(body.expectedOutTime); }
        sets.push('updated_at = ?');
        params.push(now());
        params.push('WORK_STATUS_SINGLE_RECORD');

        await conn.query(
          `INSERT INTO work_status (id, is_in_store, expected_in_time, expected_out_time)
          VALUES ('WORK_STATUS_SINGLE_RECORD', 1, '09:00', '19:00')
          ON DUPLICATE KEY UPDATE id = id`
        );
        await conn.query(`UPDATE work_status SET ${sets.join(', ')} WHERE id = ?`, params);
        return { success: true };
      }
      default: return { success: false, errMsg: '未知操作' };
    }
  } finally {
    conn.release();
  }
}

// ===== 初始化 =====
async function handleInit(body) {
  const openid = await validateToken(body.token);
  const results = [];

  const conn = await (await getPool()).getConnection();
  try {
    if (body.firstInit === true) {
      const [existing] = await conn.query('SELECT id FROM admins WHERE openid = ?', [openid]);
      if (existing.length === 0) {
        await conn.query('INSERT INTO admins (openid) VALUES (?)', [openid]);
        results.push('admin_created');
      } else {
        results.push('admin_exists');
      }
    }
    // 确保 work_status 存在
    const [statusRows] = await conn.query('SELECT id FROM work_status WHERE id = ?', ['WORK_STATUS_SINGLE_RECORD']);
    if (statusRows.length === 0) {
      await conn.query('INSERT INTO work_status (id) VALUES (?)', ['WORK_STATUS_SINGLE_RECORD']);
      results.push('status_created');
    } else {
      results.push('status_exists');
    }
    results.push('orders_collection_ready');

    return { success: true, isAdmin: body.firstInit === true, openid, results };
  } finally {
    conn.release();
  }
}

// ===== 工具函数：字段映射 =====
function formatOrder(row) {
  return {
    _id: row.id,
    orderRequirements: row.order_requirements,
    createdAt: row.created_at,
    expectedCompletionTime: row.expected_completion_time,
    imageFileIDs: row.image_fileids ? JSON.parse(row.image_fileids) : [],
    orderAmount: row.order_amount,
    status: row.status,
    completionTime: row.completion_time,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerOpenId: row.customer_openid,
    createdBy: row.created_by,
    lastUpdatedAt: row.last_updated_at
  };
}

function formatStatus(row) {
  return {
    _id: row.id,
    isInStore: row.is_in_store === 1,
    expectedInTime: row.expected_in_time,
    expectedOutTime: row.expected_out_time,
    expectedStatusTime: row.expected_status_time,
    statusNote: row.status_note,
    updatedAt: row.updated_at
  };
}
