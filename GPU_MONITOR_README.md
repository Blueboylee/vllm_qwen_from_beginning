# GPU 监控服务使用说明

## 问题诊断

如果监控面板显示所有数据都是 0，可能的原因：

1. **vLLM metrics 端点返回空数据**
   - 点击"显示调试"按钮查看原始返回内容
   - 检查 `/metrics` 端点是否正常返回数据

2. **Prometheus 格式解析失败**
   - 查看调试面板中的原始数据
   - 检查数据格式是否符合 Prometheus 标准

3. **vLLM 服务未启用 metrics**
   - 确保 vLLM 服务启动时启用了 metrics 端点
   - 检查服务日志确认 metrics 是否正常

## GPU 监控设置

### 1. 安装依赖

```powershell
pip install -r requirements_monitor.txt
```

### 2. 启动 GPU 监控服务

```powershell
python gpu_monitor.py
```

服务会在 `http://localhost:5000` 启动。

### 3. 测试 GPU 监控

在浏览器或 PowerShell 中测试：

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/gpu"
```

应该返回类似：
```json
{
  "gpuUtilization": 45.0,
  "memoryUsed": 8192.0,
  "memoryTotal": 24576.0,
  "memoryUtilization": 33.3,
  "temperature": 65.0,
  "powerUsage": 180.5
}
```

### 4. 前端自动获取

前端会自动每 2 秒调用 `/api/gpu` 获取 GPU 信息，并在监控面板显示：
- GPU 使用率卡片
- 显存使用率卡片
- GPU 详细信息（温度、功耗等）

## 故障排除

### nvidia-smi 未找到

如果看到错误 "无法获取 GPU 信息"：
1. 确保已安装 NVIDIA 驱动
2. 确保 `nvidia-smi` 命令可用（在 PATH 中）
3. 在 PowerShell 中测试：`nvidia-smi`

### GPU 信息不更新

1. 检查 GPU 监控服务是否运行：`http://localhost:5000/api/health`
2. 检查浏览器控制台是否有错误
3. 确认 Vite 代理配置正确（`vite.config.ts` 中的 `/api` 代理）

### Metrics 数据为 0

1. **查看调试信息**：点击"显示调试"按钮查看原始返回
2. **检查 vLLM 服务**：确保服务正常运行并处理过请求
3. **验证端点**：直接访问 `http://localhost:8000/metrics` 查看原始数据

## 监控指标说明

### GPU 指标
- **GPU 使用率**：GPU 计算单元使用百分比（0-100%）
- **显存使用率**：已用显存 / 总显存（0-100%）
- **GPU 温度**：GPU 核心温度（°C）
- **功耗**：当前 GPU 功耗（W）

### vLLM 指标
- **KV Cache 使用率**：KV 缓存使用百分比
- **吞吐量**：每秒生成的 tokens 数
- **延迟**：请求处理延迟（P50/P95/P99）
- **队列长度**：等待处理的请求数

## 同时运行多个服务

建议的运行顺序：

1. **WSL 中启动 vLLM**：
   ```bash
   python -m vllm.entrypoints.openai.api_server --model qwen/Qwen2.5-3B-Instruct --port 8000
   ```

2. **PowerShell 中启动 GPU 监控**：
   ```powershell
   python gpu_monitor.py
   ```

3. **启动前端**：
   ```powershell
   cd web
   npm run dev
   ```

现在可以在浏览器中同时看到：
- vLLM 服务指标（来自 `/metrics`）
- GPU 硬件指标（来自 `/api/gpu`）
