import dotenv from "dotenv";
import readline from "readline";
import PDFProcessor from "./pdf-processor.js";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * PDF 处理命令行界面
 */
class PDFCommandLineInterface {
  constructor() {
    this.processor = new PDFProcessor();
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
🔄 PDF 知识库处理工具
📚 支持 PDF 文档解析、向量化和搜索
💡 输入 'help' 查看所有命令
======================================================================
`);
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
📖 PDF 处理工具命令:
  help                    - 显示帮助信息
  add <文件路径>          - 添加单个 PDF 文件
  adddir <目录路径>       - 批量添加目录中的所有 PDF
  search <查询>           - 搜索知识库
  stats                   - 显示知识库统计
  save <文件路径>         - 保存知识库到文件
  load <文件路径>         - 从文件加载知识库
  list                    - 列出已加载的文档
  clear                   - 清空知识库
  test                    - 测试 PDF 解析功能
  exit/quit               - 退出程序

📝 使用示例:
  add ./documents/sample.pdf
  adddir ./documents
  search "人工智能的应用"
  save ./knowledge-base.json
`);
  }

  /**
   * 处理用户输入
   */
  async processCommand(input) {
    const parts = input.trim().split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    try {
      switch (command) {
        case "help":
          this.showHelp();
          break;

        case "add":
          if (!args) {
            console.log("❌ 请提供 PDF 文件路径");
            break;
          }
          await this.addPDF(args);
          break;

        case "adddir":
          if (!args) {
            console.log("❌ 请提供目录路径");
            break;
          }
          await this.addPDFDirectory(args);
          break;

        case "search":
          if (!args) {
            console.log("❌ 请提供搜索查询");
            break;
          }
          await this.searchKnowledgeBase(args);
          break;

        case "stats":
          this.showStats();
          break;

        case "save":
          if (!args) {
            console.log("❌ 请提供保存文件路径");
            break;
          }
          await this.saveKnowledgeBase(args);
          break;

        case "load":
          if (!args) {
            console.log("❌ 请提供加载文件路径");
            break;
          }
          await this.loadKnowledgeBase(args);
          break;

        case "list":
          this.listDocuments();
          break;

        case "clear":
          this.clearKnowledgeBase();
          break;

        case "test":
          await this.testPDFParsing();
          break;

        case "exit":
        case "quit":
          console.log("👋 再见！");
          this.rl.close();
          process.exit(0);
          break;

        default:
          console.log(`❌ 未知命令: ${command}`);
          console.log("💡 输入 'help' 查看可用命令");
      }
    } catch (error) {
      console.error(`❌ 命令执行失败: ${error.message}`);
    }
  }

  /**
   * 添加单个 PDF 文件
   */
  async addPDF(filePath) {
    console.log(`\n📄 添加 PDF 文件: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.log("❌ 文件不存在");
      return;
    }

    const result = await this.processor.addPDFToKnowledgeBase(filePath);

    if (result.success) {
      console.log(`✅ 成功添加 ${result.documentsAdded} 个文档块`);
      console.log(`📊 知识库总计: ${result.totalDocuments} 个文档块`);
      console.log(`📋 文档信息:`);
      console.log(`   - 标题: ${result.metadata.title}`);
      console.log(`   - 页数: ${result.metadata.pages}`);
      console.log(`   - 作者: ${result.metadata.author || "未知"}`);
    } else {
      console.log(`❌ 添加失败: ${result.error}`);
    }
  }

  /**
   * 批量添加目录中的 PDF 文件
   */
  async addPDFDirectory(directoryPath) {
    console.log(`\n📁 批量添加目录: ${directoryPath}`);

    if (!fs.existsSync(directoryPath)) {
      console.log("❌ 目录不存在");
      return;
    }

    const results = await this.processor.addPDFsFromDirectory(directoryPath);

    if (results.length === 0) {
      console.log("⚠️  目录中没有找到 PDF 文件");
      return;
    }

    let successCount = 0;
    let totalDocuments = 0;

    console.log(`\n📋 处理结果:`);
    results.forEach((result) => {
      if (result.success) {
        successCount++;
        totalDocuments += result.documentsAdded;
        console.log(
          `✅ ${result.file}: ${result.documentsAdded} 个文档块`
        );
      } else {
        console.log(`❌ ${result.file}: ${result.error}`);
      }
    });

    console.log(`\n📊 批量处理完成:`);
    console.log(`   - 成功处理: ${successCount}/${results.length} 个文件`);
    console.log(`   - 新增文档块: ${totalDocuments} 个`);
    console.log(`   - 知识库总计: ${this.processor.getStats().totalDocuments} 个文档块`);
  }

  /**
   * 搜索知识库
   */
  async searchKnowledgeBase(query) {
    console.log(`\n🔍 搜索查询: "${query}"`);

    try {
      const results = await this.processor.searchKnowledgeBase(query, 3);

      if (results.length === 0) {
        console.log("❌ 没有找到相关文档");
        return;
      }

      console.log(`\n📋 搜索结果 (${results.length} 个):`);
      results.forEach((result) => {
        console.log(`\n${result.rank}. 📄 ${result.metadata.title || "未知文档"}`);
        console.log(`   📍 来源: ${path.basename(result.metadata.source)}`);
        console.log(`   📝 内容预览: ${result.content.substring(0, 200)}...`);
        if (result.metadata.chunkIndex !== undefined) {
          console.log(`   🔢 文档块: ${result.metadata.chunkIndex + 1}`);
        }
      });
    } catch (error) {
      console.log(`❌ 搜索失败: ${error.message}`);
    }
  }

  /**
   * 显示统计信息
   */
  showStats() {
    const stats = this.processor.getStats();

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
   * 保存知识库
   */
  async saveKnowledgeBase(filePath) {
    console.log(`\n💾 保存知识库到: ${filePath}`);

    try {
      await this.processor.saveKnowledgeBase(filePath);
      console.log("✅ 知识库保存成功");
    } catch (error) {
      console.log(`❌ 保存失败: ${error.message}`);
    }
  }

  /**
   * 加载知识库
   */
  async loadKnowledgeBase(filePath) {
    console.log(`\n📂 从文件加载知识库: ${filePath}`);

    try {
      const stats = await this.processor.loadKnowledgeBase(filePath);
      console.log("✅ 知识库加载成功");
      console.log(`📊 加载了 ${stats.totalDocuments} 个文档块`);
    } catch (error) {
      console.log(`❌ 加载失败: ${error.message}`);
    }
  }

  /**
   * 列出文档
   */
  listDocuments() {
    const stats = this.processor.getStats();

    if (stats.totalDocuments === 0) {
      console.log("📋 知识库为空");
      return;
    }

    console.log(`\n📋 已加载的文档 (${stats.totalDocuments} 个文档块):`);

    const sourceGroups = {};
    this.processor.documents.forEach((doc) => {
      const source = doc.metadata.source;
      if (!sourceGroups[source]) {
        sourceGroups[source] = [];
      }
      sourceGroups[source].push(doc);
    });

    Object.entries(sourceGroups).forEach(([source, docs]) => {
      console.log(`\n📄 ${path.basename(source)}`);
      console.log(`   - 文档块数: ${docs.length}`);
      console.log(`   - 总字符数: ${docs.reduce((sum, doc) => sum + doc.pageContent.length, 0)}`);
      if (docs[0].metadata.pages) {
        console.log(`   - 页数: ${docs[0].metadata.pages}`);
      }
    });
  }

  /**
   * 清空知识库
   */
  clearKnowledgeBase() {
    this.processor.documents = [];
    this.processor.vectorStore = null;
    console.log("🗑️  知识库已清空");
  }

  /**
   * 测试 PDF 解析功能
   */
  async testPDFParsing() {
    console.log(`\n🧪 测试 PDF 解析功能`);

    // 创建测试目录
    const testDir = "./test-pdfs";
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
      console.log(`📁 创建测试目录: ${testDir}`);
    }

    // 检查是否有测试文件
    const testFiles = fs
      .readdirSync(testDir)
      .filter((file) => file.toLowerCase().endsWith(".pdf"));

    if (testFiles.length === 0) {
      console.log(`⚠️  测试目录 ${testDir} 中没有 PDF 文件`);
      console.log(`💡 请将一些 PDF 文件放入 ${testDir} 目录中进行测试`);
      return;
    }

    console.log(`📋 找到 ${testFiles.length} 个测试文件:`);
    testFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    // 测试第一个文件
    const testFile = path.join(testDir, testFiles[0]);
    console.log(`\n🔄 测试解析: ${testFiles[0]}`);

    try {
      const result = await this.processor.parsePDF(testFile);
      console.log(`✅ 解析成功:`);
      console.log(`   - 页数: ${result.pages}`);
      console.log(`   - 字符数: ${result.text.length}`);
      console.log(`   - 标题: ${result.metadata.title}`);
      console.log(`   - 内容预览: ${result.text.substring(0, 200)}...`);
    } catch (error) {
      console.log(`❌ 解析失败: ${error.message}`);
    }
  }

  /**
   * 启动命令行界面
   */
  async start() {
    this.showWelcome();

    const promptUser = () => {
      this.rl.question("🤖 PDFProcessor> ", async (input) => {
        if (input.trim()) {
          await this.processCommand(input);
        }
        promptUser();
      });
    };

    promptUser();
  }
}

// 启动应用
const app = new PDFCommandLineInterface();
app.start().catch(console.error);