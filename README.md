# Qwen AI 推理服务 - 完整项目

这是一个完整的 AI 推理服务入门项目，包含：
- **vLLM 推理服务**（WSL 中运行）
- **ChatGPT 风格的 Web 对话界面**（React + 流式输出）
- **实时监控仪表板**（GPU、吞吐量、延迟等指标）

## 项目结构

```
project/
├── main.py                    # vLLM 模型加载示例（参考）
├── web/                       # React Web 应用
│   ├── src/
│   │   ├── App.tsx           # 主应用（聊天 + 监控切换）
│   │   ├── Monitor.tsx       # 监控仪表板
│   │   ├── api.ts            # API 客户端（流式调用）
│   │   └── ...
│   └── package.json
└── docs/
    └── CONTINUOUS_BATCHING.md # Continuous Batching 说明文档
```

## 功能特性

### 1. 对话界面 💬
- ChatGPT 风格的 UI
- **流式输出**：逐字显示，实时响应
- 多轮对话支持
- 深色主题

### 2. 监控仪表板 📊
- **实时指标**：每 2 秒自动刷新
- **关键指标卡片**：
  - KV Cache 使用率
  - 吞吐量 (tokens/s)
  - 平均延迟
  - 队列长度
- **详细统计**：
  - 资源使用（运行中/等待中的请求）
  - 吞吐量统计（生成 tokens、prompt tokens）
  - 延迟统计（P50/P95/P99、TTFT）
- **实时图表**：每个指标都有小型趋势图

### 3. Continuous Batching ✅
- vLLM **默认启用** Continuous Batching
- 动态批处理，提高 GPU 利用率
- PagedAttention 优化 KV cache

## 快速开始

### 1. 启动 vLLM 服务（WSL）

```bash
# 在 WSL 中启动 OpenAI 兼容 API 服务器
python -m vllm.entrypoints.openai.api_server \
  --model qwen/Qwen2.5-3B-Instruct \
  --port 8000 \
  --host 0.0.0.0
```

### 2. 启动 Web 界面

```powershell
cd web
npm install
npm run dev
```

浏览器打开 **http://localhost:3000**

## 监控指标说明

### KV Cache 使用率
- **绿色** (< 70%)：正常
- **黄色** (70-90%)：较高，注意监控
- **红色** (> 90%)：接近上限，可能需要优化

### 吞吐量 (tokens/s)
- 反映模型的推理速度
- 受批处理大小、序列长度、GPU 性能影响

### 延迟统计
- **P50**：中位数延迟
- **P95**：95% 请求的延迟
- **P99**：99% 请求的延迟（最坏情况）
- **TTFT**：首 Token 延迟（Time To First Token）

### 队列长度
- 等待处理的请求数
- 如果持续 > 10，考虑增加 GPU 或优化模型

## API 端点

- `/v1/chat/completions` - OpenAI 兼容的聊天完成 API
- `/metrics` - Prometheus 格式的监控指标

## 技术栈

- **后端**：vLLM（Python）
- **前端**：React + TypeScript + Vite
- **监控**：Prometheus 格式指标 + 自定义解析

## 学习资源

- [vLLM 官方文档](https://docs.vllm.ai/)
- [Continuous Batching 说明](./docs/CONTINUOUS_BATCHING.md)
- [PagedAttention 论文](https://arxiv.org/abs/2309.06180)

## 常见问题

### Q: 为什么监控面板显示 "错误"？
A: 确保 vLLM 服务已启动并暴露在 `localhost:8000`，且 `/metrics` 端点可访问。

### Q: 如何提高吞吐量？
A: 
1. 增加 `max_model_len`（如果显存允许）
2. 调整 `gpu_memory_utilization`
3. 使用更强大的 GPU
4. 优化批处理大小

### Q: KV Cache 使用率过高怎么办？
A:
1. 降低 `max_model_len`
2. 减少 `gpu_memory_utilization`
3. 使用量化模型（如 AWQ、GPTQ）

## 下一步

- [ ] 添加多模型支持
- [ ] 实现请求限流
- [ ] 添加日志记录
- [ ] 集成 Grafana 可视化
- [ ] 添加健康检查端点
