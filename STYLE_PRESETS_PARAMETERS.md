# PIS 风格预设参数列表

## 参数说明

- **brightness**: 亮度 (0.0 - 2.0, 默认 1.0)
- **contrast**: 对比度 (-1.0 - 1.0, 默认 0.0)
- **saturation**: 饱和度 (0.0 - 2.0, 默认 1.0)
- **gamma**: 伽马校正 (0.1 - 3.0, 默认 1.0)
- **hue**: 色相旋转 (0 - 360 度, 默认 0)
  - 正值：向暖色方向旋转（红→黄→绿）
  - 负值：向冷色方向旋转（红→紫→蓝）
- **tint**: RGB 色调叠加，用于色温模拟 (0-255)

---

## 人物风格（5个）

### 1. 日系小清新 (japanese-fresh)
- **描述**: 温暖柔和的光线，温柔清新的氛围，适合人像摄影
- **参数**:
  - brightness: 1.05
  - contrast: -0.1
  - saturation: 0.9
  - gamma: 1.05
  - hue: 10
  - tint: { r: 255, g: 250, b: 245 }

### 2. 胶片人像 (film-portrait)
- **描述**: 模拟胶片质感，增强层次感和故事性
- **参数**:
  - brightness: 1.0
  - contrast: 0.15
  - saturation: 1.1
  - gamma: 1.1
  - hue: 5
  - tint: { r: 255, g: 252, b: 248 }

### 3. 电影感人像 (cinematic-portrait)
- **描述**: 电影级调色，柔和的高光和暖色调，适合浪漫场景
- **参数**:
  - brightness: 0.95
  - contrast: 0.25
  - saturation: 0.85
  - gamma: 1.15
  - hue: 15
  - tint: { r: 255, g: 248, b: 240 }

### 4. 写实人像 (realistic-portrait)
- **描述**: 保留真实色彩和细节，突出皮肤透明度和纹理
- **参数**:
  - brightness: 1.02
  - contrast: 0.1
  - saturation: 1.05
  - gamma: 1.0
  - hue: 0

### 5. 温暖人像 (warm-portrait)
- **描述**: 温暖的色调，适合人像和室内拍摄
- **参数**:
  - brightness: 1.05
  - saturation: 1.1
  - gamma: 1.05
  - hue: 10
  - tint: { r: 255, g: 250, b: 245 }

---

## 风景风格（5个）

### 6. 自然风光 (natural-landscape)
- **描述**: 保留自然色彩平衡，强调原始质感
- **参数**:
  - brightness: 1.0
  - contrast: 0.1
  - saturation: 1.15
  - gamma: 1.0
  - hue: 0

### 7. 电影感风光 (cinematic-landscape)
- **描述**: 电影级调色，独特的色调和情绪化氛围
- **参数**:
  - brightness: 0.95
  - contrast: 0.3
  - saturation: 0.9
  - gamma: 1.2
  - hue: 5
  - tint: { r: 255, g: 250, b: 245 }

### 8. 胶片风光 (film-landscape)
- **描述**: 模拟35mm胶片复古美学，具有颗粒纹理感
- **参数**:
  - brightness: 1.0
  - contrast: 0.2
  - saturation: 1.1
  - gamma: 1.1
  - hue: 8
  - tint: { r: 255, g: 252, b: 248 }

### 9. 鲜艳风光 (vibrant-landscape)
- **描述**: 增强色彩饱和度，明亮鲜艳
- **参数**:
  - brightness: 1.1
  - saturation: 1.3
  - contrast: 0.1
  - gamma: 1.0

### 10. 黄金时刻 (golden-hour)
- **描述**: 暖色调和金色色调，适合日落和黄金时段
- **参数**:
  - brightness: 1.05
  - saturation: 1.2
  - gamma: 1.05
  - hue: 20
  - tint: { r: 255, g: 245, b: 235 }

---

## 通用风格（3个）

### 11. 黑白 (black-white)
- **描述**: 经典黑白效果
- **参数**:
  - saturation: 0
  - contrast: 0.2
  - brightness: 1.0

### 12. 复古 (vintage)
- **描述**: 温暖的复古色调，增强对比度和饱和度
- **参数**:
  - brightness: 1.05
  - contrast: 0.15
  - saturation: 1.1
  - hue: -10  (已修正，原为 15)
  - gamma: 1.1

### 13. 冷色调 (cool)
- **描述**: 清爽的冷色调
- **参数**:
  - brightness: 1.0
  - saturation: 0.9
  - hue: 15  (已修正，原为 -10)

---

## 注意事项

1. **hue 参数方向**：
   - 正值（如 10, 15, 20）：向暖色方向（黄/橙）
   - 负值（如 -10）：向冷色方向（蓝/青）
   - 0：无色相偏移

2. **tint 参数**：
   - RGB 值范围：0-255
   - 暖色调通常 R > G > B（如 {255, 250, 245}）
   - 冷色调通常 B > G > R

3. **已修正的风格**：
   - 复古和冷色调的 hue 值已交换（基于用户反馈）
