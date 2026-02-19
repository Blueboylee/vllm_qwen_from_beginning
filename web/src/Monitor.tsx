import { useState, useEffect, useRef } from 'react'
import './Monitor.css'

interface Metrics {
  timestamp: number
  // GPU & 资源
  kvCacheUsage: number // KV cache 使用率 (0-1)
  numRequestsRunning: number // 正在运行的请求数
  numRequestsWaiting: number // 等待的请求数
  
  // 吞吐量
  generationTokens: number // 生成的 token 总数
  promptTokens: number // prompt token 总数
  tokensPerSecond: number // 计算得出的 tokens/s
  
  // 延迟
  avgLatency: number // 平均延迟 (秒)
  p50Latency: number
  p95Latency: number
  p99Latency: number
  timeToFirstToken: number // TTFT (秒)
  
  // 其他
  prefixCacheHits?: number
  prefixCacheQueries?: number
}

interface HistoryPoint {
  time: number
  value: number
}

interface GpuInfo {
  gpuUtilization: number // GPU 使用率 (%)
  memoryUsed: number // 已用显存 (MB)
  memoryTotal: number // 总显存 (MB)
  memoryUtilization: number // 显存使用率 (%)
  temperature: number // GPU 温度 (°C)
  powerUsage: number // 功耗 (W)
}

