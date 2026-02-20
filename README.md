# Qwen vLLM Inference Service & Real-time GPU Monitor

---

## Introduction

This repository provides a complete local LLM inference + real-time monitoring setup.

It combines:

- A vLLM-based Qwen inference server (OpenAI-compatible API)
- A React web UI with a ChatGPT-style chat experience
- Real-time GPU hardware monitoring (VRAM, SM utilization, power, temperature, PCIe throughput)
- vLLM metrics visualization (KV Cache usage, throughput, latency, queue length, etc.)

The typical deployment is:

- **vLLM + unified backend** in WSL / Linux
- **GPU monitor + frontend** on Windows

---

## Project Structure

```text
vllm_qwen_from_beginning/
├── main.py                  # Standalone vLLM offline inference example
├── gpu_monitor.py           # GPU monitor via REST API (polling)
├── gpu_ws_monitor.py        # GPU monitor via WebSocket (Socket.IO)
├── requirements_monitor.txt # Python dependencies for monitoring services
├── docs/
│   ├── VLLM_METRICS_SETUP.md
│   └── CONTINUOUS_BATCHING.md
└── web/                     # React frontend
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx          # Main app: Chat + vLLM monitor + GPU tabs
        ├── api.ts           # OpenAI-compatible streaming API client
        ├── Monitor.tsx      # vLLM Prometheus metrics dashboard
        ├── GpuDashboard.tsx # Real-time GPU dashboard (Socket.IO + Recharts)
        └── ...
```

---

## Tech Stack

