const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

// 核心配置：允许跨域+解析JSON+静态资源
app.use(cors({
    origin: '*', // 开发环境放宽限制，生产可指定具体域名
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
// 关键：正确配置静态资源目录（匹配项目结构）
app.use(express.static(path.join(__dirname), {
    // 强制设置CSS/JS的MIME类型，避免样式报错
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// 从环境变量读取数据库配置（适配Docker）
const dbConfig = {
    host: process.env.DB_HOST || '172.17.0.1',
    user: process.env.DB_USER || 'root', // 替换为你的MySQL实际用户名
    password: process.env.DB_PASSWORD || '你的MySQL密码', // 必须替换为实际密码
    database: process.env.DB_NAME || 'gift_book',
    port: process.env.DB_PORT || 3306,
    connectTimeout: 10000,
    charset: 'utf8mb4'
};

// JWT配置（建议替换为随机字符串，如：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
const JWT_SECRET = process.env.JWT_SECRET || 'gift_book_2025_secure_key_123456';
const JWT_EXPIRES = '24h';

// 测试数据库连接（启动时验证）
async function testDbConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ 数据库连接成功！');
        connection.end();
    } catch (err) {
        console.error('❌ 数据库连接失败：', err.message);
        process.exit(1); // 连接失败则退出服务
    }
}
testDbConnection();

// -------------------------- 核心接口修复 --------------------------
// 1. 注册接口（增加重复用户名检测+错误反馈）
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 基础校验
        if (!username || !password) {
            return res.status(400).json({ code: -1, message: '用户名/密码不能为空' });
        }
        if (password.length < 6) {
            return res.status(400).json({ code: -1, message: '密码长度不能少于6位' });
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // 检查用户名是否已存在
        const [userRows] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (userRows.length > 0) {
            connection.end();
            return res.status(400).json({ code: -1, message: '用户名已存在' });
        }

        // 加密密码+插入数据库
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        connection.end();

        res.status(200).json({ code: 0, message: '注册成功，请登录' });
    } catch (err) {
        console.error('注册失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// 2. 登录接口（增加详细错误反馈）
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 基础校验
        if (!username || !password) {
            return res.status(400).json({ code: -1, message: '用户名/密码不能为空' });
        }

        const connection = await mysql.createConnection(dbConfig);
        const [userRows] = await connection.execute(
            'SELECT id, username, password FROM users WHERE username = ?',
            [username]
        );
        connection.end();

        // 校验用户是否存在
        if (userRows.length === 0) {
            return res.status(401).json({ code: -1, message: '用户名不存在' });
        }

        const user = userRows[0];
        // 校验密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ code: -1, message: '密码错误' });
        }

        // 生成JWT Token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.status(200).json({
            code: 0,
            message: '登录成功',
            token: token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error('登录失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// 3. 修改密码接口（修复权限验证）
app.post('/api/change-password', async (req, res) => {
    try {
        // 校验Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录，请先登录' });
        }
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ code: -1, message: 'Token过期/无效，请重新登录' });
        }

        const { oldPassword, newPassword } = req.body;
        // 基础校验
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ code: -1, message: '原密码/新密码不能为空' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ code: -1, message: '新密码长度不能少于6位' });
        }

        const connection = await mysql.createConnection(dbConfig);
        // 获取当前用户信息
        const [userRows] = await connection.execute(
            'SELECT id, password FROM users WHERE id = ?',
            [decoded.userId]
        );
        if (userRows.length === 0) {
            connection.end();
            return res.status(401).json({ code: -1, message: '用户不存在' });
        }

        const user = userRows[0];
        // 校验原密码
        const isOldPwdValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPwdValid) {
            connection.end();
            return res.status(401).json({ code: -1, message: '原密码错误' });
        }

        // 更新新密码
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await connection.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedNewPassword, decoded.userId]
        );
        connection.end();

        res.status(200).json({ code: 0, message: '密码修改成功，请重新登录' });
    } catch (err) {
        console.error('修改密码失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// 4. 验证登录状态接口（供前端校验）
app.get('/api/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.status(200).json({ code: 0, user: decoded });
    } catch (err) {
        res.status(401).json({ code: -1, message: 'Token无效/过期' });
    }
});
// -------------------------- 礼金数据接口 --------------------------
// 1. 获取当前用户的礼金列表
app.get('/api/gifts', async (req, res) => {
    try {
        // 验证Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        // 查询当前用户的礼金记录（关联events表，默认创建一个默认事项）
        const connection = await mysql.createConnection(dbConfig);
        // 先检查是否有默认事项，没有则创建
        let [eventRows] = await connection.execute(
            'SELECT id FROM events WHERE user_id = ? AND title = ?',
            [userId, '默认事项']
        );
        let eventId;
        if (eventRows.length === 0) {
            // 创建默认事项
            await connection.execute(
                'INSERT INTO events (title, user_id) VALUES (?, ?)',
                ['默认事项', userId]
            );
            // 获取新创建的事项ID
            [eventRows] = await connection.execute(
                'SELECT id FROM events WHERE user_id = ? AND title = ?',
                [userId, '默认事项']
            );
            eventId = eventRows[0].id;
        } else {
            eventId = eventRows[0].id;
        }

        // 查询礼金记录
        const [giftRows] = await connection.execute(
            'SELECT * FROM gifts WHERE event_id = ? ORDER BY created_at DESC',
            [eventId]
        );
        connection.end();

        res.status(200).json({
            code: 0,
            message: '获取成功',
            data: giftRows
        });
    } catch (err) {
        console.error('获取礼金列表失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// 2. 新增礼金记录
app.post('/api/gifts', async (req, res) => {
    try {
        // 验证Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const { name, amount, type, remark } = req.body;
        // 基础校验
        if (!name || !amount) {
            return res.status(400).json({ code: -1, message: '姓名和金额不能为空' });
        }

        const connection = await mysql.createConnection(dbConfig);
        // 获取当前用户的默认事项ID
        let [eventRows] = await connection.execute(
            'SELECT id FROM events WHERE user_id = ? AND title = ?',
            [userId, '默认事项']
        );
        let eventId;
        if (eventRows.length === 0) {
            // 创建默认事项
            await connection.execute(
                'INSERT INTO events (title, user_id) VALUES (?, ?)',
                ['默认事项', userId]
            );
            [eventRows] = await connection.execute(
                'SELECT id FROM events WHERE user_id = ? AND title = ?',
                [userId, '默认事项']
            );
            eventId = eventRows[0].id;
        } else {
            eventId = eventRows[0].id;
        }

        // 插入礼金记录
        await connection.execute(
            'INSERT INTO gifts (event_id, name, amount, type, remark) VALUES (?, ?, ?, ?, ?)',
            [eventId, name, amount, type || '现金', remark || '']
        );
        // 记录操作日志
        await connection.execute(
            'INSERT INTO logs (user_id, event_id, action) VALUES (?, ?, ?)',
            [userId, eventId, `新增礼金记录：${name} - ${amount}元`]
        );
        connection.end();

        res.status(200).json({ code: 0, message: '新增成功' });
    } catch (err) {
        console.error('新增礼金失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// 3. 删除礼金记录
app.delete('/api/gifts/:id', async (req, res) => {
    try {
        // 验证Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const giftId = req.params.id;
        const connection = await mysql.createConnection(dbConfig);

        // 校验该礼金记录是否属于当前用户
        const [giftRows] = await connection.execute(
            'SELECT g.*, e.user_id FROM gifts g LEFT JOIN events e ON g.event_id = e.id WHERE g.id = ?',
            [giftId]
        );
        if (giftRows.length === 0) {
            connection.end();
            return res.status(404).json({ code: -1, message: '记录不存在' });
        }
        if (giftRows[0].user_id !== userId) {
            connection.end();
            return res.status(403).json({ code: -1, message: '无权限删除该记录' });
        }

        // 删除礼金记录
        await connection.execute('DELETE FROM gifts WHERE id = ?', [giftId]);
        // 记录操作日志
        await connection.execute(
            'INSERT INTO logs (user_id, event_id, action) VALUES (?, ?, ?)',
            [userId, giftRows[0].event_id, `删除礼金记录ID：${giftId}`]
        );
        connection.end();

        res.status(200).json({ code: 0, message: '删除成功' });
    } catch (err) {
        console.error('删除礼金失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});

// -------------------------- 新增：清空所有礼金记录 --------------------------
app.post('/api/gifts/clear', async (req, res) => {
    try {
        // 验证Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ code: -1, message: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const connection = await mysql.createConnection(dbConfig);
        // 获取当前用户的默认事项ID
        const [eventRows] = await connection.execute(
            'SELECT id FROM events WHERE user_id = ? AND title = ?',
            [userId, '默认事项']
        );
        if (eventRows.length === 0) {
            connection.end();
            return res.status(400).json({ code: -1, message: '暂无记录可清空' });
        }
        const eventId = eventRows[0].id;

        // 清空该用户的礼金记录
        await connection.execute('DELETE FROM gifts WHERE event_id = ?', [eventId]);
        // 记录日志
        await connection.execute(
            'INSERT INTO logs (user_id, event_id, action) VALUES (?, ?, ?)',
            [userId, eventId, '清空所有礼金记录']
        );
        connection.end();

        res.status(200).json({ code: 0, message: '清空成功' });
    } catch (err) {
        console.error('清空礼金记录失败：', err);
        res.status(500).json({ code: -1, message: '服务器错误：' + err.message });
    }
});
// -------------------------- 页面路由配置 --------------------------
// 访问根路径跳转到登录页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ 服务已启动：http://0.0.0.0:${PORT}`);
});