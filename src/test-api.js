import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

async function testAPI() {
  console.log("🔍 检查 API 密钥配置...");
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "your-actual-api-key-here") {
    console.error("❌ 错误：请在 .env 文件中设置有效的 GEMINI_API_KEY");
    console.log("📝 请按照以下步骤操作：");
    console.log("1. 访问 https://makersuite.google.com/app/apikey");
    console.log("2. 创建新的 API 密钥");
    console.log("3. 在 .env 文件中替换 your-actual-api-key-here");
    return;
  }
  
  console.log("✅ API 密钥已设置");
  console.log("🚀 测试 API 连接...");
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "请用一句话解释什么是人工智能";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ API 测试成功！");
    console.log("🤖 AI 回复：", text);
    
  } catch (error) {
    console.error("❌ API 测试失败：", error.message);
    
    if (error.message.includes("API key not valid")) {
      console.log("💡 建议：请检查 API 密钥是否正确");
    } else if (error.message.includes("quota")) {
      console.log("💡 建议：API 配额可能已用完，请检查使用限制");
    } else {
      console.log("💡 建议：请检查网络连接和 API 密钥权限");
    }
  }
}

testAPI();