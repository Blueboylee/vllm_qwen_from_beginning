# Qwen vLLM 推理服务 & 实时 GPU 监控

# Qwen vLLM Inference Service & Real-time GPU Monitor

---

## 简介 | Introduction

**中文**

一个完整的本地大模型推理 + 实时监控项目。在 WSL 中使用 vLLM 运行 Qwen 2.5 模型，配合 React Web 界面提供：

- ChatGPT 风格的流式对话
- vLLM 推理指标监控（KV Cache、吞吐量、延迟等）
- 基于 WebSocket 的实时 GPU 硬件监控（显存、SM 利用率、功耗、温度、PCIe 吞吐量）

**English**

A complete local LLM inference + real-time monitoring project. Run Qwen 2.5 with vLLM in WSL, paired with a React web UI that provides:

- ChatGPT-style streaming chat
- vLLM inference metrics monitoring (KV Cache, throughput, latency, etc.)
- WebSocket-based real-time GPU hardware monitoring (VRAM, SM utilization, power draw, temperature, PCIe throughput)

---

## 项目结构 | Project Structure

```
vllm_qwen_from_beginning/
├── main.py                  # vLLM 离线推理示例 / Offline inference example
├── gpu_monitor.py           # GPU 监控 REST API (轮询) / GPU monitor REST API (polling)
├── gpu_ws_monitor.py        # GPU 监控 WebSocket 服务 / GPU monitor WebSocket service
├── requirements_monitor.txt # Python 依赖 / Python dependencies
├── docs/
│   ├── VLLM_METRICS_SETUP.md
│   └── CONTINUOUS_BATCHING.md
└── web/                     # React 前端 / React frontend
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx          # 主应用：对话 + 监控 + GPU 三标签页 / Main app: Chat + Monitor + GPU tabs
        ├── api.ts           # vLLM OpenAI 兼容流式 API / Streaming API client
        ├── Monitor.tsx      # vLLM Prometheus 指标面板 / vLLM metrics dashboard
        ├── GpuDashboard.tsx # 实时 GPU 面板 (Socket.IO + Recharts) / Real-time GPU dashboard
        └── ...
```

---

## 技术栈 | Tech Stack

