import dotenv from "dotenv";
import readline from "readline";
import PDFProcessor from "./pdf-processor.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * 集成 PDF 处理的 LangChain Agentic RAG 系统
 */
class LangChainPDFRAG {
  constructor() {
    this.pdfProcessor = new PDFProcessor();
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });

    this.conversationHistory = [];
    this.setupPrompts();
    this.setupChains();
  }

  /**
   * 设置提示模板
   */
  setupPrompts() {
    // RAG 问答提示模板
    this.ragPrompt = PromptTemplate.fromTemplate(`
你是一个智能的文档问答助手。基于提供的文档内容回答用户问题。

文档内容:
{context}

对话历史:
{history}

用户问题: {question}

请基于文档内容提供准确、详细的回答。如果文档中没有相关信息，请明确说明。

回答:`);

    // 意图分析提示模板
    this.intentPrompt = PromptTemplate.fromTemplate(`
分析用户输入的意图，判断用户想要执行什么操作。

用户输入: {input}

可能的意图类型:
1. QUESTION - 询问问题，需要从文档中检索信息
2. ADD_PDF - 想要添加PDF文档到知识库
3. SEARCH - 想要搜索特定内容
4. STATS - 想要查看统计信息
5. HELP - 需要帮助信息
6. OTHER - 其他类型

请只返回意图类型，不要其他内容:`);

    // 查询优化提示模板
    this.queryOptimizationPrompt = PromptTemplate.fromTemplate(`
优化用户查询，使其更适合向量检索。

原始查询: {query}
对话历史: {history}

请生成一个优化的搜索查询，提取关键词和概念:

优化查询:`);
  }

  /**
   * 设置处理链
   */
  setupChains() {
    // 意图分析链
    this.intentChain = RunnableSequence.from([
      this.intentPrompt,
      this.llm,
      new StringOutputParser(),
    ]);

    // 查询优化链
    this.queryOptimizationChain = RunnableSequence.from([
      this.queryOptimizationPrompt,
      this.llm,
      new StringOutputParser(),
    ]);

    // RAG 回答链
    this.ragChain = RunnableSequence.from([
      this.ragPrompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  /**
   * 分析用户意图
   */
  async analyzeIntent(input) {
    try {
      const intent = await this.intentChain.invoke({ input });
      return intent.trim().toUpperCase();
    } catch (error) {
      console.error("意图分析失败:", error);
      return "QUESTION"; // 默认为问题
    }
  }

  /**
   * 优化查询
   */
  async optimizeQuery(query) {
    try {
      const history = this.conversationHistory
        .slice(-3)
        .map((item) => `${item.type}: ${item.content}`)
        .join("\n");

      const optimizedQuery = await this.queryOptimizationChain.invoke({
        query,
        history,
      });

      return optimizedQuery.trim();
    } catch (error) {
      console.error("查询优化失败:", error);
      return query;
    }
  }

  /**
   * 执行 RAG 查询
   */
  async executeRAGQuery(question) {
    try {
      console.log(`🔍 执行 RAG 查询...`);
      const startTime = Date.now();

      // 1. 优化查询
      const optimizedQuery = await this.optimizeQuery(question);
      console.log(`🎯 优化查询: "${optimizedQuery}"`);

      // 2. 检索相关文档
      const relevantDocs = await this.pdfProcessor.searchKnowledgeBase(
        optimizedQuery,
        5
      );

      if (relevantDocs.length === 0) {
        return {
          answer: "抱歉，我在知识库中没有找到相关信息。请确保已经添加了相关的PDF文档。",
          sources: [],
          responseTime: Date.now() - startTime,
        };
      }

      // 3. 构建上下文
      const context = relevantDocs
        .map(
          (doc, index) =>
            `文档${index + 1} (来源: ${path.basename(doc.metadata.source)}):\n${doc.content}`
        )
        .join("\n\n");

      // 4. 构建对话历史
      const history = this.conversationHistory
        .slice(-4)
        .map((item) => `${item.type === "user" ? "用户" : "助手"}: ${item.content}`)
        .join("\n");

      // 5. 生成回答
      const answer = await this.ragChain.invoke({
        context,
        history,
        question,
      });

      const responseTime = Date.now() - startTime;

      return {
        answer: answer.trim(),
        sources: relevantDocs.map((doc) => ({
          source: path.basename(doc.metadata.source),
          content: doc.content.substring(0, 200) + "...",
        })),
        responseTime,
        documentsUsed: relevantDocs.length,
      };
    } catch (error) {
      console.error("RAG 查询失败:", error);
      return {
        answer: `抱歉，处理您的问题时出现错误: ${error.message}`,
        sources: [],
        responseTime: 0,
      };
    }
  }

  /**
   * 添加 PDF 文件
   */
  async addPDFFile(filePath) {
    console.log(`\n📄 添加 PDF 文件: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      return { success: false, message: "文件不存在" };
    }

    const result = await this.pdfProcessor.addPDFToKnowledgeBase(filePath);

    if (result.success) {
      return {
        success: true,
        message: `✅ 成功添加 ${result.documentsAdded} 个文档块到知识库`,
        details: result,
      };
    } else {
      return {
        success: false,
        message: `❌ 添加失败: ${result.error}`,
      };
    }
  }

  /**
   * 批量添加 PDF 目录
   */
  async addPDFDirectory(directoryPath) {
    console.log(`\n📁 批量添加目录: ${directoryPath}`);

    if (!fs.existsSync(directoryPath)) {
      return { success: false, message: "目录不存在" };
    }

    const results = await this.pdfProcessor.addPDFsFromDirectory(directoryPath);

    if (results.length === 0) {
      return { success: false, message: "目录中没有找到 PDF 文件" };
    }

    const successCount = results.filter((r) => r.success).length;
    const totalDocuments = results.reduce(
      (sum, r) => sum + (r.documentsAdded || 0),
      0
    );

    return {
      success: true,
      message: `✅ 成功处理 ${successCount}/${results.length} 个文件，添加 ${totalDocuments} 个文档块`,
      details: results,
    };
  }

  /**
   * 处理用户输入
   */
  async processInput(input) {
    try {
      // 记录用户输入
      this.conversationHistory.push({
        type: "user",
        content: input,
        timestamp: new Date().toISOString(),
      });

      // 分析意图
      const intent = await this.analyzeIntent(input);
      console.log(`🎯 检测到意图: ${intent}`);

      let response;

      switch (intent) {
        case "ADD_PDF":
          // 尝试从输入中提取文件路径
          const pathMatch = input.match(/["']([^"']+)["']|(\S+\.pdf)/i);
          if (pathMatch) {
            const filePath = pathMatch[1] || pathMatch[2];
            response = await this.addPDFFile(filePath);
          } else {
            response = {
              success: false,
              message: "请提供 PDF 文件路径，例如：添加 ./documents/sample.pdf",
            };
          }
          break;

        case "SEARCH":
          const searchQuery = input.replace(/搜索|查找|search/gi, "").trim();
          if (searchQuery) {
            const searchResults = await this.pdfProcessor.searchKnowledgeBase(
              searchQuery,
              3
            );
            response = {
              success: true,
              message: `找到 ${searchResults.length} 个相关文档`,
              results: searchResults,
            };
          } else {
            response = { success: false, message: "请提供搜索关键词" };
          }
          break;

        case "STATS":
          const stats = this.pdfProcessor.getStats();
          response = {
            success: true,
            message: "知识库统计信息",
            stats,
          };
          break;

        case "HELP":
          response = {
            success: true,
            message: this.getHelpMessage(),
          };
          break;

        case "QUESTION":
        default:
          // 执行 RAG 查询
          response = await this.executeRAGQuery(input);
          break;
      }

      // 记录助手回复
      this.conversationHistory.push({
        type: "assistant",
        content: response.answer || response.message,
        timestamp: new Date().toISOString(),
        metadata: response,
      });

      return response;
    } catch (error) {
      console.error("处理输入失败:", error);
      return {
        success: false,
        message: `处理失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取帮助信息
   */
  getHelpMessage() {
    return `
📖 LangChain PDF RAG 系统帮助:

🔍 问答功能:
  - 直接提问，系统会从PDF文档中检索相关信息回答
  - 例如："什么是人工智能？"

📄 PDF 管理:
  - 添加文件: "添加 ./documents/sample.pdf"
  - 批量添加: "添加目录 ./documents"
  - 搜索文档: "搜索 人工智能"

📊 系统功能:
  - 查看统计: "统计" 或 "stats"
  - 获取帮助: "help" 或 "帮助"
  - 退出系统: "exit" 或 "quit"

💡 提示:
  - 系统会自动分析您的意图并执行相应操作
  - 支持中英文混合输入
  - 对话具有上下文记忆功能
`;
  }

  /**
   * 显示统计信息
   */
  displayStats(stats) {
    console.log(`\n📊 知识库统计:`);
    console.log(`   - 文档块总数: ${stats.totalDocuments}`);
    console.log(`   - 向量存储: ${stats.hasVectorStore ? "✅ 已创建" : "❌ 未创建"}`);
    console.log(`   - 平均块大小: ${stats.averageChunkSize} 字符`);
    console.log(`   - 文档来源数: ${stats.sources.length}`);

    if (stats.sources.length > 0) {
      console.log(`\n📚 文档来源:`);
      stats.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${path.basename(source)}`);
      });
    }
  }

  /**
   * 显示搜索结果
   */
  displaySearchResults(results) {
    console.log(`\n🔍 搜索结果:`);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. 📄 ${result.metadata.title || "未知文档"}`);
      console.log(`   📍 来源: ${path.basename(result.metadata.source)}`);
      console.log(`   📝 内容: ${result.content.substring(0, 150)}...`);
    });
  }
}

/**
 * 命令行界面
 */
class LangChainPDFRAGApp {
  constructor() {
    this.rag = new LangChainPDFRAG();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * 显示欢迎信息
   */
  showWelcome() {
    console.log(`
🚀 LangChain PDF RAG 系统！
📚 集成 PDF 处理和智能问答的高级 RAG 系统
🤖 基于 Google Gemini 和 LangChain 框架
💡 输入 'help' 查看使用说明
======================================================================
`);
  }

  /**
   * 启动应用
   */
  async start() {
    this.showWelcome();

    const promptUser = () => {
      this.rl.question("🤖 PDF-RAG> ", async (input) => {
        if (input.trim()) {
          if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
            console.log("👋 再见！");
            this.rl.close();
            process.exit(0);
          }

          const startTime = Date.now();
          const response = await this.rag.processInput(input);
          const responseTime = Date.now() - startTime;

          // 显示回复
          if (response.answer) {
            // RAG 回答
            console.log(`\n🤖 AI 回答 (${(response.responseTime / 1000).toFixed(1)}s):`);
            console.log(response.answer);

            if (response.sources && response.sources.length > 0) {
              console.log(`\n📚 参考文档 (${response.documentsUsed} 个):`);
              response.sources.forEach((source, index) => {
                console.log(`   ${index + 1}. ${source.source}`);
              });
            }
          } else if (response.stats) {
            // 统计信息
            this.rag.displayStats(response.stats);
          } else if (response.results) {
            // 搜索结果
            this.rag.displaySearchResults(response.results);
          } else {
            // 其他消息
            console.log(`\n${response.success ? "✅" : "❌"} ${response.message}`);
          }

          console.log(`\n${"─".repeat(70)}`);
        }
        promptUser();
      });
    };

    promptUser();
  }
}

// 启动应用
const app = new LangChainPDFRAGApp();
app.start().catch(console.error);