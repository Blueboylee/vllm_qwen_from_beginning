# GPU 实时监控（WebSocket 版）

基于 **pynvml + Socket.io + Recharts** 的实时 GPU 监控面板。

## 启动步骤

### 1. 安装后端依赖

```powershell
pip install -r requirements_monitor.txt
```

或单独安装：

```powershell
pip install flask flask-cors flask-socketio pynvml
```

### 2. 启动 GPU WebSocket 服务

```powershell
python gpu_ws_monitor.py
```

服务运行在 **http://localhost:5001**，每 500ms 推送一次 GPU 数据。

### 3. 安装前端依赖并启动

```powershell
cd web
npm install
npm run dev
```

### 4. 打开 GPU 面板

浏览器访问 http://localhost:3000，点击顶部 **GPU** 标签。

## 监控指标

| 指标 | 说明 |
|------|------|
| **VRAM Alloc vs Total** | 已用显存 vs 总显存。vLLM 会预分配 KV Cache 池。 |
| **SM 利用率** | 流处理器占用。低 SM + 高显存带宽 → Memory-bound。 |
| **显存控制器利用率** | 显存带宽占用。 |
| **GPU 功耗 (W)** | 未跑满说明算子未充分利用流水线。 |
| **PCIe 吞吐量** | Host↔GPU 传输速率，超长上下文时关键。 |
| **GPU 温度** | 核心温度 (°C)。 |

## 环境变量

- `VITE_GPU_WS_URL`：WebSocket 服务地址，默认 `http://localhost:5001`  
  若部署到其他机器，在 `web/.env` 中设置：
  ```
  VITE_GPU_WS_URL=http://你的服务器IP:5001
  ```

## 故障排除

### pynvml 初始化失败

- 确保已安装 NVIDIA 驱动
- 在命令行运行 `nvidia-smi` 能正常输出

### 前端显示「连接失败」

- 确认 `gpu_ws_monitor.py` 已启动
- 浏览器访问 http://localhost:5001 应能连通
- 检查防火墙是否拦截 5001 端口

### PCIe 数据为 0

- 部分驱动或显卡不支持 `nvmlDeviceGetPcieThroughput`，可忽略
