"""
GPU 实时监控服务 - 基于 pynvml + Socket.io
数据源：pynvml (NVIDIA 显存管理库)
推送：WebSocket (Flask-SocketIO)
"""
import time
import threading
from typing import Dict, Any

from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS

try:
    import pynvml
    HAS_NVML = True
except ImportError:
    HAS_NVML = False
    print("警告: pynvml 未安装，运行 pip install pynvml")

UPDATE_INTERVAL = 0.5  # 秒，500ms 刷新

app = Flask(__name__)
app.config["SECRET_KEY"] = "gpu-monitor-secret"
CORS(app, origins="*")
# Flask 3.x 下，flask-socketio 默认 manage_session=True 可能会触发
# RequestContext.session 的只读属性问题。这里关闭由 flask-socketio 接管 session。
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    manage_session=False,
)

handle = None
device_index = 0


def init_nvml() -> bool:
    global handle
    if not HAS_NVML:
        return False
    try:
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(device_index)
        return True
    except Exception as e:
        print(f"NVML 初始化失败: {e}")
        return False


def collect_gpu_metrics() -> Dict[str, Any]:
    """从 NVML 采集一帧 GPU 指标"""
    if not handle:
        return {"error": "NVML 未初始化"}

    try:
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        power = pynvml.nvmlDeviceGetPowerUsage(handle)  # 毫瓦
        temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)

        # PCIe 吞吐量 KB/s（部分驱动可能不支持）
        pcie_tx, pcie_rx = 0, 0
        try:
            pcie_tx = pynvml.nvmlDeviceGetPcieThroughput(
                handle, pynvml.NVML_PCIE_UTIL_TX_BYTES
            )
            pcie_rx = pynvml.nvmlDeviceGetPcieThroughput(
                handle, pynvml.NVML_PCIE_UTIL_RX_BYTES
            )
        except Exception:
            pass

        return {
            "timestamp": time.time(),
            "vramUsed": round(mem.used / (1024**2), 2),
            "vramTotal": round(mem.total / (1024**2), 2),
            "vramUtil": round(mem.used / mem.total * 100, 2),
            "smUtil": util.gpu,
            "memUtil": util.memory,
            "powerDraw": round(power / 1000.0, 2),
            "temperature": temp,
            "pcieTxKBs": pcie_tx,
            "pcieRxKBs": pcie_rx,
        }
    except Exception as e:
        return {"error": str(e), "timestamp": time.time()}


def gpu_monitor_loop():
    """后台线程：定时推送 GPU 数据"""
    while True:
        data = collect_gpu_metrics() if handle else {"error": "NVML 未初始化", "timestamp": time.time()}
        # 同时向 /gpu 和默认 namespace 推送，避免前端连错 namespace 收不到数据
        socketio.emit("gpu_metrics", data, namespace="/gpu")
        socketio.emit("gpu_metrics", data, namespace="/")
        time.sleep(UPDATE_INTERVAL)


@socketio.on("connect", namespace="/gpu")
def on_connect():
    emit("gpu_metrics", collect_gpu_metrics() if handle else {"error": "NVML 未初始化"})


@socketio.on("connect", namespace="/")
def on_connect_root():
    emit("gpu_metrics", collect_gpu_metrics() if handle else {"error": "NVML 未初始化"})


def main():
    if not init_nvml():
        print("无法初始化 GPU，将推送空数据")
    else:
        t = threading.Thread(target=gpu_monitor_loop, daemon=True)
        t.start()
        print("GPU WebSocket 监控已启动，推送间隔 500ms")
        print("提示：如果你在 WSL 里跑模型，但在 Windows 跑此监控，请确保 Windows 侧能运行 nvidia-smi")

    print("服务地址: http://localhost:5001")
    print("Socket.io namespace: /gpu")
    socketio.run(app, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    try:
        main()
    finally:
        if HAS_NVML:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
