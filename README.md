# Google Gemini AI 集成项目

## 设置说明

### 1. 获取 API 密钥

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 使用你的 Google 账户登录
3. 点击 "Create API Key" 创建新的 API 密钥
4. 复制生成的 API 密钥

### 2. 配置环境变量

1. 打开项目根目录下的 `.env` 文件
2. 将 `your-actual-api-key-here` 替换为你刚才获取的真实 API 密钥：
   ```
   GEMINI_API_KEY=你的真实API密钥
   ```

### 3. 运行项目

```bash
node src/google.js
```

## 项目结构

- `src/google.js` - 主要的 Google Gemini AI 集成代码
- `.env` - 环境变量配置文件（包含 API 密钥）
- `package.json` - 项目依赖配置

## 依赖包

- `@google/generative-ai` - Google Generative AI 官方 SDK
- `dotenv` - 环境变量加载器
- `@langchain/core` 和 `langchain` - LangChain 框架

## 故障排除

如果遇到权限错误，请确保：
1. API 密钥正确设置在 `.env` 文件中
2. API 密钥有效且未过期
3. 使用了正确的模型名称（如 `gemini-1.5-flash`）