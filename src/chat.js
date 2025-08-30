import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from "readline";

// 加载环境变量
dotenv.config();

// 确保环境变量正确设置
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 对话历史记录
let conversationHistory = [];

async function chat() {
  console.log("🤖 欢迎使用 Gemini AI 对话助手！");
  console.log("💡 输入 'exit' 或 'quit' 退出对话");
  console.log("💡 输入 'clear' 清空对话历史");
  console.log("💡 输入 'history' 查看对话历史");
  console.log("=".repeat(50));

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  // 开始对话循环
  const askQuestion = () => {
    rl.question("\n👤 你: ", async (userInput) => {
      const input = userInput.trim();

      // 处理退出命令
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log("\n👋 再见！感谢使用 Gemini AI 对话助手！");
        rl.close();
        return;
      }

      // 处理清空历史命令
      if (input.toLowerCase() === "clear") {
        conversationHistory = [];
        console.log("🧹 对话历史已清空");
        askQuestion();
        return;
      }

      // 处理查看历史命令
      if (input.toLowerCase() === "history") {
        if (conversationHistory.length === 0) {
          console.log("📝 暂无对话历史");
        } else {
          console.log("\n📝 对话历史:");
          conversationHistory.forEach((item, index) => {
            const icon = item.role === "用户" ? "👤" : "🤖";
            console.log(
              `${icon} ${item.role}: ${item.content.substring(0, 100)}${
                item.content.length > 100 ? "..." : ""
              }`
            );
          });
        }
        askQuestion();
        return;
      }

      // 如果输入为空，继续询问
      if (!input) {
        console.log("💭 请输入你的问题...");
        askQuestion();
        return;
      }

      try {
        console.log("\n🤖 AI 正在思考...");

        // 构建对话上下文
        let contextPrompt = input;
        if (conversationHistory.length > 0) {
          const context = conversationHistory
            .slice(-6) // 保留最近6轮对话作为上下文
            .map((item) => `${item.role}: ${item.content}`)
            .join("\n");
          contextPrompt = `对话历史:\n${context}\n\n当前问题: ${input}\n\n请基于对话历史回答当前问题，保持对话的连贯性。`;
        }

        const result = await model.generateContent(contextPrompt);
        const response = await result.response;
        const text = response.text();

        // 保存对话历史
        conversationHistory.push(
          { role: "用户", content: input },
          { role: "AI", content: text }
        );

        console.log(`\n🤖 AI: ${text}`);
        console.log("-".repeat(50));

        // 继续对话
        askQuestion();
      } catch (error) {
        console.error("\n❌ 发生错误:", error.message);

        if (error.message.includes("API key")) {
          console.log("💡 请检查 API 密钥是否正确设置");
        } else if (error.message.includes("quota")) {
          console.log("💡 API 配额可能已用完");
        } else if (error.message.includes("SAFETY")) {
          console.log("💡 内容被安全过滤器拦截，请尝试其他问题");
        }

        // 即使出错也继续对话
        askQuestion();
      }
    });
  };

  // 开始第一次询问
  askQuestion();
}

// 处理程序退出
process.on("SIGINT", () => {
  console.log("\n\n👋 程序已退出，再见！");
  rl.close();
  process.exit(0);
});

// 启动对话
chat();
