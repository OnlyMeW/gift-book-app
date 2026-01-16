document.addEventListener('DOMContentLoaded', () => {
    // 切换登录/注册表单
    const tabBtns = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // 更新表单显示
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tab}-form`) {
                    form.classList.add('active');
                }
            });
        });
    });

    // 通用提示函数
    function showToast(message, isError = false) {
        // 移除旧提示
        const oldToast = document.querySelector('.toast');
        if (oldToast) oldToast.remove();
        
        // 创建新提示
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        toast.style.backgroundColor = isError ? '#ff4d4f' : '#52c41a';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 显示提示
        setTimeout(() => toast.style.opacity = 1, 100);
        // 3秒后隐藏
        setTimeout(() => {
            toast.style.opacity = 0;
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 登录表单提交
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (data.code === 0) {
                showToast('登录成功，即将跳转');
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.user.username);
                // 延迟跳转，确保提示可见
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showToast(data.message || '登录失败', true);
            }
        } catch (err) {
            showToast('网络错误，请检查服务器是否运行', true);
            console.error('登录请求失败：', err);
        }
    });

    // 注册表单提交
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const confirm = document.getElementById('reg-confirm').value.trim();
        
        // 前端校验
        if (password !== confirm) {
            showToast('两次密码输入不一致', true);
            return;
        }
        if (password.length < 6) {
            showToast('密码长度不能少于6位', true);
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (data.code === 0) {
                showToast(data.message || '注册成功');
                // 切换到登录表单
                tabBtns[0].click();
                // 清空注册表单
                document.getElementById('reg-username').value = '';
                document.getElementById('reg-password').value = '';
                document.getElementById('reg-confirm').value = '';
            } else {
                showToast(data.message || '注册失败', true);
            }
        } catch (err) {
            showToast('网络错误，请检查服务器是否运行', true);
            console.error('注册请求失败：', err);
        }
    });
});