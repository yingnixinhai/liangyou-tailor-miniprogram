
-- ===== 良友制衣店 数据库初始化 =====

CREATE DATABASE IF NOT EXISTS liangyou_tailor DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE liangyou_tailor;

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  order_requirements TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_completion_time DATETIME NULL,
  image_fileids TEXT NULL COMMENT 'JSON数组，如["fileid1","fileid2"]',
  order_amount DECIMAL(10,2) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' COMMENT 'unpaid|incomplete|completed',
  completion_time DATETIME NULL,
  customer_name VARCHAR(100) NOT NULL DEFAULT '',
  customer_phone VARCHAR(30) NOT NULL DEFAULT '',
  customer_openid VARCHAR(100) NOT NULL,
  created_by VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT 'user|shop',
  last_updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_status_created (status, created_at DESC),
  INDEX idx_customer (customer_openid, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工作状态表（始终只有一条记录）
CREATE TABLE IF NOT EXISTS work_status (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'WORK_STATUS_SINGLE_RECORD',
  is_in_store TINYINT(1) NOT NULL DEFAULT 1,
  expected_in_time VARCHAR(5) NOT NULL DEFAULT '09:00',
  expected_out_time VARCHAR(5) NOT NULL DEFAULT '19:00',
  expected_status_time DATETIME NULL,
  status_note TEXT NULL,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY,
  openid VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化默认工作状态
INSERT INTO work_status (id, is_in_store, expected_in_time, expected_out_time, status_note)
VALUES ('WORK_STATUS_SINGLE_RECORD', 1, '09:00', '19:00', '')
ON DUPLICATE KEY UPDATE is_in_store = is_in_store;
