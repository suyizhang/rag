import dotenv from "dotenv";
import readline from "readline";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * 简化版 PDF RAG 系统
 * 支持文本文件和手动添加文档
 */
class SimplePDFRAG {
  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: "embedding-001",
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
    });

    this.vectorStore = null;
    this.documents = [];
    this.conversationHistory = [];

    this.setupPrompts();
    this.setupChains();
    this.initializeWithSampleData();
  }

  /**
   * 设置提示模板
   */
  setupPrompts() {
    this.ragPrompt = PromptTemplate.fromTemplate(`
你是一个智能的文档问答助手。基于提供的文档内容回答用户问题。

文档内容:
{context}

对话历史:
{history}

用户问题: {question}

请基于文档内容提供准确、详细的回答。如果文档中没有相关信息，请明确说明。

回答:`);

    this.intentPrompt = PromptTemplate.fromTemplate(`
分析用户输入的意图，判断用户想要执行什么操作。

用户输入: {input}

可能的意图类型:
1. QUESTION - 询问问题，需要从文档中检索信息
2. ADD_DOC - 想要添加文档到知识库
3. ADD_TEXT - 想要添加文本内容
4. SEARCH - 想要搜索特定内容
5. STATS - 想要查看统计信息
6. HELP - 需要帮助信息
7. OTHER - 其他类型

请只返回意图类型，不要其他内容:`);
  }

  /**
   * 设置处理链
   */
  setupChains() {
    this.intentChain = RunnableSequence.from([
      this.intentPrompt,
      this.llm,
      new StringOutputParser(),
    ]);

    this.ragChain = RunnableSequence.from([
      this.ragPrompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  /**
   * 初始化示例数据
   */
  async initializeWithSampleData() {
    console.log("🔄 初始化示例知识库...");

    const sampleDocs = [
      {
        content: `
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

AI的主要应用领域包括：
1. 机器学习 - 让计算机从数据中学习
2. 自然语言处理 - 理解和生成人类语言
3. 计算机视觉 - 分析和理解图像
4. 专家系统 - 模拟人类专家的决策过程
5. 机器人技术 - 创建能够执行物理任务的智能机器

AI技术正在快速发展，并在医疗、金融、教育、交通等多个行业产生深远影响。
        `,
        metadata: {
          source: "AI基础知识.txt",
          title: "人工智能基础",
          type: "教育文档",
        },
      },
      {
        content: `
机器学习是人工智能的一个重要分支，它使计算机能够在没有明确编程的情况下学习和改进。

机器学习的主要类型：
1. 监督学习 - 使用标记数据进行训练
   - 分类：预测离散的类别
   - 回归：预测连续的数值

2. 无监督学习 - 从未标记的数据中发现模式
   - 聚类：将数据分组
   - 降维：减少数据的复杂性

3. 强化学习 - 通过与环境交互学习最优策略
   - 智能体通过试错学习
   - 奖励机制指导学习过程

常用的机器学习算法包括线性回归、决策树、随机森林、支持向量机、神经网络等。
        `,
        metadata: {
          source: "机器学习指南.txt",
          title: "机器学习详解",
          type: "技术文档",
        },
      },
      {
        content: `
大语言模型（Large Language Models，LLMs）是近年来AI领域的重大突破。

LLM的特点：
1. 规模庞大 - 包含数十亿到数万亿个参数
2. 预训练 - 在大量文本数据上进行预训练
3. 多任务能力 - 能够处理多种自然语言任务
4. 少样本学习 - 只需少量示例就能学习新任务

著名的LLM包括：
- GPT系列（OpenAI）
- BERT（Google）
- T5（Google）
- LaMDA（Google）
- PaLM（Google）
- Claude（Anthropic）

LLM的应用场景：
- 文本生成和创作
- 问答系统
- 代码生成
- 翻译
- 摘要生成
- 对话系统
        `,
        metadata: {
          source: "大语言模型.txt",
          title: "大语言模型概述",
          type: "前沿技术",
        },
      },
      {
        content: `
RAG（Retrieval Augmented Generation）是一种结合信息检索和文本生成的AI技术。

RAG系统的工作流程：
1. 文档预处理
   - 文档分割成小块
   - 生成向量嵌入
   - 存储到向量数据库

2. 查询处理
   - 用户提出问题
   - 将问题转换为向量
   - 检索相关文档片段

3. 生成回答
   - 将检索到的文档作为上下文
   - 使用语言模型生成回答
   - 确保回答基于检索到的信息

RAG的优势：
- 减少幻觉问题
- 提供可追溯的信息来源
- 支持实时信息更新
- 降低模型训练成本

RAG的应用：
- 企业知识库问答
- 文档助手
- 客户服务
- 研究辅助工具
        `,
        metadata: {
          source: "RAG技术详解.txt",
          title: "RAG系统原理",
          type: "技术架构",
        },
      },
    ];

    // 处理示例文档
    for (const doc of sampleDocs) {
      await this.addTextDocument(doc.content, doc.metadata);
    }

    console.log(
      `✅ 示例知识库初始化完成，包含 ${this.documents.length} 个文档块`
    );
  }

  /**
   * 添加文本文档
   */
  async addTextDocument(content, metadata = {}) {
    try {
      // 分割文本
      const chunks = await this.textSplitter.splitText(content);

      const documents = chunks.map((chunk, index) => ({
        pageContent: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          chunkSize: chunk.length,
          addedAt: new Date().toISOString(),
        },
      }));

      // 添加到文档集合
      this.documents.push(...documents);

      // 更新向量存储
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(documents);
      } else {
        this.vectorStore = await MemoryVectorStore.fromDocuments(
          this.documents,
          this.embeddings
        );
      }

      return {
        success: true,
        documentsAdded: documents.length,
        totalDocuments: this.documents.length,
      };
    } catch (error) {
      console.error("添加文档失败:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 从文件添加文档
   */
  async addFileDocument(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "文件不存在" };
      }

      const content = fs.readFileSync(filePath, "utf8");
      const metadata = {
        source: filePath,
        title: path.basename(filePath),
        type: "文件文档",
      };

      return await this.addTextDocument(content, metadata);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 搜索知识库
   */
  async searchKnowledgeBase(query, k = 5) {
    if (!this.vectorStore) {
      throw new Error("向量存储未初始化");
    }

    const results = await this.vectorStore.similaritySearch(query, k);

    return results.map((doc, index) => ({
      rank: index + 1,
      content: doc.pageContent,
      metadata: doc.metadata,
    }));
  }

  /**
   * 执行 RAG 查询
   */
  async executeRAGQuery(question) {
    try {
      console.log(`🔍 执行 RAG 查询...`);
      const startTime = Date.now();

      // 检索相关文档
      const relevantDocs = await this.searchKnowledgeBase(question, 3);

      if (relevantDocs.length === 0) {
        return {
          answer: "抱歉，我在知识库中没有找到相关信息。",
          sources: [],
          responseTime: Date.now() - startTime,
        };
      }

      // 构建上下文
      const context = relevantDocs
        .map(
          (doc, index) =>
            `文档${index + 1} (来源: ${doc.metadata.title || "未知"}):\n${
              doc.content
            }`
        )
        .join("\n\n");

      // 构建对话历史
      const history = this.conversationHistory
        .slice(-4)
        .map(
          (item) => `${item.type === "user" ? "用户" : "助手"}: ${item.content}`
        )
        .join("\n");

      // 生成回答
      const answer = await this.ragChain.invoke({
        context,
        history,
        question,
      });

      const responseTime = Date.now() - startTime;

      return {
        answer: answer.trim(),
        sources: relevantDocs.map((doc) => ({
          title: doc.metadata.title || "未知文档",
          source: doc.metadata.source || "未知来源",
          content: doc.content.substring(0, 150) + "...",
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
   * 分析用户意图
   */
  async analyzeIntent(input) {
    try {
      const intent = await this.intentChain.invoke({ input });
      return intent.trim().toUpperCase();
    } catch (error) {
      console.error("意图分析失败:", error);
      return "QUESTION";
    }
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
        case "ADD_DOC":
          // 尝试从输入中提取文件路径
          const pathMatch = input.match(/["']([^"']+)["']|(\S+\.\w+)/);
          if (pathMatch) {
            const filePath = pathMatch[1] || pathMatch[2];
            const result = await this.addFileDocument(filePath);
            response = {
              success: result.success,
              message: result.success
                ? `✅ 成功添加文档，新增 ${result.documentsAdded} 个文档块`
                : `❌ 添加失败: ${result.error}`,
            };
          } else {
            response = {
              success: false,
              message: "请提供文件路径，例如：添加 ./documents/sample.txt",
            };
          }
          break;

        case "ADD_TEXT":
          response = {
            success: true,
            message: "请输入要添加的文本内容（下一条消息）：",
            waitingForText: true,
          };
          break;

        case "SEARCH":
          const searchQuery = input.replace(/搜索|查找|search/gi, "").trim();
          if (searchQuery) {
            const searchResults = await this.searchKnowledgeBase(
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
          const stats = this.getStats();
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
   * 获取统计信息
   */
  getStats() {
    return {
      totalDocuments: this.documents.length,
      hasVectorStore: !!this.vectorStore,
      sources: [...new Set(this.documents.map((doc) => doc.metadata.source))],
      averageChunkSize:
        this.documents.length > 0
          ? Math.round(
              this.documents.reduce(
                (sum, doc) => sum + doc.pageContent.length,
                0
              ) / this.documents.length
            )
          : 0,
      conversationTurns: this.conversationHistory.length,
    };
  }

  /**
   * 获取帮助信息
   */
  getHelpMessage() {
    return `
📖 简化版 PDF RAG 系统帮助:

🔍 问答功能:
  - 直接提问，系统会从知识库中检索相关信息回答
  - 例如："什么是人工智能？"、"机器学习有哪些类型？"

📄 文档管理:
  - 添加文件: "添加 ./documents/sample.txt"
  - 添加文本: "添加文本" 然后输入内容
  - 搜索文档: "搜索 人工智能"

📊 系统功能:
  - 查看统计: "统计" 或 "stats"
  - 获取帮助: "help" 或 "帮助"
  - 退出系统: "exit" 或 "quit"

💡 提示:
  - 系统已预装AI相关知识
  - 支持中英文混合输入
  - 对话具有上下文记忆功能
`;
  }
}

/**
 * 命令行界面
 */
class SimplePDFRAGApp {
  constructor() {
    this.rag = null;
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
🚀 简化版 PDF RAG 系统！
📚 集成文档处理和智能问答
🤖 基于 Google Gemini 和 LangChain 框架
💡 输入 'help' 查看使用说明
======================================================================
`);
  }

  /**
   * 初始化系统
   */
  async initialize() {
    console.log("🔄 正在初始化系统...");
    this.rag = new SimplePDFRAG();
    // 等待初始化完成
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("✅ 系统初始化完成！");
  }

  /**
   * 显示统计信息
   */
  displayStats(stats) {
    console.log(`\n📊 知识库统计:`);
    console.log(`   - 文档块总数: ${stats.totalDocuments}`);
    console.log(
      `   - 向量存储: ${stats.hasVectorStore ? "✅ 已创建" : "❌ 未创建"}`
    );
    console.log(`   - 平均块大小: ${stats.averageChunkSize} 字符`);
    console.log(`   - 对话轮次: ${stats.conversationTurns}`);
    console.log(`   - 文档来源数: ${stats.sources.length}`);
  }

  /**
   * 显示搜索结果
   */
  displaySearchResults(results) {
    console.log(`\n🔍 搜索结果:`);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. 📄 ${result.metadata.title || "未知文档"}`);
      console.log(`   📍 来源: ${result.metadata.source || "未知"}`);
      console.log(`   📝 内容: ${result.content.substring(0, 150)}...`);
    });
  }

  /**
   * 启动应用
   */
  async start() {
    this.showWelcome();
    await this.initialize();

    const promptUser = () => {
      this.rl.question("🤖 RAG> ", async (input) => {
        if (input.trim()) {
          if (
            input.toLowerCase() === "exit" ||
            input.toLowerCase() === "quit"
          ) {
            console.log("👋 再见！");
            this.rl.close();
            process.exit(0);
          }

          const response = await this.rag.processInput(input);

          // 显示回复
          if (response.answer) {
            // RAG 回答
            console.log(
              `\n🤖 AI 回答 (${(response.responseTime / 1000).toFixed(1)}s):`
            );
            console.log(response.answer);

            if (response.sources && response.sources.length > 0) {
              console.log(`\n📚 参考文档 (${response.documentsUsed} 个):`);
              response.sources.forEach((source, index) => {
                console.log(`   ${index + 1}. ${source.title}`);
              });
            }
          } else if (response.stats) {
            // 统计信息
            this.displayStats(response.stats);
          } else if (response.results) {
            // 搜索结果
            this.displaySearchResults(response.results);
          } else {
            // 其他消息
            console.log(
              `\n${response.success ? "✅" : "❌"} ${response.message}`
            );
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
const app = new SimplePDFRAGApp();
app.start().catch(console.error);
