
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖 (OpenCV 需要)
# 注意：在 Debian Trixie 中，libgl1-mesa-glx 已被 libgl1 替代
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# 暴露端口
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
