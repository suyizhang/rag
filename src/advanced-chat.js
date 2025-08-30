import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";

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
const historyFile = "chat-history.json";

// 加载历史记录
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, "utf8");
      conversationHistory = JSON.parse(data);
      console.log(`📚 已加载 ${conversationHistory.length / 2} 轮历史对话`);
    }
  } catch (error) {
    console.log("⚠️  历史记录加载失败，将创建新的对话");
  }
}

// 保存历史记录
function saveHistory() {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(conversationHistory, null, 2));
  } catch (error) {
    console.log("⚠️  历史记录保存失败");
  }
}

// 显示帮助信息
function showHelp() {
  console.log("\n📖 可用命令:");
  console.log("  exit/quit    - 退出对话");
  console.log("  clear        - 清空当前会话历史");
  console.log("  history      - 查看对话历史");
  console.log("  save         - 手动保存对话历史");
  console.log("  load         - 重新加载历史记录");
  console.log("  help         - 显示此帮助信息");
  console.log("  stats        - 显示对话统计");
}

// 显示统计信息
function showStats() {
  const totalMessages = conversationHistory.length;
  const userMessages = conversationHistory.filter(
    (item) => item.role === "用户"
  ).length;
  const aiMessages = conversationHistory.filter(
    (item) => item.role === "AI"
  ).length;

  console.log("\n📊 对话统计:");
  console.log(`  总消息数: ${totalMessages}`);
  console.log(`  用户消息: ${userMessages}`);
  console.log(`  AI 回复: ${aiMessages}`);
  console.log(`  对话轮数: ${Math.min(userMessages, aiMessages)}`);
}

async function advancedChat() {
  console.log("🚀 欢迎使用 Gemini AI 高级对话助手！");
  console.log("💡 输入 'help' 查看所有可用命令");
  console.log("=".repeat(60));

  // 加载历史记录
  loadHistory();

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
    },
    systemInstruction:
      "你是一个友好、有帮助的AI助手。请用中文回答问题，保持对话自然流畅。",
  });

  // 开始对话循环
  const askQuestion = () => {
    rl.question("\n👤 你: ", async (userInput) => {
      const input = userInput.trim();

      // 处理各种命令
      switch (input.toLowerCase()) {
        case "exit":
        case "quit":
          saveHistory();
          console.log("\n👋 对话已保存，再见！");
          rl.close();
          return;

        case "clear":
          conversationHistory = [];
          console.log("🧹 当前会话历史已清空");
          askQuestion();
          return;

        case "history":
          if (conversationHistory.length === 0) {
            console.log("📝 暂无对话历史");
          } else {
            console.log("\n📝 最近的对话历史:");
            conversationHistory.slice(-10).forEach((item, index) => {
              const icon = item.role === "用户" ? "👤" : "🤖";
              const preview =
                item.content.length > 80
                  ? item.content.substring(0, 80) + "..."
                  : item.content;
              console.log(`${icon} ${item.role}: ${preview}`);
            });
          }
          askQuestion();
          return;

        case "save":
          saveHistory();
          console.log("💾 对话历史已保存");
          askQuestion();
          return;

        case "load":
          loadHistory();
          askQuestion();
          return;

        case "help":
          showHelp();
          askQuestion();
          return;

        case "stats":
          showStats();
          askQuestion();
          return;

        case "":
          console.log("💭 请输入你的问题或命令...");
          askQuestion();
          return;
      }

      try {
        console.log("\n🤖 AI 正在思考...");
        const startTime = Date.now();

        // 构建对话上下文
        let contextPrompt = input;
        if (conversationHistory.length > 0) {
          const recentHistory = conversationHistory.slice(-8); // 保留最近8轮对话
          const context = recentHistory
            .map((item) => `${item.role}: ${item.content}`)
            .join("\n");
          contextPrompt = `对话历史:\n${context}\n\n当前问题: ${input}`;
        }

        const result = await model.generateContent(contextPrompt);
        const response = await result.response;
        const text = response.text();

        const endTime = Date.now();
        const responseTime = ((endTime - startTime) / 1000).toFixed(1);

        // 保存对话历史
        conversationHistory.push(
          {
            role: "用户",
            content: input,
            timestamp: new Date().toISOString(),
          },
          {
            role: "AI",
            content: text,
            timestamp: new Date().toISOString(),
            responseTime: responseTime + "s",
          }
        );

        console.log(`\n🤖 AI (${responseTime}s): ${text}`);
        console.log("-".repeat(60));

        // 自动保存历史记录
        if (conversationHistory.length % 10 === 0) {
          saveHistory();
        }

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
        } else {
          console.log("💡 请检查网络连接或稍后重试");
        }

        askQuestion();
      }
    });
  };

  // 开始第一次询问
  askQuestion();
}

// 处理程序退出
process.on("SIGINT", () => {
  console.log("\n\n💾 正在保存对话历史...");
  saveHistory();
  console.log("👋 程序已退出，再见！");
  rl.close();
  process.exit(0);
});

// 启动高级对话
advancedChat();
