from vllm import LLM, SamplingParams

# 1. 指向你下载好的模型路径
model_dir = r"C:\Users\Administrator\.cache\modelscope\hub\models\qwen\Qwen2.5-7B-Instruct"

# 2. 初始化引擎（避开了 uvloop，直接调用 CUDA 算子）
# 我们先用最小配置：限制长度为 512，防止显存爆炸
llm = LLM(
    model=model_dir,
    max_model_len=512,
    trust_remote_code=True,
    gpu_memory_utilization=0.8
)

# 3. 设置最简单的参数
params = SamplingParams(max_tokens=100, temperature=0.7)

# 4. 执行推理
output = llm.generate("你好，请问你是谁？", params)

# 5. 打印结果
print(f"\n模型回复：{output[0].outputs[0].text}")