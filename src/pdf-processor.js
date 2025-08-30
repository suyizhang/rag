import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

dotenv.config();

/**
 * PDF 处理器类
 * 负责加载、解析和处理 PDF 文档
 */
class PDFProcessor {
  constructor() {
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
  }

  /**
   * 使用原生 pdf-parse 解析 PDF
   */
  async parsePDFWithNative(filePath) {
    try {
      console.log(`📄 使用原生解析器处理: ${filePath}`);

      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      return {
        text: data.text,
        pages: data.numpages,
        info: data.info,
        metadata: {
          source: filePath,
          pages: data.numpages,
          title: data.info?.Title || path.basename(filePath),
          author: data.info?.Author || "Unknown",
          creationDate: data.info?.CreationDate || new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`❌ 原生解析失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 使用 LangChain PDFLoader 解析 PDF
   */
  async parsePDFWithLangChain(filePath) {
    try {
      console.log(`📄 使用 LangChain 解析器处理: ${filePath}`);

      const loader = new PDFLoader(filePath);
      const docs = await loader.load();

      return {
        documents: docs,
        text: docs.map((doc) => doc.pageContent).join("\n"),
        pages: docs.length,
        metadata: {
          source: filePath,
          pages: docs.length,
          title: path.basename(filePath),
          documents: docs.length,
        },
      };
    } catch (error) {
      console.error(`❌ LangChain 解析失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 智能选择解析方法
   */
  async parsePDF(filePath, method = "auto") {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    let result = null;

    if (method === "auto" || method === "langchain") {
      try {
        result = await this.parsePDFWithLangChain(filePath);
        console.log(`✅ LangChain 解析成功: ${result.pages} 页`);
      } catch (error) {
        if (method === "langchain") throw error;
        console.log(`⚠️  LangChain 解析失败，尝试原生解析...`);
      }
    }

    if (!result && (method === "auto" || method === "native")) {
      result = await this.parsePDFWithNative(filePath);
      console.log(`✅ 原生解析成功: ${result.pages} 页`);
    }

    if (!result) {
      throw new Error("所有解析方法都失败了");
    }

    return result;
  }

  /**
   * 将 PDF 文本分割成块
   */
  async splitText(text, metadata = {}) {
    console.log(`🔄 正在分割文本 (${text.length} 字符)...`);

    const chunks = await this.textSplitter.splitText(text);

    const documents = chunks.map((chunk, index) => ({
      pageContent: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        chunkSize: chunk.length,
      },
    }));

    console.log(`✅ 文本分割完成: ${documents.length} 个块`);
    return documents;
  }

  /**
   * 创建向量存储
   */
  async createVectorStore(documents) {
    console.log(`🔄 正在创建向量存储 (${documents.length} 个文档)...`);

    this.vectorStore = await MemoryVectorStore.fromDocuments(
      documents,
      this.embeddings
    );

    console.log(`✅ 向量存储创建完成`);
    return this.vectorStore;
  }

  /**
   * 添加 PDF 到知识库
   */
  async addPDFToKnowledgeBase(filePath, method = "auto") {
    try {
      console.log(`\n📚 开始处理 PDF: ${filePath}`);

      // 1. 解析 PDF
      const pdfData = await this.parsePDF(filePath, method);

      // 2. 分割文本
      const documents = await this.splitText(pdfData.text, pdfData.metadata);

      // 3. 添加到文档集合
      this.documents.push(...documents);

      // 4. 更新向量存储
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(documents);
      } else {
        await this.createVectorStore(this.documents);
      }

      console.log(
        `✅ PDF 处理完成: ${documents.length} 个文档块已添加到知识库`
      );

      return {
        success: true,
        documentsAdded: documents.length,
        totalDocuments: this.documents.length,
        metadata: pdfData.metadata,
      };
    } catch (error) {
      console.error(`❌ PDF 处理失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量处理 PDF 文件
   */
  async addPDFsFromDirectory(directoryPath, method = "auto") {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录不存在: ${directoryPath}`);
    }

    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => path.join(directoryPath, file));

    if (files.length === 0) {
      console.log(`⚠️  目录中没有找到 PDF 文件: ${directoryPath}`);
      return [];
    }

    console.log(`📁 找到 ${files.length} 个 PDF 文件`);

    const results = [];
    for (const filePath of files) {
      const result = await this.addPDFToKnowledgeBase(filePath, method);
      results.push({
        file: path.basename(filePath),
        ...result,
      });
    }

    return results;
  }

  /**
   * 搜索知识库
   */
  async searchKnowledgeBase(query, k = 5) {
    if (!this.vectorStore) {
      throw new Error("向量存储未初始化，请先添加文档");
    }

    console.log(`🔍 搜索查询: "${query}"`);

    const results = await this.vectorStore.similaritySearch(query, k);

    console.log(`📋 找到 ${results.length} 个相关文档`);

    return results.map((doc, index) => ({
      rank: index + 1,
      content: doc.pageContent,
      metadata: doc.metadata,
      relevanceScore: doc.score || 0,
    }));
  }

  /**
   * 获取知识库统计信息
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
    };
  }

  /**
   * 保存知识库到文件
   */
  async saveKnowledgeBase(filePath) {
    const data = {
      documents: this.documents,
      stats: this.getStats(),
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 知识库已保存到: ${filePath}`);
  }

  /**
   * 从文件加载知识库
   */
  async loadKnowledgeBase(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`知识库文件不存在: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    this.documents = data.documents || [];

    if (this.documents.length > 0) {
      await this.createVectorStore(this.documents);
    }

    console.log(`📂 知识库已加载: ${this.documents.length} 个文档`);
    return data.stats;
  }
}

export default PDFProcessor;
