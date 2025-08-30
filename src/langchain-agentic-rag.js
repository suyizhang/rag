import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { RetrievalQAChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";
import { pull } from "langchain/hub";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";

// 加载环境变量
dotenv.config({ path: "../.env" });

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// LangChain 知识库管理器
class LangChainKnowledgeBase {
  constructor() {
    this.documents = [];
    this.vectorStore = null;
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "embedding-001",
    });
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    this.loadKnowledgeBase();
  }

  // 加载知识库
  async loadKnowledgeBase() {
    const knowledgeFile = "langchain-knowledge-base.json";
    try {
      if (fs.existsSync(knowledgeFile)) {
        const data = fs.readFileSync(knowledgeFile, "utf8");
        this.documents = JSON.parse(data);
        console.log(
          `📚 已加载 ${this.documents.length} 个文档到 LangChain 知识库`
        );
      } else {
        await this.createDefaultKnowledgeBase();
      }
      await this.buildVectorStore();
    } catch (error) {
      console.log("⚠️  知识库加载失败，创建默认知识库");
      await this.createDefaultKnowledgeBase();
    }
  }

  // 创建默认知识库
  async createDefaultKnowledgeBase() {
    const defaultDocs = [
      {
        id: "lc_doc1",
        title: "LangChain框架介绍",
        content: `LangChain是一个用于开发由语言模型驱动的应用程序的框架。它提供了以下核心概念：
        
        1. LLMs和Chat Models：与语言模型交互的接口
        2. Prompt Templates：管理LLM的提示
        3. Chains：将多个组件链接在一起
        4. Agents：使用LLM来决定采取哪些行动
        5. Memory：在链或代理调用之间保持状态
        6. Vector Stores：存储和搜索非结构化数据
        
        LangChain支持多种LLM提供商，包括OpenAI、Google、Anthropic等。它还提供了丰富的工具生态系统，用于构建复杂的AI应用程序。`,
        category: "框架",
        tags: ["LangChain", "框架", "LLM", "AI开发"],
        metadata: {
          author: "LangChain Team",
          difficulty: "中级",
          readTime: "8分钟",
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: "lc_doc2",
        title: "RAG系统架构设计",
        content: `检索增强生成(RAG)系统的核心架构包括以下组件：
        
        1. 文档加载器：从各种源加载文档
        2. 文本分割器：将长文档分割成可管理的块
        3. 嵌入模型：将文本转换为向量表示
        4. 向量数据库：存储和检索文档向量
        5. 检索器：根据查询检索相关文档
        6. 生成模型：基于检索的上下文生成回答
        
        在LangChain中，这些组件可以通过Chains和Agents进行组合，创建智能的问答系统。RAG系统特别适合需要访问大量外部知识的应用场景。`,
        category: "架构",
        tags: ["RAG", "架构", "检索", "生成", "向量数据库"],
        metadata: {
          author: "AI Architect",
          difficulty: "高级",
          readTime: "10分钟",
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: "lc_doc3",
        title: "智能代理(Agents)详解",
        content: `LangChain中的智能代理是能够使用工具并根据用户输入做出决策的系统。代理的核心组件包括：
        
        1. Agent：决策制定的核心逻辑
        2. Tools：代理可以使用的工具集合
        3. Toolkit：相关工具的集合
        4. Agent Executor：运行代理的执行器
        
        常见的代理类型：
        - ReAct Agent：推理和行动的结合
        - Plan-and-Execute Agent：先制定计划再执行
        - Self-Ask Agent：自我提问的代理
        
        代理可以访问各种工具，如搜索引擎、计算器、数据库查询等，使其能够处理复杂的多步骤任务。`,
        category: "代理",
        tags: ["Agent", "智能代理", "工具", "决策", "ReAct"],
        metadata: {
          author: "Agent Expert",
          difficulty: "高级",
          readTime: "12分钟",
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: "lc_doc4",
        title: "向量数据库与嵌入",
        content: `向量数据库是现代AI应用的核心基础设施，用于存储和检索高维向量数据。在RAG系统中的作用：
        
        1. 文本嵌入：将文档转换为向量表示
        2. 相似性搜索：基于向量相似度检索相关文档
        3. 语义理解：捕获文本的语义含义
        
        LangChain支持的向量数据库：
        - Chroma：轻量级的开源向量数据库
        - Pinecone：云端向量数据库服务
        - Weaviate：开源的向量搜索引擎
        - FAISS：Facebook的相似性搜索库
        
        嵌入模型的选择对检索质量至关重要，常用的包括OpenAI Embeddings、Google Embeddings等。`,
        category: "技术",
        tags: ["向量数据库", "嵌入", "Chroma", "Pinecone", "语义搜索"],
        metadata: {
          author: "Vector DB Expert",
          difficulty: "中级",
          readTime: "6分钟",
        },
        timestamp: new Date().toISOString(),
      },
    ];

    this.documents = defaultDocs;
    this.saveKnowledgeBase();
  }

  // 构建向量存储
  async buildVectorStore() {
    console.log("🔄 正在构建向量存储...");

    // 将文档转换为 LangChain Document 格式
    const langchainDocs = [];
    for (const doc of this.documents) {
      const splits = await this.textSplitter.splitText(doc.content);
      for (let i = 0; i < splits.length; i++) {
        langchainDocs.push(
          new Document({
            pageContent: splits[i],
            metadata: {
              id: `${doc.id}_chunk_${i}`,
              title: doc.title,
              category: doc.category,
              tags: doc.tags,
              chunkIndex: i,
              ...doc.metadata,
            },
          })
        );
      }
    }

    // 创建向量存储
    this.vectorStore = await MemoryVectorStore.fromDocuments(
      langchainDocs,
      this.embeddings
    );

    console.log(`✅ 向量存储构建完成，包含 ${langchainDocs.length} 个文档块`);
  }

  // 保存知识库
  saveKnowledgeBase() {
    try {
      fs.writeFileSync(
        "langchain-knowledge-base.json",
        JSON.stringify(this.documents, null, 2)
      );
    } catch (error) {
      console.log("⚠️  知识库保存失败");
    }
  }

  // 添加文档
  async addDocument(
    title,
    content,
    category = "通用",
    tags = [],
    metadata = {}
  ) {
    const doc = {
      id: `lc_doc${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      category,
      tags,
      metadata: {
        author: "用户",
        difficulty: "未知",
        readTime: Math.ceil(content.length / 200) + "分钟",
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    };

    this.documents.push(doc);
    this.saveKnowledgeBase();

    // 重新构建向量存储
    await this.buildVectorStore();

    return doc.id;
  }

  // 获取检索器
  getRetriever(k = 4) {
    return this.vectorStore.asRetriever({ k });
  }

  // 相似性搜索
  async similaritySearch(query, k = 4) {
    return await this.vectorStore.similaritySearch(query, k);
  }

  // 获取统计信息
  getStats() {
    const categories = {};
    const difficulties = {};

    for (const doc of this.documents) {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
      const difficulty = doc.metadata?.difficulty || "未知";
      difficulties[difficulty] = (difficulties[difficulty] || 0) + 1;
    }

    return {
      totalDocuments: this.documents.length,
      categories,
      difficulties,
    };
  }
}

// LangChain 智能代理
class LangChainAgenticRAG {
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-1.5-flash",
      temperature: 0.1,
    });
    this.conversationHistory = [];
    this.setupAgent();
  }

  // 设置智能代理
  async setupAgent() {
    console.log("🤖 正在设置 LangChain 智能代理...");

    // 创建工具
    this.tools = [
      new DynamicTool({
        name: "knowledge_search",
        description: "搜索知识库中的相关文档。输入应该是搜索查询字符串。",
        func: async (query) => {
          const docs = await this.kb.similaritySearch(query, 3);
          return docs
            .map(
              (doc) =>
                `标题: ${doc.metadata.title}\n内容: ${doc.pageContent}\n分类: ${doc.metadata.category}`
            )
            .join("\n\n");
        },
      }),
      new DynamicTool({
        name: "add_knowledge",
        description:
          "向知识库添加新文档。输入格式：标题|内容|分类|标签(用逗号分隔)",
        func: async (input) => {
          const parts = input.split("|");
          if (parts.length < 2) {
            return "输入格式错误。请使用：标题|内容|分类|标签";
          }
          const [title, content, category = "通用", tagsStr = ""] = parts;
          const tags = tagsStr
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);

          const docId = await this.kb.addDocument(
            title,
            content,
            category,
            tags
          );
          return `文档已添加到知识库，ID: ${docId}`;
        },
      }),
      new DynamicTool({
        name: "get_stats",
        description: "获取知识库统计信息",
        func: async () => {
          const stats = this.kb.getStats();
          return `知识库统计：
总文档数: ${stats.totalDocuments}
分类分布: ${JSON.stringify(stats.categories, null, 2)}
难度分布: ${JSON.stringify(stats.difficulties, null, 2)}`;
        },
      }),
    ];

    // 创建 ReAct 代理
    try {
      const prompt = await pull("hwchase17/react");
      this.agent = await createReactAgent({
        llm: this.llm,
        tools: this.tools,
        prompt,
      });

      this.agentExecutor = new AgentExecutor({
        agent: this.agent,
        tools: this.tools,
        verbose: false,
        maxIterations: 3,
        returnIntermediateSteps: false,
        handleParsingErrors: true,
      });

      console.log("✅ LangChain 智能代理设置完成");
    } catch (error) {
      console.log("⚠️  代理设置失败，使用简化版本");
      this.setupSimpleChain();
    }
  }

  // 设置简化链
  async setupSimpleChain() {
    const prompt = PromptTemplate.fromTemplate(`
你是一个智能的RAG助手，可以访问知识库来回答问题。

可用工具：
1. knowledge_search: 搜索知识库
2. add_knowledge: 添加新知识
3. get_stats: 获取统计信息

对话历史：
{history}

用户问题：{question}

请基于知识库信息提供准确的回答。如果需要搜索知识库，请先搜索相关信息再回答。
`);

    this.chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  // 处理查询
  async processQuery(query) {
    const startTime = Date.now();

    try {
      console.log("🔍 正在分析查询并执行...");

      let response;
      let method = "Agent";

      if (this.agentExecutor) {
        try {
          // 使用智能代理
          const result = await this.agentExecutor.invoke({
            input: query,
          });

          if (
            result &&
            result.output &&
            !result.output.includes("Agent stopped")
          ) {
            response = result.output;
          } else {
            throw new Error("代理达到最大迭代次数");
          }
        } catch (agentError) {
          console.log("⚠️  代理查询失败，回退到直接RAG查询");
          const ragResult = await this.directRAGQuery(query);
          response = ragResult.response;
          method = "DirectRAG";
        }
      } else {
        // 使用简化链
        const history = this.conversationHistory
          .slice(-4)
          .map((item) => `${item.role}: ${item.content}`)
          .join("\n");

        response = await this.chain.invoke({
          question: query,
          history: history,
        });
      }

      // 保存对话历史
      this.conversationHistory.push(
        { role: "用户", content: query },
        { role: "助手", content: response }
      );

      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(1);

      return {
        response,
        responseTime: responseTime + "s",
        method,
      };
    } catch (error) {
      throw new Error(`查询处理失败: ${error.message}`);
    }
  }

  // 直接RAG查询（不使用代理）
  async directRAGQuery(query) {
    console.log("🔍 执行直接RAG查询...");

    // 检索相关文档
    const docs = await this.kb.similaritySearch(query, 3);

    if (docs.length === 0) {
      return {
        response: "抱歉，我在知识库中没有找到相关信息。",
        retrievedDocs: 0,
        responseTime: "0.1s",
      };
    }

    // 构建上下文
    const context = docs
      .map(
        (doc, index) =>
          `文档${index + 1}: ${doc.metadata.title}\n${doc.pageContent}`
      )
      .join("\n\n");

    // 生成回答
    const prompt = `基于以下检索到的文档信息回答用户问题：

检索到的文档：
${context}

用户问题：${query}

请提供准确、详细的回答，并在适当时引用文档信息。`;

    const startTime = Date.now();
    const response = await this.llm.invoke(prompt);
    const endTime = Date.now();

    return {
      response: response.content,
      retrievedDocs: docs.length,
      responseTime: ((endTime - startTime) / 1000).toFixed(1) + "s",
    };
  }
}

// LangChain Agentic RAG 应用
class LangChainAgenticRAGApp {
  constructor() {
    this.kb = null;
    this.agent = null;
  }

  async initialize() {
    console.log("🚀 初始化 LangChain Agentic RAG 系统...");
    this.kb = new LangChainKnowledgeBase();
    await this.kb.loadKnowledgeBase();
    this.agent = new LangChainAgenticRAG(this.kb);
  }

  // 显示帮助信息
  showHelp() {
    console.log("\n📖 LangChain Agentic RAG 系统命令:");
    console.log("  help         - 显示帮助信息");
    console.log("  add          - 添加文档到知识库");
    console.log("  search <查询> - 直接搜索知识库");
    console.log("  rag <查询>   - 直接RAG查询（不使用代理）");
    console.log("  stats        - 显示知识库统计");
    console.log("  clear        - 清空对话历史");
    console.log("  exit/quit    - 退出系统");
    console.log("  直接输入问题 - 智能代理问答");
    console.log("\n🔧 技术特性:");
    console.log("  - LangChain框架集成");
    console.log("  - Google Gemini嵌入模型");
    console.log("  - ReAct智能代理");
    console.log("  - 向量相似性搜索");
    console.log("  - 动态工具调用");
  }

  // 添加文档
  async addDocument() {
    return new Promise((resolve) => {
      rl.question("📝 文档标题: ", (title) => {
        rl.question("📄 文档内容: ", (content) => {
          rl.question("🏷️  分类: ", (category) => {
            rl.question("🔖 标签 (用逗号分隔): ", async (tagsInput) => {
              const tags = tagsInput
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag);

              const docId = await this.kb.addDocument(
                title,
                content,
                category || "通用",
                tags
              );
              console.log(`✅ 文档已添加并重新索引，ID: ${docId}`);
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
    console.log("\n📊 LangChain 知识库统计:");
    console.log(`  总文档数: ${stats.totalDocuments}`);
    console.log("  分类分布:");
    for (const [category, count] of Object.entries(stats.categories)) {
      console.log(`    ${category}: ${count}`);
    }
    console.log("  难度分布:");
    for (const [difficulty, count] of Object.entries(stats.difficulties)) {
      console.log(`    ${difficulty}: ${count}`);
    }
  }

  // 主循环
  async run() {
    await this.initialize();

    console.log("🚀 欢迎使用 LangChain Agentic RAG 系统！");
    console.log("💡 基于 LangChain 框架的智能代理RAG系统");
    console.log("🔗 集成 Google Gemini 和向量检索技术");
    console.log("📚 输入 'help' 查看所有命令");
    console.log("=".repeat(70));

    const askQuestion = async () => {
      rl.question("\n🤖 LangChainRAG> ", async (input) => {
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
                const docs = await this.kb.similaritySearch(query, 3);
                console.log(`\n📋 向量搜索结果:`);
                if (docs.length > 0) {
                  docs.forEach((doc, index) => {
                    console.log(`${index + 1}. **${doc.metadata.title}**`);
                    console.log(`   ${doc.pageContent.substring(0, 150)}...`);
                    console.log(`   分类: ${doc.metadata.category}`);
                  });
                } else {
                  console.log("未找到相关文档");
                }
              } else if (command.startsWith("rag ")) {
                const query = command.substring(4);
                const result = await this.agent.directRAGQuery(query);
                console.log(
                  `\n🤖 RAG回答 (${result.responseTime}, ${result.retrievedDocs}个文档):`
                );
                console.log(result.response);
              } else {
                // 智能代理问答
                const result = await this.agent.processQuery(command);
                console.log(
                  `\n🤖 代理回答 (${result.responseTime}, ${result.method}):`
                );
                console.log(result.response);
              }
              console.log("-".repeat(70));
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
  console.log("\n\n👋 LangChain 程序已退出！");
  rl.close();
  process.exit(0);
});

// 启动应用
const app = new LangChainAgenticRAGApp();
app.run().catch(console.error);
