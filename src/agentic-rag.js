import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";
import path from "path";

// 加载环境变量
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 知识库管理器
class KnowledgeBase {
  constructor() {
    this.documents = [];
    this.vectorStore = new Map();
    this.loadKnowledgeBase();
  }

  // 加载知识库
  loadKnowledgeBase() {
    const knowledgeFile = "knowledge-base.json";
    try {
      if (fs.existsSync(knowledgeFile)) {
        const data = fs.readFileSync(knowledgeFile, "utf8");
        this.documents = JSON.parse(data);
        console.log(`📚 已加载 ${this.documents.length} 个文档到知识库`);
      } else {
        // 创建默认知识库
        this.createDefaultKnowledgeBase();
      }
    } catch (error) {
      console.log("⚠️  知识库加载失败，创建默认知识库");
      this.createDefaultKnowledgeBase();
    }
  }

  // 创建默认知识库
  createDefaultKnowledgeBase() {
    this.documents = [
      {
        id: "doc1",
        title: "RAG技术介绍",
        content: "检索增强生成(RAG)是一种结合信息检索和生成式AI的技术。它通过检索相关文档来增强大语言模型的回答质量。",
        category: "技术",
        tags: ["RAG", "AI", "检索", "生成"],
        timestamp: new Date().toISOString()
      },
      {
        id: "doc2", 
        title: "JavaScript基础",
        content: "JavaScript是一种动态编程语言，广泛用于Web开发。它支持面向对象、函数式和事件驱动编程范式。",
        category: "编程",
        tags: ["JavaScript", "编程", "Web开发"],
        timestamp: new Date().toISOString()
      },
      {
        id: "doc3",
        title: "机器学习概述",
        content: "机器学习是人工智能的一个分支，通过算法让计算机从数据中学习模式，无需明确编程即可做出预测或决策。",
        category: "AI",
        tags: ["机器学习", "AI", "算法", "数据"],
        timestamp: new Date().toISOString()
      }
    ];
    this.saveKnowledgeBase();
  }

  // 保存知识库
  saveKnowledgeBase() {
    try {
      fs.writeFileSync("knowledge-base.json", JSON.stringify(this.documents, null, 2));
    } catch (error) {
      console.log("⚠️  知识库保存失败");
    }
  }

  // 添加文档
  addDocument(title, content, category = "通用", tags = []) {
    const doc = {
      id: `doc${Date.now()}`,
      title,
      content,
      category,
      tags,
      timestamp: new Date().toISOString()
    };
    this.documents.push(doc);
    this.saveKnowledgeBase();
    return doc.id;
  }

  // 检索文档
  retrieveDocuments(query, maxResults = 3) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const doc of this.documents) {
      let score = 0;
      
      // 标题匹配权重更高
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 3;
      }
      
      // 内容匹配
      if (doc.content.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      
      // 标签匹配
      for (const tag of doc.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 1;
        }
      }
      
      // 分词匹配
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 2) {
          if (doc.content.toLowerCase().includes(word)) {
            score += 0.5;
          }
        }
      }

      if (score > 0) {
        results.push({ ...doc, relevanceScore: score });
      }
    }

    // 按相关性排序并返回前N个结果
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  // 获取统计信息
  getStats() {
    const categories = {};
    for (const doc of this.documents) {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
    }
    return {
      totalDocuments: this.documents.length,
      categories
    };
  }
}

// 智能代理类
class AgenticRAGAgent {
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
    this.model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2048,
      }
    });
    this.conversationHistory = [];
  }

  // 分析查询意图
  async analyzeIntent(query) {
    const intentPrompt = `
分析以下用户查询的意图，返回JSON格式：
{
  "intent": "search|add_knowledge|question|chat",
  "keywords": ["关键词1", "关键词2"],
  "needsRetrieval": true/false,
  "complexity": "simple|medium|complex"
}

用户查询: "${query}"
`;

    try {
      const result = await this.model.generateContent(intentPrompt);
      const response = result.response.text();
      
      // 尝试解析JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log("意图分析失败，使用默认策略");
    }

    // 默认意图分析
    return {
      intent: "question",
      keywords: query.split(/\s+/).filter(word => word.length > 2),
      needsRetrieval: true,
      complexity: "medium"
    };
  }

  // 执行检索
  async performRetrieval(query, intent) {
    console.log("🔍 正在检索相关文档...");
    
    const retrievedDocs = this.kb.retrieveDocuments(query, 3);
    
    if (retrievedDocs.length > 0) {
      console.log(`📄 找到 ${retrievedDocs.length} 个相关文档:`);
      retrievedDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.title} (相关性: ${doc.relevanceScore.toFixed(1)})`);
      });
    } else {
      console.log("📄 未找到相关文档");
    }

    return retrievedDocs;
  }

  // 生成增强回答
  async generateResponse(query, retrievedDocs, intent) {
    console.log("🤖 正在生成回答...");

    let context = "";
    if (retrievedDocs.length > 0) {
      context = "相关文档信息:\n" + 
        retrievedDocs.map((doc, index) => 
          `文档${index + 1}: ${doc.title}\n内容: ${doc.content}`
        ).join("\n\n");
    }

    // 构建对话历史上下文
    let historyContext = "";
    if (this.conversationHistory.length > 0) {
      historyContext = "对话历史:\n" + 
        this.conversationHistory.slice(-4)
          .map(item => `${item.role}: ${item.content}`)
          .join("\n");
    }

    const prompt = `
你是一个智能的RAG助手，具有以下能力：
1. 基于检索到的文档回答问题
2. 承认知识局限性
3. 提供准确和有用的信息
4. 保持对话连贯性

${historyContext}

${context}

用户问题: ${query}

请基于上述信息回答用户问题。如果检索到的文档不足以回答问题，请诚实说明并提供你能给出的最佳回答。
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // 保存对话历史
      this.conversationHistory.push(
        { role: "用户", content: query },
        { role: "助手", content: response }
      );

      return response;
    } catch (error) {
      throw new Error(`生成回答失败: ${error.message}`);
    }
  }

  // 主要处理方法
  async process(query) {
    const startTime = Date.now();

    try {
      // 1. 分析意图
      const intent = await this.analyzeIntent(query);
      console.log(`🎯 意图分析: ${intent.intent} | 关键词: ${intent.keywords.join(", ")}`);

      // 2. 根据意图执行不同操作
      switch (intent.intent) {
        case "add_knowledge":
          return await this.handleAddKnowledge(query);
        
        case "search":
          const docs = await this.performRetrieval(query, intent);
          return this.formatSearchResults(docs);
        
        default:
          // 3. 执行检索
          const retrievedDocs = await this.performRetrieval(query, intent);
          
          // 4. 生成回答
          const response = await this.generateResponse(query, retrievedDocs, intent);
          
          const endTime = Date.now();
          const responseTime = ((endTime - startTime) / 1000).toFixed(1);
          
          return {
            response,
            retrievedDocs: retrievedDocs.length,
            responseTime: responseTime + "s"
          };
      }
    } catch (error) {
      throw error;
    }
  }

  // 处理添加知识
  async handleAddKnowledge(query) {
    // 这里可以实现从用户输入中提取知识并添加到知识库
    return {
      response: "知识添加功能正在开发中。您可以使用 'add' 命令手动添加文档。",
      retrievedDocs: 0,
      responseTime: "0.1s"
    };
  }

  // 格式化搜索结果
  formatSearchResults(docs) {
    if (docs.length === 0) {
      return {
        response: "未找到相关文档。",
        retrievedDocs: 0,
        responseTime: "0.1s"
      };
    }

    const results = docs.map((doc, index) => 
      `${index + 1}. **${doc.title}**\n   ${doc.content}\n   分类: ${doc.category} | 相关性: ${doc.relevanceScore.toFixed(1)}`
    ).join("\n\n");

    return {
      response: `找到 ${docs.length} 个相关文档:\n\n${results}`,
      retrievedDocs: docs.length,
      responseTime: "0.1s"
    };
  }
}