| 层 / Layer | 技术 / Technology |
|---|---|
| LLM 推理 / Inference | [vLLM](https://docs.vllm.ai/) + Qwen 2.5 (WSL / Linux) |
| GPU 数据采集 / GPU Data | [pynvml](https://pypi.org/project/pynvml/) (NVIDIA NVML) |
| 后端推送 / Backend Push | Flask + Flask-SocketIO (WebSocket, 500ms interval) |
| REST 监控 / REST Monitor | Flask + nvidia-smi subprocess (polling, 2s interval) |
| 前端 / Frontend | React 18 + TypeScript + Vite |
| 图表 / Charts | [Recharts](https://recharts.org/) |
| 实时通信 / Realtime | [Socket.IO](https://socket.io/) client |

---

## 快速开始 | Quick Start

### 前置条件 | Prerequisites

- Windows 10/11 + WSL2（运行 vLLM）
- NVIDIA GPU + 驱动（Windows 侧可运行 `nvidia-smi`）
- Python 3.10+
- Node.js 18+

### 1. 启动 vLLM 服务（WSL） | Start vLLM Service (WSL)

```bash
# 在 WSL 中 / In WSL
python -m vllm.entrypoints.openai.api_server \
  --model qwen/Qwen2.5-3B-Instruct \
  --port 8000 \
  --host 0.0.0.0
```

### 2. 安装后端依赖 | Install Backend Dependencies

```powershell
# 在 Windows PowerShell 中 / In Windows PowerShell
pip install -r requirements_monitor.txt
```

依赖列表 / Dependencies:

```
flask==3.0.0
flask-cors==4.0.0
flask-socketio==5.3.6
python-socketio==5.10.0
python-engineio==4.8.0
pynvml==11.5.0
```

### 3. 启动 GPU 监控服务 | Start GPU Monitor

有两种 GPU 监控模式可选 / Two GPU monitoring modes available:

**模式 A: WebSocket 实时推送（推荐）/ Mode A: WebSocket Real-time Push (Recommended)**

```powershell
python gpu_ws_monitor.py
# 服务地址 / Service: http://localhost:5001
# 推送间隔 / Push interval: 500ms
```

**模式 B: REST API 轮询 / Mode B: REST API Polling**

```powershell
python gpu_monitor.py
# 服务地址 / Service: http://localhost:5000/api/gpu
```

### 4. 启动前端 | Start Frontend

```powershell
cd web
npm install
npm run dev
# 浏览器访问 / Open browser: http://localhost:3000
```

---

## 功能介绍 | Features

### 对话界面 | Chat Interface

- ChatGPT 风格 UI，深色主题 / ChatGPT-style UI with dark theme
- 流式输出，逐字显示 / Streaming output, token by token
- 多轮对话上下文 / Multi-turn conversation context
- 调用 vLLM 的 OpenAI 兼容 API (`/v1/chat/completions`) / Uses vLLM's OpenAI-compatible API

### vLLM 监控面板 | vLLM Metrics Dashboard

- 每 2 秒自动拉取 `/metrics`（Prometheus 格式）/ Auto-fetches `/metrics` every 2s (Prometheus format)
- 关键指标卡片 + 趋势小图 / Key metric cards with mini sparklines

| 指标 / Metric | 说明 / Description |
|---|---|
| KV Cache 使用率 / KV Cache Usage | KV 缓存占用百分比 / KV cache utilization percentage |
| 吞吐量 / Throughput | tokens/s（基于差分计算）/ tokens/s (delta-based) |
| 延迟 / Latency | P50 / P95 / P99 / TTFT |
| 队列长度 / Queue Length | 等待处理的请求数 / Pending requests count |

### GPU 实时面板 | Real-time GPU Dashboard

- 基于 Socket.IO 的 WebSocket 推送，500ms 刷新 / Socket.IO WebSocket push, 500ms refresh
- 6 张实时折线图 / 6 real-time line charts:

| 图表 / Chart | 指标 / Metrics |
|---|---|
| VRAM Alloc vs Total | 已用显存 vs 总显存 (MB) / Used vs Total VRAM (MB) |
| SM / 显存控制器利用率 | GPU 核心 + 显存带宽利用率 (%) / SM + Memory controller utilization (%) |
| GPU 功耗 | 实时功耗 (W) / Real-time power draw (W) |
| PCIe 吞吐量 | Host↔GPU 传输速率 (KB/s) / Host↔GPU transfer rate (KB/s) |
| GPU 温度 | 核心温度 (°C) / Core temperature (°C) |

---

## 架构图 | Architecture

### 统一后端模式（推荐）| Unified Server Mode (Recommended)

```
┌──────────────────────────────────────────────────────┐
│              server.py  (port 8000)                   │
│                                                      │
│  ┌─────────────────┐    ┌────────────────────────┐   │
│  │  vLLM Engine     │    │  GPU Monitor (pynvml)  │   │
│  │  AsyncLLMEngine  │    │  500ms WebSocket push  │   │
│  └────────┬────────┘    └───────────┬────────────┘   │
│           │                         │                 │
│  ┌────────┴─────────────────────────┴──────────────┐ │
│  │              FastAPI + Socket.IO                 │ │
│  │  POST /v1/chat/completions  (streaming SSE)     │ │
│  │  GET  /metrics              (Prometheus)        │ │
│  │  GET  /api/gpu              (REST)              │ │
│  │  WS   /gpu                  (Socket.IO)         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │
              ┌────────┴────────┐
              │  Vite Dev :3000  │
              │  (proxy → 8000)  │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │   Browser UI    │
              │ Chat│Monitor│GPU │
              └─────────────────┘
```

### 分离模式 | Separate Mode

```
WSL2: vLLM :8000 ──┐
                    ├──► Vite :3000 ──► Browser
Windows: GPU :5001 ─┘
```

---

## 环境变量 | Environment Variables

| 变量 / Variable | 默认值 / Default | 说明 / Description |
|---|---|---|
| `VITE_GPU_WS_URL` | *(空，同源)* | GPU WebSocket 服务地址 / GPU WebSocket service URL |

统一后端模式下，前端通过 Vite 代理自动连接到 `:8000`，无需额外配置。

In unified mode, the frontend auto-connects via Vite proxy to `:8000`, no extra config needed.

如需连接远程 GPU 服务器，在 `web/.env` 中设置 / To connect to a remote GPU server, set in `web/.env`:

```env
VITE_GPU_WS_URL=http://your-server-ip:8000
```

---

## 代理配置 | Proxy Configuration

Vite 开发服务器代理规则（`web/vite.config.ts`）/ Vite dev server proxy rules:

| 路径 / Path | 目标 / Target | 用途 / Purpose |
|---|---|---|
| `/v1/*` | `http://localhost:8000` | OpenAI 兼容 API / Chat completions |
| `/metrics` | `http://localhost:8000` | Prometheus 指标 / Metrics |
| `/api/*` | `http://localhost:8000` | GPU REST 接口 / GPU REST API |
| `/socket.io` | `http://localhost:8000` | GPU WebSocket (Socket.IO) |

---

## 故障排除 | Troubleshooting

### pynvml / nvidia-smi 不可用

- 确保已安装 NVIDIA 驱动 / Ensure NVIDIA driver is installed
- 在 PowerShell 运行 `nvidia-smi` 验证 / Run `nvidia-smi` in PowerShell to verify
- 如果在 WSL 中跑模型、Windows 跑监控，Windows 侧需要能访问 GPU / If running model in WSL but monitor on Windows, ensure GPU is accessible from Windows

### 前端显示「连接失败」/ Frontend shows "Connection Failed"

- 确认 `gpu_ws_monitor.py` 已启动 / Ensure `gpu_ws_monitor.py` is running
- 检查 `http://localhost:5001` 可访问 / Check `http://localhost:5001` is reachable
- 检查防火墙是否拦截端口 / Check firewall for port blocking

### vLLM metrics 全为 0 / vLLM Metrics Are All Zero

- 确保 vLLM 服务已启动且处理过至少一个请求 / Ensure vLLM is running and has processed at least one request
- 访问 `http://localhost:8000/metrics` 检查原始数据 / Visit `http://localhost:8000/metrics` to check raw data
- 使用监控面板的「显示调试」按钮查看原始返回 / Use the "Show Debug" button to inspect raw response

### PCIe 数据为 0 / PCIe Data Shows Zero

- 部分驱动或 GPU 不支持 `nvmlDeviceGetPcieThroughput`，可忽略 / Some drivers/GPUs don't support this API; safe to ignore

---

## 监控指标说明 | Metrics Reference

### GPU 硬件指标 / GPU Hardware Metrics

| 指标 / Metric | 说明 / Description | 调优建议 / Tuning Hints |
|---|---|---|
| VRAM Used / Total | 显存占用 / VRAM usage | vLLM 会预分配 KV Cache 池 / vLLM pre-allocates KV Cache pool |
| SM 利用率 / SM Utilization | 流处理器核心占用 / Streaming multiprocessor usage | 低 SM + 高 MemUtil → Memory-bound |
| 显存控制器利用率 / Memory Controller Util | 显存带宽占用 / Memory bandwidth usage | 高值说明带宽瓶颈 / High value indicates bandwidth bottleneck |
| 功耗 / Power Draw | GPU 功耗 (W) | 未跑满说明算子未充分利用 / Not maxed means underutilized compute |
| PCIe 吞吐量 / PCIe Throughput | Host↔GPU 传输 (KB/s) | 超长上下文时关键 / Critical for very long contexts |
| 温度 / Temperature | GPU 核心温度 (°C) | >85°C 注意散热 / >85°C check cooling |

### vLLM 推理指标 / vLLM Inference Metrics

| 指标 / Metric | 说明 / Description |
|---|---|
| KV Cache Usage | KV 缓存利用率，>90% 需优化 / KV cache util, optimize if >90% |
| Throughput | 每秒生成 tokens 数 / Generated tokens per second |
| Latency (P50/P95/P99) | 请求延迟分布 / Request latency distribution |
| TTFT | 首 Token 延迟 / Time To First Token |
| Queue Length | 排队请求数，持续 >10 需扩容 / Pending requests, scale if consistently >10 |

---

## 常见问题 | FAQ

**Q: 如何提高吞吐量？/ How to improve throughput?**

1. 增大 `max_model_len`（显存允许时）/ Increase `max_model_len` (if VRAM allows)
2. 调整 `gpu_memory_utilization` / Tune `gpu_memory_utilization`
3. 使用量化模型（AWQ / GPTQ）/ Use quantized models (AWQ / GPTQ)
4. 升级 GPU / Upgrade GPU

**Q: KV Cache 过高怎么办？/ What if KV Cache usage is too high?**

1. 降低 `max_model_len` / Lower `max_model_len`
2. 减小 `gpu_memory_utilization` / Reduce `gpu_memory_utilization`
3. 使用量化模型减少显存占用 / Use quantized models to reduce VRAM footprint

---

## 许可证 | License

[MIT License](./LICENSE) - Copyright (c) 2026 Blueboylee

---

## 学习资源 | Resources

- [vLLM 官方文档 / vLLM Docs](https://docs.vllm.ai/)
- [PagedAttention 论文 / Paper](https://arxiv.org/abs/2309.06180)
- [Continuous Batching 说明 / Guide](./docs/CONTINUOUS_BATCHING.md)
- [vLLM Metrics 设置 / Setup](./docs/VLLM_METRICS_SETUP.md)
