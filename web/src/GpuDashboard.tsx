import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import './GpuDashboard.css'

type GpuMetrics = {
  timestamp: number
  vramUsed: number
  vramTotal: number
  vramUtil: number
  smUtil: number
  memUtil: number
  powerDraw: number
  temperature: number
  pcieTxKBs: number
  pcieRxKBs: number
  error?: string
}

type Point = GpuMetrics & { timeLabel: string }

const MAX_POINTS = 120
const SOCKET_URL = import.meta.env.VITE_GPU_WS_URL || 'http://localhost:5001'

export default function GpuDashboard() {
  const [data, setData] = useState<Point[]>([])
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [latest, setLatest] = useState<GpuMetrics | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    // 后端使用 namespace: /gpu；必须连到该命名空间才能收到推送
    const socket = io(`${SOCKET_URL}/gpu`, {
      path: '/socket.io',
      transports: ['polling'],
    })

    socket.on('connect', () => {
      setStatus('connected')
      setLastError(null)
    })

    socket.on('disconnect', () => setStatus('error'))

    socket.on('gpu_metrics', (payload: GpuMetrics) => {
      if (payload.error) {
        setStatus('error')
        setLastError(payload.error)
        return
      }
      const timeLabel = new Date(payload.timestamp * 1000).toLocaleTimeString()
      setLatest(payload)
      setData((prev) => {
        const next = [...prev, { ...payload, timeLabel }]
        if (next.length > MAX_POINTS) next.shift()
        return next
      })
    })

    socket.on('connect_error', (err) => {
      setStatus('error')
      setLastError(err?.message || 'connect_error')
    })

    return () => {
      socket.close()
    }
  }, [])

  const chartTheme = {
    stroke: '#52525b',
    grid: '#27272a',
    text: '#a1a1aa',
  }

  return (
    <div className="gpu-dashboard">
      <div className="gpu-dashboard-header">
        <h2>GPU 实时监控</h2>
        <div className="gpu-status">
          <span className={`gpu-status-dot ${status}`} />
          {status === 'connecting' && '连接中...'}
          {status === 'connected' && '已连接'}
          {status === 'error' && '连接失败'}
        </div>
      </div>

      {status === 'error' && (
        <div className="gpu-error">
          <div className="gpu-error-title">没有收到 GPU 数据</div>
          <div className="gpu-error-body">
            {lastError ? `原因：${lastError}` : '原因未知（请看后端终端日志）'}
          </div>
          <div className="gpu-error-body">
            请确认已运行：<code>python gpu_ws_monitor.py</code>
          </div>
        </div>
      )}

      {latest && (
        <div className="gpu-live-values">
          <div className="gpu-live-card">
            <span className="gpu-live-label">VRAM</span>
            <span className="gpu-live-value">
              {latest.vramUsed.toFixed(0)} / {latest.vramTotal.toFixed(0)} MB
            </span>
            <span className="gpu-live-pct">({latest.vramUtil.toFixed(1)}%)</span>
          </div>
          <div className="gpu-live-card">
            <span className="gpu-live-label">SM 利用率</span>
            <span className="gpu-live-value">{latest.smUtil}%</span>
          </div>
          <div className="gpu-live-card">
            <span className="gpu-live-label">功耗</span>
            <span className="gpu-live-value">{latest.powerDraw.toFixed(1)} W</span>
          </div>
          <div className="gpu-live-card">
            <span className="gpu-live-label">温度</span>
            <span className="gpu-live-value">{latest.temperature}°C</span>
          </div>
        </div>
      )}

      <div className="gpu-charts">
        <div className="gpu-chart-card gpu-chart-wide">
          <div className="gpu-chart-title">VRAM Alloc vs Total (MB)</div>
          <div className="gpu-chart-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timeLabel" stroke={chartTheme.text} fontSize={11} />
                <YAxis stroke={chartTheme.text} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Legend />
                <Line type="monotone" dataKey="vramUsed" name="已用 VRAM" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="vramTotal" name="总 VRAM" stroke="#71717a" dot={false} strokeWidth={1} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gpu-chart-card">
          <div className="gpu-chart-title">SM / 显存控制器利用率 (%)</div>
          <div className="gpu-chart-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timeLabel" hide />
                <YAxis domain={[0, 100]} stroke={chartTheme.text} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                />
                <Legend />
                <ReferenceLine y={100} stroke="#404040" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="smUtil" name="SM 利用率" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="memUtil" name="显存控制器" stroke="#f97316" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gpu-chart-card">
          <div className="gpu-chart-title">GPU 功耗 (W)</div>
          <div className="gpu-chart-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timeLabel" hide />
                <YAxis stroke={chartTheme.text} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                />
                <Legend />
                <Line type="monotone" dataKey="powerDraw" name="功耗 (W)" stroke="#e11d48" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gpu-chart-card">
          <div className="gpu-chart-title">PCIe 吞吐量 (KB/s)</div>
          <div className="gpu-chart-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timeLabel" hide />
                <YAxis stroke={chartTheme.text} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                />
                <Legend />
                <Line type="monotone" dataKey="pcieTxKBs" name="PCIe TX" stroke="#a855f7" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="pcieRxKBs" name="PCIe RX" stroke="#0ea5e9" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gpu-chart-card">
          <div className="gpu-chart-title">GPU 温度 (°C)</div>
          <div className="gpu-chart-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timeLabel" hide />
                <YAxis stroke={chartTheme.text} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                />
                <Legend />
                <Line type="monotone" dataKey="temperature" name="温度 (°C)" stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="gpu-info-panel">
        <div className="gpu-info-block">
          <h4>指标说明</h4>
          <ul>
            <li><strong>VRAM Alloc vs Total</strong>：已用显存 vs 总显存。vLLM 会预分配 KV Cache 池，总显存 ≈ 模型 + Reserved。</li>
            <li><strong>SM 利用率</strong>：流处理器占用。低 SM 利用率 + 高显存带宽 → Memory-bound，带宽是瓶颈。</li>
            <li><strong>功耗</strong>：未跑满说明算子未充分利用流水线，或受限于带宽。</li>
            <li><strong>PCIe 吞吐量</strong>：Host↔GPU 数据传输速率，超长上下文时关键。</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
