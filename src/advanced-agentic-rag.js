import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from "readline";
import fs from "fs";
import crypto from "crypto";

// 加载环境变量
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 向量化工具类
class VectorStore {
  constructor() {
    this.embeddings = new Map();
    this.loadEmbeddings();
  }

  // 简单的文本向量化（使用字符频率）
  async vectorize(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCount = {};
    const totalWords = words.length;

    // 计算词频
    for (const word of words) {
      if (word.length > 2) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }

    // 转换为向量（TF-IDF简化版）
    const vector = {};
    for (const [word, count] of Object.entries(wordCount)) {
      vector[word] = count / totalWords;
    }

    return vector;
  }

  // 计算余弦相似度
  cosineSimilarity(vec1, vec2) {
    const words1 = new Set(Object.keys(vec1));
    const words2 = new Set(Object.keys(vec2));
    const commonWords = new Set([...words1].filter((x) => words2.has(x)));

    if (commonWords.size === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const word of commonWords) {
      dotProduct += vec1[word] * vec2[word];
    }

    for (const word of words1) {
      norm1 += vec1[word] * vec1[word];
    }

    for (const word of words2) {
      norm2 += vec2[word] * vec2[word];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 保存向量
  async saveEmbedding(docId, text) {
    const vector = await this.vectorize(text);
    this.embeddings.set(docId, vector);
    this.saveEmbeddings();
  }

  // 向量检索
  async vectorSearch(query, docIds, topK = 3) {
    const queryVector = await this.vectorize(query);
    const similarities = [];

    for (const docId of docIds) {
      if (this.embeddings.has(docId)) {
        const docVector = this.embeddings.get(docId);
        const similarity = this.cosineSimilarity(queryVector, docVector);
        similarities.push({ docId, similarity });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 加载向量数据
  loadEmbeddings() {
    try {
      if (fs.existsSync("embeddings.json")) {
        const data = fs.readFileSync("embeddings.json", "utf8");
        const embeddingsArray = JSON.parse(data);
        this.embeddings = new Map(embeddingsArray);
      }
    } catch (error) {
      console.log("向量数据加载失败");
    }
  }

  // 保存向量数据
  saveEmbeddings() {
    try {
      const embeddingsArray = Array.from(this.embeddings.entries());
      fs.writeFileSync(
        "embeddings.json",
        JSON.stringify(embeddingsArray, null, 2)
      );
    } catch (error) {
      console.log("向量数据保存失败");
    }
  }
}

// 高级知识库管理器
class AdvancedKnowledgeBase {
  constructor() {
    this.documents = [];
    this.vectorStore = new VectorStore();
    this.loadKnowledgeBase();
  }

  // 加载知识库
  loadKnowledgeBase() {
    const knowledgeFile = "advanced-knowledge-base.json";
    try {
      if (fs.existsSync(knowledgeFile)) {
        const data = fs.readFileSync(knowledgeFile, "utf8");
        this.documents = JSON.parse(data);
        console.log(`📚 已加载 ${this.documents.length} 个文档到高级知识库`);
      } else {
        this.createDefaultKnowledgeBase();
      }
    } catch (error) {
      console.log("⚠️  知识库加载失败，创建默认知识库");
      this.createDefaultKnowledgeBase();
    }
  }

  // 创建默认知识库
  async createDefaultKnowledgeBase() {
    const defaultDocs = [
      {
        id: "adv_doc1",
        title: "Agentic RAG系统架构",
        content:
          "Agentic RAG结合了智能代理和检索增强生成技术。代理具有自主决策能力，可以根据查询类型选择最佳的检索和生成策略。系统包含意图分析、动态检索、多步推理和自适应生成等核心组件。",
        category: "AI架构",
        tags: ["Agentic", "RAG", "智能代理", "系统架构"],
        metadata: {
          author: "AI System",
          difficulty: "高级",
          readTime: "5分钟",
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: "adv_doc2",
        title: "向量检索技术",
        content:
          "向量检索是现代信息检索的核心技术。通过将文本转换为高维向量，可以计算语义相似度。常用的方法包括TF-IDF、Word2Vec、BERT嵌入等。向量数据库如Pinecone、Weaviate提供了高效的向量存储和检索能力。",
        category: "检索技术",
        tags: ["向量检索", "嵌入", "语义搜索", "向量数据库"],
        metadata: {
          author: "AI System",
          difficulty: "中级",
          readTime: "3分钟",
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: "adv_doc3",
        title: "大语言模型应用",
        content:
          "大语言模型如GPT、Claude、Gemini等在各个领域都有广泛应用。它们可以进行文本生成、问答、摘要、翻译等任务。结合RAG技术，可以显著提高模型回答的准确性和时效性，减少幻觉问题。",
        category: "AI应用",
        tags: ["大语言模型", "GPT", "Claude", "Gemini", "应用"],
        metadata: {
          author: "AI System",
          difficulty: "中级",
          readTime: "4分钟",
        },
        timestamp: new Date().toISOString(),
      },
    ];

    this.documents = defaultDocs;

    // 为默认文档生成向量
    for (const doc of defaultDocs) {
      await this.vectorStore.saveEmbedding(
        doc.id,
        doc.title + " " + doc.content
      );
    }

    this.saveKnowledgeBase();
  }

  // 保存知识库
  saveKnowledgeBase() {
    try {
      fs.writeFileSync(
        "advanced-knowledge-base.json",
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
      id: `adv_doc${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      title,
      content,
      category,
      tags,
      metadata: {
        author: "用户",
        difficulty: "未知",
        readTime: "未知",
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    };

    this.documents.push(doc);
    await this.vectorStore.saveEmbedding(doc.id, title + " " + content);
    this.saveKnowledgeBase();
    return doc.id;
  }

  // 混合检索（关键词 + 向量）
  async hybridRetrieval(query, maxResults = 5) {
    // 1. 关键词检索
    const keywordResults = this.keywordSearch(query, maxResults * 2);

    // 2. 向量检索
    const docIds = this.documents.map((doc) => doc.id);
    const vectorResults = await this.vectorStore.vectorSearch(
      query,
      docIds,
      maxResults * 2
    );

    // 3. 结果融合
    const combinedResults = new Map();

    // 添加关键词检索结果
    keywordResults.forEach((doc) => {
      combinedResults.set(doc.id, {
        ...doc,
        keywordScore: doc.relevanceScore || 0,
        vectorScore: 0,
        combinedScore: doc.relevanceScore || 0,
      });
    });

    // 添加向量检索结果
    vectorResults.forEach((result) => {
      const doc = this.documents.find((d) => d.id === result.docId);
      if (doc) {
        if (combinedResults.has(doc.id)) {
          const existing = combinedResults.get(doc.id);
          existing.vectorScore = result.similarity;
          existing.combinedScore =
            existing.keywordScore * 0.6 + result.similarity * 0.4;
        } else {
          combinedResults.set(doc.id, {
            ...doc,
            keywordScore: 0,
            vectorScore: result.similarity,
            combinedScore: result.similarity * 0.4,
          });
        }
      }
    });

    // 排序并返回结果
    return Array.from(combinedResults.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, maxResults);
  }

  // 关键词搜索
  keywordSearch(query, maxResults = 5) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const doc of this.documents) {
      let score = 0;

      // 标题匹配
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // 内容匹配
      if (doc.content.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      // 标签匹配
      for (const tag of doc.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 2;
        }
      }

      // 分词匹配
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 2) {
          const titleMatches = (
            doc.title.toLowerCase().match(new RegExp(word, "g")) || []
          ).length;
          const contentMatches = (
            doc.content.toLowerCase().match(new RegExp(word, "g")) || []
          ).length;
          score += titleMatches * 2 + contentMatches * 1;
        }
      }

      if (score > 0) {
        results.push({ ...doc, relevanceScore: score });
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  // 获取文档详情
  getDocument(docId) {
    return this.documents.find((doc) => doc.id === docId);
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
      vectorizedDocs: this.vectorStore.embeddings.size,
    };
  }
}

// 高级智能代理
class AdvancedAgenticAgent {
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
    this.model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 3000,
      },
    });
    this.conversationHistory = [];
    this.userProfile = {
      interests: [],
      expertiseLevel: "中级",
      preferredStyle: "详细",
    };
  }

  // 高级意图分析
  async analyzeIntent(query) {
    const intentPrompt = `
作为一个高级意图分析器，分析用户查询并返回JSON格式：
{
  "primaryIntent": "question|search|add_knowledge|analysis|comparison|explanation",
  "secondaryIntents": ["intent1", "intent2"],
  "entities": ["实体1", "实体2"],
  "keywords": ["关键词1", "关键词2"],
  "complexity": "simple|medium|complex|expert",
  "domain": "技术|科学|商业|教育|其他",
  "needsRetrieval": true/false,
  "retrievalStrategy": "keyword|vector|hybrid",
  "responseStyle": "brief|detailed|technical|conversational"
}

用户查询: "${query}"
对话历史: ${this.conversationHistory
      .slice(-2)
      .map((h) => `${h.role}: ${h.content}`)
      .join("; ")}
`;

    try {
      const result = await this.model.generateContent(intentPrompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log("高级意图分析失败，使用默认策略");
    }

    // 默认意图分析
    return {
      primaryIntent: "question",
      secondaryIntents: [],
      entities: [],
      keywords: query.split(/\s+/).filter((word) => word.length > 2),
      complexity: "medium",
      domain: "其他",
      needsRetrieval: true,
      retrievalStrategy: "hybrid",
      responseStyle: "detailed",
    };
  }

  // 执行检索策略
  async executeRetrievalStrategy(query, intent) {
    console.log(`🔍 执行${intent.retrievalStrategy}检索策略...`);

    let retrievedDocs = [];

    switch (intent.retrievalStrategy) {
      case "keyword":
        retrievedDocs = this.kb.keywordSearch(query, 5);
        break;
      case "vector":
        const docIds = this.kb.documents.map((doc) => doc.id);
        const vectorResults = await this.kb.vectorStore.vectorSearch(
          query,
          docIds,
          5
        );
        retrievedDocs = vectorResults.map((result) => {
          const doc = this.kb.getDocument(result.docId);
          return { ...doc, vectorScore: result.similarity };
        });
        break;
      case "hybrid":
      default:
        retrievedDocs = await this.kb.hybridRetrieval(query, 5);
        break;
    }

    if (retrievedDocs.length > 0) {
      console.log(`📄 找到 ${retrievedDocs.length} 个相关文档:`);
      retrievedDocs.forEach((doc, index) => {
        const scoreInfo = doc.combinedScore
          ? `综合评分: ${doc.combinedScore.toFixed(3)}`
          : doc.vectorScore
          ? `向量相似度: ${doc.vectorScore.toFixed(3)}`
          : `关键词评分: ${doc.relevanceScore?.toFixed(1) || "N/A"}`;
        console.log(`  ${index + 1}. ${doc.title} (${scoreInfo})`);
      });
    } else {
      console.log("📄 未找到相关文档");
    }

    return retrievedDocs;
  }

  // 生成高级回答
  async generateAdvancedResponse(query, retrievedDocs, intent) {
    console.log("🤖 正在生成高级回答...");

    let context = "";
    if (retrievedDocs.length > 0) {
      context =
        "检索到的相关文档:\n" +
        retrievedDocs
          .map((doc, index) => {
            const metadata = doc.metadata
              ? `\n元数据: 难度=${doc.metadata.difficulty}, 阅读时间=${doc.metadata.readTime}`
              : "";
            return `文档${index + 1}: ${doc.title}\n内容: ${
              doc.content
            }${metadata}`;
          })
          .join("\n\n");
    }

    // 构建对话历史上下文
    let historyContext = "";
    if (this.conversationHistory.length > 0) {
      historyContext =
        "对话历史:\n" +
        this.conversationHistory
          .slice(-6)
          .map((item) => `${item.role}: ${item.content}`)
          .join("\n");
    }

    const styleInstructions = {
      brief: "请提供简洁明了的回答",
      detailed: "请提供详细全面的回答",
      technical: "请使用技术术语和专业表达",
      conversational: "请使用对话式的友好语调",
    };

    const prompt = `
你是一个高级的Agentic RAG助手，具有以下特殊能力：
1. 深度分析和推理
2. 多角度思考问题
3. 提供结构化回答
4. 承认知识边界
5. 个性化回答风格

用户意图分析:
- 主要意图: ${intent.primaryIntent}
- 复杂度: ${intent.complexity}
- 领域: ${intent.domain}
- 回答风格: ${intent.responseStyle}

${styleInstructions[intent.responseStyle] || "请提供合适的回答"}

${historyContext}

${context}

用户问题: ${query}

请基于上述信息提供高质量的回答。如果检索到的文档不足以完全回答问题，请：
1. 明确说明哪些部分可以基于检索结果回答
2. 哪些部分需要额外信息
3. 提供可能的后续查询建议

回答格式要求：
- 使用清晰的结构
- 重要信息用**粗体**标记
- 如有必要，提供编号列表
- 在回答末尾提供相关建议或延伸思考
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
      throw new Error(`生成高级回答失败: ${error.message}`);
    }
  }

  // 主要处理方法
  async process(query) {
    const startTime = Date.now();

    try {
      // 1. 高级意图分析
      const intent = await this.analyzeIntent(query);
      console.log(`🎯 意图分析:`);
      console.log(`   主要意图: ${intent.primaryIntent}`);
      console.log(`   复杂度: ${intent.complexity}`);
      console.log(`   检索策略: ${intent.retrievalStrategy}`);
      console.log(`   关键词: ${intent.keywords.join(", ")}`);

      // 2. 执行检索策略
      const retrievedDocs = await this.executeRetrievalStrategy(query, intent);

      // 3. 生成高级回答
      const response = await this.generateAdvancedResponse(
        query,
        retrievedDocs,
        intent
      );

      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(1);

      return {
        response,
        intent,
        retrievedDocs: retrievedDocs.length,
        responseTime: responseTime + "s",
        retrievalStrategy: intent.retrievalStrategy,
      };
    } catch (error) {
      throw error;
    }
  }
}

// 高级应用类
class AdvancedAgenticRAGApp {
  constructor() {
    this.kb = new AdvancedKnowledgeBase();
    this.agent = new AdvancedAgenticAgent(this.kb);
  }

  // 显示帮助信息
  showHelp() {
    console.log("\n📖 高级 Agentic RAG 系统命令:");
    console.log("  help         - 显示帮助信息");
    console.log("  add          - 添加文档到知识库");
    console.log("  search <查询> - 搜索文档");
    console.log("  stats        - 显示知识库统计");
    console.log("  clear        - 清空对话历史");
    console.log("  profile      - 查看/设置用户配置");
    console.log("  export       - 导出知识库");
    console.log("  exit/quit    - 退出系统");
    console.log("  直接输入问题 - 高级智能问答");
    console.log("\n🚀 特色功能:");
    console.log("  - 混合检索 (关键词 + 向量)");
    console.log("  - 智能意图分析");
    console.log("  - 个性化回答风格");
    console.log("  - 文档元数据管理");
  }

  // 添加文档
  async addDocument() {
    return new Promise((resolve) => {
      rl.question("📝 文档标题: ", (title) => {
        rl.question("📄 文档内容: ", (content) => {
          rl.question("🏷️  分类: ", (category) => {
            rl.question("🔖 标签 (用逗号分隔): ", (tagsInput) => {
              rl.question("👤 作者: ", (author) => {
                rl.question(
                  "📊 难度 (简单/中级/高级): ",
                  async (difficulty) => {
                    const tags = tagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter((tag) => tag);
                    const metadata = {
                      author: author || "未知",
                      difficulty: difficulty || "未知",
                      readTime: Math.ceil(content.length / 200) + "分钟",
                    };

                    const docId = await this.kb.addDocument(
                      title,
                      content,
                      category || "通用",
                      tags,
                      metadata
                    );
                    console.log(`✅ 文档已添加，ID: ${docId}`);
                    resolve();
                  }
                );
              });
            });
          });
        });
      });
    });
  }

  // 显示统计信息
  showStats() {
    const stats = this.kb.getStats();
    console.log("\n📊 高级知识库统计:");
    console.log(`  总文档数: ${stats.totalDocuments}`);
    console.log(`  向量化文档: ${stats.vectorizedDocs}`);
    console.log("  分类分布:");
    for (const [category, count] of Object.entries(stats.categories)) {
      console.log(`    ${category}: ${count}`);
    }
    console.log("  难度分布:");
    for (const [difficulty, count] of Object.entries(stats.difficulties)) {
      console.log(`    ${difficulty}: ${count}`);
    }
  }

  // 导出知识库
  exportKnowledgeBase() {
    const exportData = {
      documents: this.kb.documents,
      exportTime: new Date().toISOString(),
      version: "1.0",
    };

    const filename = `knowledge-export-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    console.log(`📤 知识库已导出到: ${filename}`);
  }

  // 主循环
  async run() {
    console.log("🚀 欢迎使用高级 Agentic RAG 系统！");
    console.log("💡 这是一个具有智能代理能力的高级检索生成系统");
    console.log("🔬 支持混合检索、意图分析和个性化回答");
    console.log("📚 输入 'help' 查看所有命令");
    console.log("=".repeat(70));

    const askQuestion = async () => {
      rl.question("\n🤖 AdvancedRAG> ", async (input) => {
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

            case "export":
              this.exportKnowledgeBase();
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
                const docs = await this.kb.hybridRetrieval(query, 5);
                console.log(`\n📋 混合检索结果:`);
                if (docs.length > 0) {
                  docs.forEach((doc, index) => {
                    console.log(`${index + 1}. **${doc.title}**`);
                    console.log(`   ${doc.content.substring(0, 100)}...`);
                    console.log(
                      `   分类: ${doc.category} | 综合评分: ${
                        doc.combinedScore?.toFixed(3) || "N/A"
                      }`
                    );
                  });
                } else {
                  console.log("未找到相关文档");
                }
              } else {
                // 高级智能问答
                const result = await this.agent.process(command);
                console.log(
                  `\n🤖 回答 (${result.responseTime}, ${result.retrievalStrategy}检索, ${result.retrievedDocs}个文档):`
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
  console.log("\n\n👋 高级程序已退出！");
  rl.close();
  process.exit(0);
});

// 启动高级应用
const app = new AdvancedAgenticRAGApp();
app.run();
