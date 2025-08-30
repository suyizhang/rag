import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 确保环境变量正确设置
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  try {
    // 使用正确的模型名称
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "请用一句话解释什么是人工智能";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log(text);
  } catch (error) {
    console.error("Error:", error);
  }
}

// main();
