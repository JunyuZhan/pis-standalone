
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖 (OpenCV 需要 + 构建工具用于编译 insightface)
# 注意：在 Debian Trixie 中，libgl1-mesa-glx 已被 libgl1 替代
# build-essential: 包含 gcc, g++, make 等编译工具
# python3-dev: Python 开发头文件，用于编译 Python C 扩展
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 配置 pip 使用国内镜像源（提高下载速度，避免超时）
# 优先使用清华镜像，失败则尝试阿里云，最后使用官方源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple || \
    pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ || \
    echo "Using default PyPI"

# 增加 pip 超时时间和重试次数
RUN pip config set global.timeout 300 && \
    pip config set global.retries 5 || true

# 升级 pip 到最新版本（提高稳定性）
RUN pip install --upgrade pip --timeout=300 --retries=5

COPY requirements.txt .

# 分步安装依赖，先安装小包，再安装大包（避免超时）
# 先安装基础包
RUN pip install --no-cache-dir --timeout=300 --retries=5 \
    fastapi \
    uvicorn \
    python-multipart \
    numpy || \
    pip install --no-cache-dir --timeout=600 --retries=10 \
    fastapi \
    uvicorn \
    python-multipart \
    numpy

# 再安装大包（opencv-python-headless 约 35MB）
RUN pip install --no-cache-dir --timeout=600 --retries=10 \
    opencv-python-headless || \
    pip install --no-cache-dir --timeout=900 --retries=15 \
    opencv-python-headless

# 最后安装需要编译的包（insightface, onnxruntime）
RUN pip install --no-cache-dir --timeout=600 --retries=10 \
    insightface \
    onnxruntime || \
    pip install --no-cache-dir --timeout=900 --retries=15 \
    insightface \
    onnxruntime

# 清理构建依赖以减小镜像大小（保留运行时依赖）
RUN apt-get update && \
    apt-get purge -y build-essential g++ python3-dev && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY src/ ./src/

# 暴露端口
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
