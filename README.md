# 电子礼簿系统（Gift Book app）
电子礼簿系统是一款面向喜事礼金记录的 Web 应用，支持用户注册登录、礼金录入、密码修改等功能。系统采用前后端分离架构，前端使用原生 HTML + JavaScript + Tailwind CSS，后端使用 Node.js + Express + MySQL，可通过 Docker Compose 一键部署。数据持久化存储到 MySQL中。
# 功能特点
- 用户注册与登录
- 登录后可修改密码、退出登录
- 礼金记录录入（姓名、金额、金额大写、类型）
- 数据持久化存储到 MySQL
- 基于用户 ID 的数据权限隔离
- 支持 Docker Compose 一键部署
# 技术栈
## 前端：
- HTML5
JavaScript (ES6+)
- Tailwind CSS v3
- Remix Icon（图标）
## 后端：
- Node.js
- Express
- MySQL2（Promise 封装）
- bcryptjs（密码加密）
- jsonwebtoken（身份认证）
# 部署：
- Docker
- Docker Compose
- Nginx（前端静态资源服务）
## 项目结构
```
gift-book/
├── index.html              # 前端入口页面
├── static/                 # 静态资源目录
│   ├── tailwindcss.js      # Tailwind CSS
│   ├── remixicon.css       # Remix Icon 样式
│   └── ...                 # 其他静态资源
├── server/                 # 后端服务目录
│   ├── index.js            # 后端主程序
│   └── package.json        # 后端依赖
└── docker-compose.yml      # Docker Compose 配置文件
```
## 部署方式（Docker Compose）
### 环境要求
- Docker
- Docker Compose
- MySQL 5.7+（可在本地或远程）
### 1. 数据库准备
登录 MySQL，创建数据库：
```
CREATE DATABASE gift_book CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gift_book;
```
- 创建数据表：
```
-- 用户表
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 事项表
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 礼金记录表
CREATE TABLE gifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  amount_chinese VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  is_valid TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id)
);
```
- 授权用户远程访问（如果数据库不在本地容器中）：
```
GRANT ALL PRIVILEGES ON gift_book.* TO 'root'@'%' IDENTIFIED BY 'your_password' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```
### 2. 配置修改
编辑 docker-compose.yml，修改数据库连接信息：
```
version: '3.8'

services:
  gift-book:
    build: .
    restart: always
    container_name: gift-book
    network_mode: host # 关键：共享宿主网络，便于访问本地MySQL
    environment:
      - NODE_ENV=production
      # 数据库配置（必须替换为你的实际信息）
      - DB_HOST=172.17.0.1
      - DB_USER=root # 你的MySQL用户名
      - DB_PASSWORD=xxx # 替换为实际密码
      - DB_NAME=gift_book
      - DB_PORT=3306
      # JWT密钥（建议替换为随机字符串）
      - JWT_SECRET=gift_book_2025_secure_key_123456
      - PORT=56021
    volumes:
      # 挂载本地项目目录到容器，修改代码无需重新构建
      - ./:/app
      - /app/node_modules
    # 移除ports（host模式下无效）
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# 无需创建MySQL容器（使用本地已有）
volumes:
  mysql-data: # 仅保留空定义，避免报错
    external: false  
```  
### 3. 启动服务
在项目根目录执行：
`docker-compose up -d`
### 4. 访问系统
打开浏览器访问：
http://<服务器IP>:8080
# 使用说明
## 1. 注册与登录
打开首页，点击「注册」，输入用户名和密码完成注册
注册后返回登录页，输入用户名和密码登录系统
## 2. 事项管理
登录后，可创建新事项（如婚礼、寿宴等）
选择已有事项进入礼金记录页面
## 3. 礼金记录
在事项页面中，填写姓名、金额、类型，点击「保存」录入礼金
已录入的记录可在下方表格中查看
点击「作废」按钮可将记录标记为无效（无需理由）
## 4. 个人设置
点击「修改密码」，输入原密码和新密码完成密码修改
点击「退出登录」返回登录页面
# 开发说明
## 前端开发
主要页面为 index.html，包含登录、注册、事项管理、礼金录入等模块
使用 Tailwind CSS 进行样式管理
通过 fetch 调用后端 API 完成数据交互
## 后端开发
后端入口文件为 server.js

# 常见问题
## 1. 后端连接数据库超时（ETIMEDOUT）
确认数据库地址、端口正确
确认数据库允许远程连接
确认服务器防火墙已开放 3306 端口
进入后端容器测试连通性：
```
docker exec -it gift-book-backend-1 ping <DB_HOST>
docker exec -it gift-book-backend-1 telnet <DB_HOST> 3306
```
## 2. 前端页面无法访问
检查 8080 端口是否被占用
查看前端容器日志：
`
docker logs gift-book-frontend-1`
## 3. 接口调用失败
检查后端容器是否正常运行：
`
docker ps | grep gift-book-backend-1`
查看后端日志：
`
docker logs gift-book-backend-1`
#  许可证
本项目为个人开源项目，仅供学习和自用，可根据需要自由修改和扩展。
