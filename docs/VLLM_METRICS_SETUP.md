# vLLM Metrics 启用指南

## 问题诊断

如果你在监控面板看到所有数据都是 0，并且调试面板中看不到 `vllm:` 前缀的指标，说明 vLLM 的 metrics 可能未正确启用。

## 当前状态

从你提供的 metrics 数据来看，只有 HTTP 服务器的通用指标：
- `http_request_duration_*` - HTTP 请求延迟
- 没有 `vllm:kv_cache_usage_perc` - KV cache 使用率
- 没有 `vllm:num_requests_running` - 运行中的请求数
- 没有 `vllm:generation_tokens` - 生成的 tokens

## 解决方案

### 1. 检查 vLLM 版本

vLLM 的 metrics 功能在 v0.6.0+ 版本中默认启用。检查版本：

```bash
python -c "import vllm; print(vllm.__version__)"
```

如果版本 < 0.6.0，请升级：

```bash
pip install --upgrade vllm
```

### 2. 确保正确启动 vLLM API 服务器

使用 `vllm.entrypoints.openai.api_server` 启动（不是直接使用 `LLM` 类）：

```bash
python -m vllm.entrypoints.openai.api_server \
  --model qwen/Qwen2.5-3B-Instruct \
  --port 8000 \
  --host 0.0.0.0
```

### 3. 发送请求后再检查 metrics

vLLM 的某些 metrics 只在处理请求后才会有数据。先发送一个请求：

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/v1/chat/completions" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"model": "qwen-3b", "messages": [{"role": "user", "content": "test"}]}'
```

然后再检查 `/metrics` 端点。

### 4. 检查 metrics 端点

直接访问 metrics 端点查看是否有 vLLM 指标：

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/metrics"
```

查找包含 `vllm:` 前缀的行，例如：
- `vllm:kv_cache_usage_perc`
- `vllm:num_requests_running`
- `vllm:generation_tokens`
- `vllm:prompt_tokens`

### 5. 如果仍然没有 vLLM metrics

可能的原因：

1. **vLLM 版本太旧**：升级到最新版本
2. **使用了错误的启动方式**：确保使用 `api_server` 而不是直接 `LLM`
3. **metrics 被禁用**：检查是否有 `--disable-metrics` 参数（不应该有）

## 临时解决方案

即使没有 vLLM 的 metrics，监控面板现在也能显示：

1. **HTTP 请求延迟**：从 `http_request_duration_*` 提取
   - 平均延迟
   - P50/P95/P99 延迟（从 histogram buckets 计算）

2. **GPU 信息**：通过 GPU 监控服务获取
   - GPU 使用率
   - 显存使用率
   - GPU 温度
   - 功耗

这些信息已经足够监控服务的基本状态了。

## 完整的启动命令示例

```bash
# WSL 中
python -m vllm.entrypoints.openai.api_server \
  --model qwen/Qwen2.5-3B-Instruct \
  --port 8000 \
  --host 0.0.0.0 \
  --max-model-len 2048 \
  --gpu-memory-utilization 0.8
```

然后检查 metrics：

```bash
curl http://localhost:8000/metrics | grep vllm:
```

应该能看到类似这样的输出：

```
vllm:kv_cache_usage_perc 0.45
vllm:num_requests_running 2.0
vllm:generation_tokens 1500.0
vllm:prompt_tokens 500.0
```

## 参考

- [vLLM Metrics 文档](https://docs.vllm.ai/en/stable/usage/metrics/)
- [vLLM Prometheus 集成](https://docs.vllm.ai/en/stable/getting_started/examples/prometheus_grafana.html)