// 主应用类
class AgenticRAGApp {
  constructor() {
    this.kb = new KnowledgeBase();
    this.agent = new AgenticRAGAgent(this.kb);
  }

  // 显示帮助信息
  showHelp() {
    console.log("\n📖 Agentic RAG 系统命令:");
    console.log("  help         - 显示帮助信息");
    console.log("  add          - 添加文档到知识库");
    console.log("  search <查询> - 搜索文档");
    console.log("  stats        - 显示知识库统计");
    console.log("  clear        - 清空对话历史");
    console.log("  exit/quit    - 退出系统");
    console.log("  直接输入问题 - 智能问答");
  }

  // 添加文档
  async addDocument() {
    return new Promise((resolve) => {
      rl.question("📝 文档标题: ", (title) => {
        rl.question("📄 文档内容: ", (content) => {
          rl.question("🏷️  分类 (可选): ", (category) => {
            rl.question("🔖 标签 (用逗号分隔): ", (tagsInput) => {
              const tags = tagsInput.split(",").map(tag => tag.trim()).filter(tag => tag);
              const docId = this.kb.addDocument(
                title, 
                content, 
                category || "通用", 
                tags
              );
              console.log(`✅ 文档已添加，ID: ${docId}`);
              resolve();
            });
          });
        });
      });
    });
  }

  // 显示统计信息
  showStats() {
    const stats = this.kb.getStats();
    console.log("\n📊 知识库统计:");
    console.log(`  总文档数: ${stats.totalDocuments}`);
    console.log("  分类分布:");
    for (const [category, count] of Object.entries(stats.categories)) {
      console.log(`    ${category}: ${count}`);
    }
  }

  // 主循环
  async run() {
    console.log("🚀 欢迎使用 Agentic RAG 系统！");
    console.log("💡 这是一个智能代理增强的检索生成系统");
    console.log("📚 输入 'help' 查看所有命令");
    console.log("=".repeat(60));

    const askQuestion = async () => {
      rl.question("\n🤖 AgenticRAG> ", async (input) => {
        const command = input.trim();

        if (!command) {
          askQuestion();
          return;
        }

        try {
          switch (command.toLowerCase()) {
            case "exit":
            case "quit":
              console.log("\n👋 再见！");
              rl.close();
              return;

            case "help":
              this.showHelp();
              askQuestion();
              return;

            case "add":
              await this.addDocument();
              askQuestion();
              return;

            case "stats":
              this.showStats();
              askQuestion();
              return;

            case "clear":
              this.agent.conversationHistory = [];
              console.log("🧹 对话历史已清空");
              askQuestion();
              return;

            default:
              if (command.startsWith("search ")) {
                const query = command.substring(7);
                const result = await this.agent.process(query);
                console.log(`\n📋 搜索结果:\n${result.response}`);
              } else {
                // 智能问答
                const result = await this.agent.process(command);
                console.log(`\n🤖 回答 (${result.responseTime}, 检索了${result.retrievedDocs}个文档):`);
                console.log(result.response);
              }
              console.log("-".repeat(60));
              askQuestion();
          }
        } catch (error) {
          console.error(`\n❌ 错误: ${error.message}`);
          askQuestion();
        }
      });
    };

    askQuestion();
  }
}

// 处理程序退出
process.on("SIGINT", () => {
  console.log("\n\n👋 程序已退出！");
  rl.close();
  process.exit(0);
});

// 启动应用
const app = new AgenticRAGApp();
app.run();