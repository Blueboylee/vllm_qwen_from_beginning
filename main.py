from vllm import LLM, SamplingParams

# 1. 指向你下载好的模型路径
model_dir = r"./models/Qwen/Qwen2.5-7B-Instruct-GPTQ-Int8"

# 2. 初始化引擎
llm = LLM(
    model=model_dir,
    quantization="gptq",
    max_model_len=4096,
    trust_remote_code=True,
    gpu_memory_utilization=0.90,
    enforce_eager=True,
)

# 3. 设置最简单的参数
params = SamplingParams(max_tokens=100, temperature=0.7)

# 4. 执行推理
output = llm.generate("你好，请问你是谁？", params)

# 5. 打印结果
print(f"\n模型回复：{output[0].outputs[0].text}")