| Layer             | Technology                                                                 |
|-------------------|----------------------------------------------------------------------------|
| LLM Inference     | [vLLM](https://docs.vllm.ai/) + Qwen 2.5 (WSL / Linux)                     |
| GPU Data          | [pynvml](https://pypi.org/project/pynvml/) (NVIDIA NVML)                   |
| Backend Push      | Flask + Flask-SocketIO (WebSocket, 500ms interval)                         |
| REST Monitoring   | Flask + `nvidia-smi` subprocess (polling, 2s interval)                     |
| Frontend          | React 18 + TypeScript + Vite                                               |
| Charts            | [Recharts](https://recharts.org/)                                          |
| Realtime          | [Socket.IO](https://socket.io/) client                                     |

---

## Quick Start

### Prerequisites

- Windows 10/11 + WSL2 (for vLLM)
- NVIDIA GPU + driver (Windows side must be able to run `nvidia-smi`)
- Python 3.10+
- Node.js 18+

### 1. Start vLLM Service (WSL)

In WSL (or Linux), start vLLM with your quantized Qwen model, for example:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model ./models/Qwen/Qwen2.5-7B-Instruct-GPTQ-Int8 \
  --quantization gptq \
  --gpu-memory-utilization 0.90 \
  --max-model-len 4096 \
  --served-model-name qwen \
  --port 8000 \
  --host 0.0.0.0 \
  --enforce-eager
```

The frontend will call the OpenAI-compatible endpoint:

- `POST /v1/chat/completions` with `model: "qwen"`

### 2. Install Backend Dependencies (Windows)

In Windows PowerShell:

```powershell
pip install -r requirements_monitor.txt
```

`requirements_monitor.txt` contains (pinned) monitoring dependencies:

```text
flask==3.0.0
flask-cors==4.0.0
flask-socketio==5.3.6
python-socketio==5.10.0
python-engineio==4.8.0
pynvml==11.5.0
```

### 3. Start GPU Monitor

Two GPU monitoring modes are available.

**Mode A: WebSocket Real-time Push (Recommended)**

```powershell
python gpu_ws_monitor.py
# Service: http://localhost:5001
# Push interval: 500ms
```

**Mode B: REST API Polling**

```powershell
python gpu_monitor.py
# Service: http://localhost:5000/api/gpu
```

### 4. Start Frontend

```powershell
cd web
npm install
npm run dev
# Open browser: http://localhost:3000
```

---

## Windows + WSL2 Infra Guide (Qwen2.5-7B GPTQ-Int8)

This section documents how to set up a **Windows + WSL2** environment optimized for **Qwen2.5-7B-Instruct GPTQ-Int8** on a **12GB GPU (e.g. RTX 4070)** using vLLM.

### Infra Stack

- **Model**: Qwen2.5-7B-Instruct-GPTQ-Int8  
- **Engine**: vLLM ≥ 0.15.1 (supports `gptq_marlin` and `fp8_kv_cache`)  
- **Backend**: CUDA 12.x / Triton  
- **Platform**: WSL2 (Ubuntu 22.04)  
- **Hardware**: NVIDIA RTX 4070 (12GB VRAM) or similar  

### Step 0: Install WSL2 and Ubuntu 22.04 (Windows)

In Windows PowerShell (as Administrator):

```powershell
# Install WSL with Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# Reboot if prompted, then verify
wsl -l -v
```

After installation, open **Ubuntu 22.04** from the Start menu, create your Linux user, and update the system:

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 1: Prepare Python Environment in WSL2

Inside WSL (Ubuntu 22.04), it is recommended to use **conda** to isolate your AI infra environment:

```bash
# Create and activate environment
conda create -n ai-infra python=3.10 -y
conda activate ai-infra

# Install core dependencies (using Aliyun mirror for speed)
pip install modelscope vllm==0.15.1 -i https://mirrors.aliyun.com/pypi/simple/
```

If `conda` is not installed yet, you can install Miniconda or Anaconda first, then re-run the commands above.

### Step 2: Fast Model Download (ModelScope)

Use the ModelScope SDK to download the pre-quantized model into a local `./models` directory:

```bash
python -c "from modelscope import snapshot_download; \
model_dir = snapshot_download('Qwen/Qwen2.5-7B-Instruct-GPTQ-Int8', cache_dir='./models'); \
print('\n' + '-'*20 + '\nModel Path:', model_dir)"
```

Take note of the printed **Model Path** (for example `./models/Qwen/Qwen2.5-7B-Instruct-GPTQ-Int8`).

### Step 3: Optimized vLLM Launch (Infra-tuned)

For a 12GB GPU, the following launch command enables **Marlin-accelerated GPTQ** and **FP8 KV cache compression**, along with a longer context length:

```bash
python -m vllm.entrypoints.openai.api_server \
    --model ./models/Qwen/Qwen2.5-7B-Instruct-GPTQ-Int8 \
    --quantization gptq_marlin \
    --kv-cache-dtype fp8 \
    --gpu-memory-utilization 0.90 \
    --max-model-len 8192 \
    --enable-prefix-caching \
    --served-model-name qwen-infra \
    --port 8000 \
    --host 0.0.0.0
```

You can then point the frontend (or any OpenAI-compatible client) to:

- `POST /v1/chat/completions` with `model: "qwen-infra"`

---

## Features

### Chat Interface

- ChatGPT-style UI with dark theme
- Streaming output (token-by-token)
- Multi-turn conversation history
- Uses vLLM's OpenAI-compatible API (`/v1/chat/completions`)

### vLLM Metrics Dashboard

- Periodically fetches `/metrics` (Prometheus format) every 2 seconds
- Key metric cards with mini trend charts

Key metrics:

| Metric              | Description                                 |
|---------------------|---------------------------------------------|
| KV Cache Usage      | KV cache utilization percentage             |
| Throughput          | Tokens per second (delta-based)            |
| Latency             | P50 / P95 / P99 / TTFT                      |
| Queue Length        | Number of pending requests                  |

### Real-time GPU Dashboard

- Socket.IO-based WebSocket push, refreshing every 500ms
- Six real-time line charts:

| Chart               | Metrics                                      |
|---------------------|----------------------------------------------|
| VRAM Alloc vs Total | Used vs total VRAM (MB)                      |
| SM / Mem Util       | SM + memory controller utilization (%)       |
| GPU Power           | Real-time power draw (W)                     |
| PCIe Throughput     | Host↔GPU transfer rate (KB/s)                |
| GPU Temperature     | Core temperature (°C)                        |

---

## Architecture

### Unified Server Mode (Recommended)

```text
┌──────────────────────────────────────────────────────┐
│                    server.py (port 8000)            │
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
              │  Vite Dev :3000 │
              │  (proxy → 8000) │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │    Browser UI    │
              │ Chat | Monitor | GPU │
              └─────────────────┘
```

### Separate Mode

```text
WSL2: vLLM :8000 ──┐
                    ├──► Vite :3000 ──► Browser
Windows: GPU :5001 ─┘
```

---

## Environment Variables

| Variable        | Default        | Description                        |
|----------------|----------------|------------------------------------|
| `VITE_GPU_WS_URL` | *(empty, same-origin)* | GPU WebSocket service URL        |

In unified mode, the frontend connects via Vite proxy to `:8000`, so no extra configuration is required.

To connect to a remote GPU server, set in `web/.env`:

```env
VITE_GPU_WS_URL=http://your-server-ip:8000
```

---

## Proxy Configuration

Vite dev server proxy rules (`web/vite.config.ts`):

| Path       | Target                 | Purpose                         |
|------------|------------------------|---------------------------------|
| `/v1/*`    | `http://localhost:8000` | OpenAI-compatible chat API      |
| `/metrics` | `http://localhost:8000` | Prometheus metrics              |
| `/api/*`   | `http://localhost:8000` | GPU REST API                    |
| `/socket.io` | `http://localhost:8000` | GPU WebSocket (Socket.IO)    |

---

## Troubleshooting

### pynvml / `nvidia-smi` Not Available

- Ensure NVIDIA drivers are installed on Windows
- Verify `nvidia-smi` works in PowerShell
- If the model runs in WSL and monitoring runs on Windows, ensure the GPU is visible on Windows as well

### Frontend Shows "Connection Failed"

- Make sure `gpu_ws_monitor.py` is running
- Check that `http://localhost:5001` is reachable
- Check firewall settings for blocked ports

### vLLM Metrics All Zero

- Ensure the vLLM service is running and has processed at least one request
- Visit `http://localhost:8000/metrics` to inspect raw Prometheus output
- Use the "Show Debug" button in the monitor panel to see raw data

### PCIe Data Always Zero

- Some drivers / GPUs do not support `nvmlDeviceGetPcieThroughput`; this can be safely ignored

---

## Metrics Reference

### GPU Hardware Metrics

| Metric               | Description                                    | Tuning Hints                               |
|----------------------|------------------------------------------------|--------------------------------------------|
| VRAM Used / Total    | VRAM usage                                     | vLLM pre-allocates a KV cache pool         |
| SM Utilization       | Streaming multiprocessor utilization           | Low SM + high MemUtil → memory-bound       |
| Memory Controller    | Memory bandwidth utilization                   | High value indicates bandwidth bottleneck  |
| Power Draw           | GPU power in Watts                             | Not maxed may indicate underutilized compute |
| PCIe Throughput      | Host↔GPU transfer rate (KB/s)                  | Important for very long contexts           |
| Temperature          | GPU core temperature (°C)                      | >85°C: check cooling                       |

### vLLM Inference Metrics

| Metric          | Description                                        |
|-----------------|----------------------------------------------------|
| KV Cache Usage  | KV cache utilization; optimize if consistently >90% |
| Throughput      | Generated tokens per second                        |
| Latency         | Request latency distribution (P50 / P95 / P99)     |
| TTFT            | Time To First Token                                |
| Queue Length    | Pending requests; scale out if consistently >10    |

---

## FAQ

**Q: How can I improve throughput?**

1. Increase `max_model_len` (if VRAM allows)
2. Tune `gpu_memory_utilization`
3. Use quantized models (AWQ / GPTQ)
4. Upgrade GPU hardware

**Q: What if KV cache usage is too high?**

1. Lower `max_model_len`
2. Reduce `gpu_memory_utilization`
3. Use quantized models to reduce VRAM footprint

---

## License

[MIT License](./LICENSE) © 2026 Blueboylee

---

## Resources

- [vLLM Documentation](https://docs.vllm.ai/)
- [PagedAttention Paper](https://arxiv.org/abs/2309.06180)
- [Continuous Batching Guide](./docs/CONTINUOUS_BATCHING.md)
- [vLLM Metrics Setup](./docs/VLLM_METRICS_SETUP.md)
