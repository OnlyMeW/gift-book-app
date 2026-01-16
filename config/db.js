// config/db.js
module.exports = {
  host: 'xxx', // 本地数据库地址，若远程访问填实际 IP
  port: 3306, // 本地 MySQL 端口（默认 3306）
  user: 'root', // 本地数据库用户名
  password: 'xxx', // 本地数据库密码
  database: 'gift_book', // 要使用的数据库名
  connectTimeout: 10000
};
