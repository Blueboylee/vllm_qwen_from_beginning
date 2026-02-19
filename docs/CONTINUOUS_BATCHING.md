# Continuous Batching 说明

## 什么是 Continuous Batching？

**Continuous Batching（连续批处理）** 是 vLLM 的核心优化技术，它允许推理服务动态地将多个请求组合在一起进行批处理，从而提高 GPU 利用率和吞吐量。

## vLLM 中的实现

### ✅ 是的，你的服务已经启用了 Continuous Batching！

vLLM **默认启用** Continuous Batching，这是它的核心特性。当你使用 vLLM 的 OpenAI 兼容 API 服务器时，它会自动：

1. **动态批处理**：将多个请求动态组合成批次
2. **PagedAttention**：高效管理 KV cache，避免显存浪费
3. **请求调度**：智能调度请求，最大化 GPU 利用率

### 工作原理

```
传统静态批处理：
┌─────────┐
│ Request1│ ──┐
│ Request2│ ──┤──> [等待所有请求到达] ──> [批处理] ──> [返回所有结果]
│ Request3│ ──┘
└─────────┘

Continuous Batching (vLLM):
┌─────────┐
│ Request1│ ──┐
│ Request2│ ──┤──> [立即开始处理] ──> [动态添加新请求] ──> [完成即返回]
│ Request3│ ──┘
└─────────┘
```

### 关键优势

1. **更高的吞吐量**：GPU 利用率提升 2-10 倍
2. **更低的延迟**：请求不需要等待整个批次完成
3. **更好的资源利用**：KV cache 按需分配，避免浪费

## 监控指标

在监控面板中，你可以看到：

- **KV Cache 使用率**：反映 Continuous Batching 的缓存效率
- **吞吐量 (tokens/s)**：批处理带来的性能提升
- **队列长度**：等待批处理的请求数
- **延迟统计**：P50/P95/P99 延迟，反映批处理对延迟的影响

## 进一步优化

1. **调整 `max_model_len`**：根据显存调整最大序列长度
2. **调整 `gpu_memory_utilization`**：控制 KV cache 使用率
3. **监控队列长度**：如果队列过长，考虑增加 GPU 或优化模型

## 参考

- [vLLM 官方文档](https://docs.vllm.ai/)
- [PagedAttention 论文](https://arxiv.org/abs/2309.06180)