export default function Monitor() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawMetrics, setRawMetrics] = useState<string>('') // 调试用：原始数据
  const [showDebug, setShowDebug] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<number>()
  
  // 历史数据用于图表
  const [kvCacheHistory, setKvCacheHistory] = useState<HistoryPoint[]>([])
  const [throughputHistory, setThroughputHistory] = useState<HistoryPoint[]>([])
  const [latencyHistory, setLatencyHistory] = useState<HistoryPoint[]>([])
  const [queueHistory, setQueueHistory] = useState<HistoryPoint[]>([])
  const [gpuUtilHistory, setGpuUtilHistory] = useState<HistoryPoint[]>([])
  const [gpuMemHistory, setGpuMemHistory] = useState<HistoryPoint[]>([])
  
  // 用于计算吞吐量的历史值
  const prevTokensRef = useRef<{ generation: number; prompt: number; time: number } | null>(null)

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setRawMetrics(text) // 保存原始数据用于调试
      
      const now = Date.now()
      const parsed = parsePrometheusMetrics(text, prevTokensRef.current, now)
      
      // 更新历史 tokens 用于下次计算吞吐量
      prevTokensRef.current = {
        generation: parsed.generationTokens,
        prompt: parsed.promptTokens,
        time: now,
      }
      
      setMetrics(parsed)
      setError(null)
      
      // 更新历史数据（保留最近 60 个点）
      setKvCacheHistory(prev => [...prev.slice(-59), { time: now, value: parsed.kvCacheUsage }])
      setThroughputHistory(prev => [...prev.slice(-59), { time: now, value: parsed.tokensPerSecond }])
      setLatencyHistory(prev => [...prev.slice(-59), { time: now, value: parsed.avgLatency }])
      setQueueHistory(prev => [...prev.slice(-59), { time: now, value: parsed.numRequestsWaiting }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRawMetrics(`错误: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const fetchGpuInfo = async () => {
    try {
      const res = await fetch('/api/gpu')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGpuInfo(data)
      
      const now = Date.now()
      setGpuUtilHistory(prev => [...prev.slice(-59), { time: now, value: data.gpuUtilization }])
      setGpuMemHistory(prev => [...prev.slice(-59), { time: now, value: data.memoryUtilization }])
    } catch (e) {
      // GPU 信息获取失败不影响主流程
      console.warn('GPU 信息获取失败:', e)
    }
  }

  useEffect(() => {
    fetchMetrics()
    intervalRef.current = window.setInterval(() => {
      if (!isPaused) {
        fetchMetrics()
      }
    }, 2000) // 每 2 秒更新一次
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPaused])

  return (
    <div className="monitor">
      <header className="monitor-header">
        <h1>vLLM 推理服务监控</h1>
        <div className="monitor-controls">
          <button onClick={() => setShowDebug(!showDebug)} className="debug-btn">
            {showDebug ? '🔍 隐藏调试' : '🔍 显示调试'}
          </button>
          <button onClick={() => setIsPaused(!isPaused)} className="pause-btn">
            {isPaused ? '▶ 继续' : '⏸ 暂停'}
          </button>
          <button onClick={() => { fetchMetrics(); }} className="refresh-btn">🔄 刷新</button>
        </div>
      </header>

      {error && (
        <div className="monitor-error">
          错误: {error}
        </div>
      )}

      {showDebug && (
        <div className="debug-panel">
          <h3>原始 Metrics 数据（调试）</h3>
          <pre className="debug-content">{rawMetrics || '暂无数据'}</pre>
          <div className="debug-warning">
            <strong>⚠️ 提示：</strong>
            <p>如果看不到 <code>vllm:</code> 前缀的指标（如 <code>vllm:kv_cache_usage_perc</code>），说明 vLLM 的 metrics 可能未启用。</p>
            <p>当前显示的是 HTTP 服务器的通用指标。要启用 vLLM metrics，请确保：</p>
            <ul>
              <li>vLLM 服务正常启动</li>
              <li>已经处理过至少一个请求</li>
              <li>检查 vLLM 版本是否支持 metrics（v0.6.0+）</li>
            </ul>
          </div>
        </div>
      )}

      {metrics && (
        <div className="monitor-content">
          {/* 关键指标卡片 */}
          <div className="metrics-grid">
            {gpuInfo && (
              <>
                <MetricCard
                  title="GPU 使用率"
                  value={`${gpuInfo.gpuUtilization.toFixed(1)}%`}
                  color={gpuInfo.gpuUtilization > 80 ? '#10b981' : gpuInfo.gpuUtilization > 50 ? '#f59e0b' : '#6b7280'}
                  history={gpuUtilHistory}
                />
                <MetricCard
                  title="显存使用率"
                  value={`${gpuInfo.memoryUtilization.toFixed(1)}%`}
                  color={gpuInfo.memoryUtilization > 90 ? '#ef4444' : gpuInfo.memoryUtilization > 70 ? '#f59e0b' : '#10b981'}
                  history={gpuMemHistory}
                />
              </>
            )}
            <MetricCard
              title="KV Cache 使用率"
              value={`${(metrics.kvCacheUsage * 100).toFixed(1)}%`}
              color={metrics.kvCacheUsage > 0.9 ? '#ef4444' : metrics.kvCacheUsage > 0.7 ? '#f59e0b' : '#10b981'}
              history={kvCacheHistory}
            />
            <MetricCard
              title="吞吐量"
              value={`${metrics.tokensPerSecond.toFixed(1)} tokens/s`}
              color="#3b82f6"
              history={throughputHistory}
            />
            <MetricCard
              title="平均延迟"
              value={`${(metrics.avgLatency * 1000).toFixed(1)} ms`}
              color="#8b5cf6"
              history={latencyHistory}
            />
            <MetricCard
              title="队列长度"
              value={metrics.numRequestsWaiting.toString()}
              color={metrics.numRequestsWaiting > 10 ? '#ef4444' : '#10b981'}
              history={queueHistory}
            />
          </div>

          {/* 详细指标 */}
          <div className="metrics-detail">
            {gpuInfo && (
              <section className="detail-section">
                <h2>GPU 信息</h2>
                <div className="detail-grid">
                  <DetailItem label="GPU 使用率" value={`${gpuInfo.gpuUtilization.toFixed(1)}%`} />
                  <DetailItem label="显存使用" value={`${gpuInfo.memoryUsed.toFixed(0)} MB / ${gpuInfo.memoryTotal.toFixed(0)} MB`} />
                  <DetailItem label="显存使用率" value={`${gpuInfo.memoryUtilization.toFixed(1)}%`} />
                  <DetailItem label="GPU 温度" value={`${gpuInfo.temperature.toFixed(0)}°C`} />
                  <DetailItem label="功耗" value={`${gpuInfo.powerUsage.toFixed(0)} W`} />
                </div>
              </section>
            )}
            <section className="detail-section">
              <h2>资源使用</h2>
              <div className="detail-grid">
                <DetailItem label="正在处理请求" value={metrics.numRequestsRunning} />
                <DetailItem label="等待队列" value={metrics.numRequestsWaiting} />
                <DetailItem label="KV Cache 使用率" value={`${(metrics.kvCacheUsage * 100).toFixed(2)}%`} />
              </div>
            </section>

            <section className="detail-section">
              <h2>吞吐量统计</h2>
              <div className="detail-grid">
                <DetailItem label="生成 Tokens" value={metrics.generationTokens.toLocaleString()} />
                <DetailItem label="Prompt Tokens" value={metrics.promptTokens.toLocaleString()} />
                <DetailItem label="当前吞吐量" value={`${metrics.tokensPerSecond.toFixed(2)} tokens/s`} />
              </div>
            </section>

            <section className="detail-section">
              <h2>延迟统计</h2>
              <div className="detail-grid">
                <DetailItem label="平均延迟" value={`${(metrics.avgLatency * 1000).toFixed(1)} ms`} />
                <DetailItem label="P50 延迟" value={`${(metrics.p50Latency * 1000).toFixed(1)} ms`} />
                <DetailItem label="P95 延迟" value={`${(metrics.p95Latency * 1000).toFixed(1)} ms`} />
                <DetailItem label="P99 延迟" value={`${(metrics.p99Latency * 1000).toFixed(1)} ms`} />
                <DetailItem label="首 Token 延迟 (TTFT)" value={`${(metrics.timeToFirstToken * 1000).toFixed(1)} ms`} />
              </div>
            </section>
          </div>
        </div>
      )}

      {!metrics && !error && (
        <div className="monitor-loading">加载中...</div>
      )}
    </div>
  )
}

function MetricCard({ title, value, color, history }: { title: string; value: string; color: string; history: HistoryPoint[] }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <h3>{title}</h3>
        <div className="metric-value" style={{ color }}>{value}</div>
      </div>
      <MiniChart data={history} color={color} />
    </div>
  )
}

function MiniChart({ data, color }: { data: HistoryPoint[]; color: string }) {
  if (data.length < 2) return <div className="mini-chart-empty">暂无数据</div>
  
  const max = Math.max(...data.map(d => d.value), 1)
  const min = Math.min(...data.map(d => d.value), 0)
  const range = max - min || 1
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((d.value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <svg className="mini-chart" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

// 解析 Prometheus 格式的 metrics
function parsePrometheusMetrics(
  text: string,
  prevTokens: { generation: number; prompt: number; time: number } | null,
  currentTime: number
): Metrics {
  const lines = text.split('\n').filter(l => l && !l.startsWith('#'))
  const metrics: Record<string, number> = {}
  const histogramBuckets: Record<string, Array<{ le: number; count: number }>> = {}
  
  // 解析各种 Prometheus 格式
  for (const line of lines) {
    // vLLM 指标: vllm:metric_name value
    let match = line.match(/^vllm:([a-z_]+)\s+([0-9.e+-]+)/i)
    if (match) {
      const [, name, value] = match
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        metrics[name] = numValue
      }
      continue
    }
    
    // Histogram bucket 格式: metric_name_bucket{le="value"} count
    match = line.match(/^([a-z_]+)_bucket\{le="([0-9.e+-]+)"\}\s+([0-9.e+-]+)/i)
    if (match) {
      const [, baseName, le, count] = match
      const leValue = parseFloat(le)
      const countValue = parseFloat(count)
      if (!isNaN(leValue) && !isNaN(countValue)) {
        if (!histogramBuckets[baseName]) {
          histogramBuckets[baseName] = []
        }
        histogramBuckets[baseName].push({ le: leValue, count: countValue })
      }
      continue
    }
    
    // Histogram sum/count 格式: metric_name_sum value 或 metric_name_count value
    match = line.match(/^([a-z_]+)_(sum|count)\s+([0-9.e+-]+)/i)
    if (match) {
      const [, baseName, type, value] = match
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        metrics[`${baseName}_${type}`] = numValue
      }
      continue
    }
    
    // 标准格式: metric_name value
    match = line.match(/^([a-z_]+)\s+([0-9.e+-]+)/i)
    if (match) {
      const [, name, value] = match
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        // 避免覆盖已有的带标签的值
        if (!metrics[name] || name.includes('_bucket') || name.includes('_sum') || name.includes('_count')) {
          metrics[name] = numValue
        }
      }
      continue
    }
    
    // Histogram/Summary 格式: metric_name{quantile="0.5"} value
    match = line.match(/^([a-z_]+)\{quantile="([0-9.]+)"\}\s+([0-9.e+-]+)/i)
    if (match) {
      const [, baseName, quantile, value] = match
      const q = parseFloat(quantile)
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        if (q === 0.5) metrics[`${baseName}_p50`] = numValue
        else if (q === 0.95) metrics[`${baseName}_p95`] = numValue
        else if (q === 0.99) metrics[`${baseName}_p99`] = numValue
      }
      continue
    }
  }
  
  // 从 histogram buckets 计算百分位数
  for (const [baseName, buckets] of Object.entries(histogramBuckets)) {
    if (buckets.length === 0) continue
    
    const sorted = buckets.sort((a, b) => a.le - b.le)
    const total = sorted[sorted.length - 1]?.count || 0
    
    if (total > 0) {
      // 计算 P50, P95, P99
      const p50Count = total * 0.5
      const p95Count = total * 0.95
      const p99Count = total * 0.99
      
      metrics[`${baseName}_p50`] = findPercentile(sorted, p50Count)
      metrics[`${baseName}_p95`] = findPercentile(sorted, p95Count)
      metrics[`${baseName}_p99`] = findPercentile(sorted, p99Count)
    }
  }
  
  // 计算平均延迟（从 http_request_duration_highr_seconds 或 http_request_duration_seconds）
  let avgLatency = 0
  const durationSum = metrics.http_request_duration_highr_seconds_sum ?? metrics.http_request_duration_seconds_sum ?? 0
  const durationCount = metrics.http_request_duration_highr_seconds_count ?? metrics.http_request_duration_seconds_count ?? 0
  if (durationCount > 0) {
    avgLatency = durationSum / durationCount
  }
  
  // 获取百分位延迟
  const p50Latency = metrics.http_request_duration_highr_seconds_p50 ?? metrics.http_request_duration_seconds_p50 ?? avgLatency
  const p95Latency = metrics.http_request_duration_highr_seconds_p95 ?? metrics.http_request_duration_seconds_p95 ?? avgLatency
  const p99Latency = metrics.http_request_duration_highr_seconds_p99 ?? metrics.http_request_duration_seconds_p99 ?? avgLatency
  
  // 计算 tokens/s（基于时间差）
  let tokensPerSecond = 0
  if (prevTokens) {
    const timeDelta = (currentTime - prevTokens.time) / 1000 // 秒
    if (timeDelta > 0) {
      const totalTokens = (metrics.generation_tokens ?? 0) + (metrics.prompt_tokens ?? 0)
      const prevTotalTokens = prevTokens.generation + prevTokens.prompt
      tokensPerSecond = (totalTokens - prevTotalTokens) / timeDelta
    }
  }
  
  return {
    timestamp: currentTime,
    kvCacheUsage: metrics.kv_cache_usage_perc ?? metrics.gpu_cache_usage_perc ?? 0,
    numRequestsRunning: Math.round(metrics.num_requests_running ?? 0),
    numRequestsWaiting: Math.round(metrics.num_requests_waiting ?? 0),
    generationTokens: metrics.generation_tokens ?? 0,
    promptTokens: metrics.prompt_tokens ?? 0,
    tokensPerSecond: Math.max(0, tokensPerSecond),
    avgLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    timeToFirstToken: metrics.time_to_first_token_seconds ?? 0,
    prefixCacheHits: metrics.prefix_cache_hits,
    prefixCacheQueries: metrics.prefix_cache_queries,
  }
}

// 从 histogram buckets 计算百分位数
function findPercentile(buckets: Array<{ le: number; count: number }>, targetCount: number): number {
  for (const bucket of buckets) {
    if (bucket.count >= targetCount) {
      return bucket.le
    }
  }
  return buckets[buckets.length - 1]?.le || 0
}
