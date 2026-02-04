
from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from typing import List
from pydantic import BaseModel
import os

app = FastAPI()

# 初始化 InsightFace
# 使用 buffalo_l 模型 (检测+识别)
# 注意：首次运行会自动下载模型到 ~/.insightface/models
print("Initializing InsightFace model...")
model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
model.prepare(ctx_id=0, det_size=(640, 640))
print("InsightFace initialized.")

class FaceEmbedding(BaseModel):
    embedding: List[float]
    bbox: List[int]
    det_score: float

@app.get("/")
def read_root():
    return {"status": "ok", "service": "pis-ai"}

@app.post("/extract")
async def extract_face(file: UploadFile = File(...)):
    try:
        # 读取图片
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": "Invalid image data", "faces": []}
        
        # 提取人脸
        faces = model.get(img)
        
        results = []
        for face in faces:
            results.append({
                "embedding": face.embedding.tolist(), # 512d vector
                "bbox": face.bbox.astype(int).tolist(), # [x1, y1, x2, y2]
                "det_score": float(face.det_score)
            })
            
        return {"faces": results}
    except Exception as e:
        print(f"Error extracting face: {e}")
        return {"error": str(e), "faces": []}
