# Qwen 对话 Web 界面

类似 ChatGPT 的聊天界面，支持**流式输出**，对接本地 WSL 中运行的 Qwen 2.5 3B（OpenAI 兼容 API）。

## 前提

- WSL 中已启动模型服务，并暴露 `http://localhost:8000/v1/chat/completions`
- 本机可访问 `http://localhost:8000`（与你在 PowerShell 里用 `Invoke-RestMethod` 时一致）

## 使用

```bash
cd web
npm install
npm run dev
```

浏览器打开 **http://localhost:3000**。  
前端会通过 Vite 代理把 `/v1` 请求转发到 `http://localhost:8000`，无需在模型服务端配置 CORS。

## 功能

- 多轮对话，历史消息会一并发给模型
- **流式输出**：回复会逐字显示，带光标动画
- 深色主题、响应式布局
- Enter 发送，Shift+Enter 换行

## 修改模型参数

在 `src/api.ts` 的 `streamChat` 调用处可修改默认的 `model`、`maxTokens`、`temperature`。  
在 `src/App.tsx` 里调用 `streamChat` 时传入对应参数即可。
