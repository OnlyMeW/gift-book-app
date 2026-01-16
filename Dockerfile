# 基础镜像
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 先复制依赖配置文件（利用Docker缓存，避免每次都重装依赖）
COPY package.json package-lock.json* ./

# 安装依赖（强制安装，忽略缓存）
RUN npm install --production --no-cache --force

# 复制项目所有文件（最后复制，避免代码变动触发依赖重装）
COPY . .

# 暴露端口（host模式下仅作标识，不影响实际访问）
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]