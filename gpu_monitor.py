"""
GPU 监控服务
提供 GPU 使用率、显存、温度等信息
"""
from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import re
import json

app = Flask(__name__)
CORS(app)  # 允许跨域


def get_gpu_info():
    """使用 nvidia-smi 获取 GPU 信息"""
    try:
        # 执行 nvidia-smi 命令
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw', 
             '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode != 0:
            return None
        
        # 解析输出：格式为 "gpu_util,mem_used,mem_total,temp,power"
        line = result.stdout.strip()
        if not line:
            return None
        
        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 5:
            return None
        
        gpu_util = float(parts[0])
        mem_used = float(parts[1])
        mem_total = float(parts[2])
        temp = float(parts[3])
        power = float(parts[4]) if parts[4] else 0.0
        
        return {
            'gpuUtilization': gpu_util,
            'memoryUsed': mem_used,
            'memoryTotal': mem_total,
            'memoryUtilization': (mem_used / mem_total * 100) if mem_total > 0 else 0,
            'temperature': temp,
            'powerUsage': power
        }
    except FileNotFoundError:
        # nvidia-smi 不存在，可能没有 NVIDIA GPU
        return None
    except Exception as e:
        print(f"获取 GPU 信息失败: {e}")
        return None


@app.route('/api/gpu', methods=['GET'])
def gpu_info():
    """返回 GPU 信息"""
    info = get_gpu_info()
    if info is None:
        return jsonify({
            'error': '无法获取 GPU 信息，请确保已安装 NVIDIA 驱动和 nvidia-smi'
        }), 503
    
    return jsonify(info)


@app.route('/api/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("启动 GPU 监控服务...")
    print("访问 http://localhost:5000/api/gpu 获取 GPU 信息")
    app.run(host='0.0.0.0', port=5000, debug=False)
