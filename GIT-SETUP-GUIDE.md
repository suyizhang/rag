# 🔧 Git 设置和使用指南

## 📋 Git 仓库初始化

### 1. 初始化 Git 仓库
```bash
# 在项目根目录执行
git init
```

### 2. 添加远程仓库（可选）
```bash
# 如果你有 GitHub/GitLab 仓库
git remote add origin https://github.com/your-username/your-repo-name.git
```

### 3. 首次提交
```bash
# 添加所有文件（.gitignore 会自动过滤）
git add .

# 创建首次提交
git commit -m "🚀 初始化 Agentic RAG 项目

- 完整的 RAG 系统生态（5个版本）
- PDF 处理和向量化功能
- LangChain 集成
- Google Gemini API 集成
- 智能问答和文档管理
- 完整的文档和使用指南"

# 推送到远程仓库（如果有）
git push -u origin main
```

## 🔒 安全配置检查

### 确保敏感信息已被忽略
```bash
# 检查 .env 文件是否被忽略
git status

# 应该看不到 .env 文件在待提交列表中
# 如果看到了，说明 .gitignore 没有生效
```

### 验证 .gitignore 效果
```bash
# 查看被忽略的文件
git status --ignored

# 确认以下文件/目录被忽略：
# - .env
# - node_modules/
# - *.log
# - test-pdfs/
# - knowledge-base.json
```

## 📚 推荐的提交规范

### 提交消息格式
```bash
# 功能添加
git commit -m "✨ 添加新功能: PDF批量处理"

# 修复问题
git commit -m "🐛 修复: API连接超时问题"

# 文档更新
git commit -m "📝 更新: 使用指南和API文档"

# 性能优化
git commit -m "⚡ 优化: 向量检索性能提升"

# 重构代码
git commit -m "♻️ 重构: RAG查询处理逻辑"

# 配置更改
git commit -m "🔧 配置: 添加新的环境变量"
```

### 常用 Emoji 提交标识
- ✨ `:sparkles:` - 新功能
- 🐛 `:bug:` - 修复bug
- 📝 `:memo:` - 文档更新
- ⚡ `:zap:` - 性能优化
- ♻️ `:recycle:` - 重构代码
- 🔧 `:wrench:` - 配置更改
- 🚀 `:rocket:` - 部署相关
- 🔒 `:lock:` - 安全相关
- 📦 `:package:` - 依赖更新

## 🌿 分支管理策略

### 主要分支
```bash
# 主分支（生产环境）
main

# 开发分支
git checkout -b develop

# 功能分支
git checkout -b feature/pdf-processing
git checkout -b feature/langchain-integration

# 修复分支
git checkout -b hotfix/api-timeout
```

### 分支工作流程
```bash
# 1. 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/new-feature

# 2. 开发和提交
git add .
git commit -m "✨ 添加新功能"

# 3. 推送分支
git push origin feature/new-feature

# 4. 合并到 main（通过 PR/MR 或直接合并）
git checkout main
git merge feature/new-feature
git push origin main

# 5. 删除功能分支
git branch -d feature/new-feature
git push origin --delete feature/new-feature
```

## 📋 项目文件结构（Git 视角）

### 会被提交的文件
```
rag/
├── src/                    # 源代码
│   ├── *.js               # 所有 JavaScript 文件
├── *.md                   # 文档文件
├── package.json           # 项目配置
├── .gitignore            # Git 忽略规则
└── README.md             # 项目说明
```

### 会被忽略的文件
```
rag/
├── .env                  # 环境变量（敏感信息）
├── node_modules/         # 依赖包
├── *.log                 # 日志文件
├── test-pdfs/           # 测试文件
├── knowledge-base.json   # 知识库数据
└── .DS_Store            # 系统文件
```

## 🔍 常用 Git 命令

### 日常操作
```bash
# 查看状态
git status

# 查看差异
git diff

# 查看提交历史
git log --oneline

# 撤销更改
git checkout -- filename
git reset HEAD filename

# 查看分支
git branch -a

# 切换分支
git checkout branch-name
```

### 高级操作
```bash
# 交互式添加
git add -i

# 部分提交
git add -p

# 修改最后一次提交
git commit --amend

# 查看文件历史
git log -p filename

# 找回删除的文件
git checkout HEAD~1 -- filename
```

## 🚨 安全提醒

### ⚠️ 绝对不要提交的内容
- ❌ API 密钥 (GEMINI_API_KEY)
- ❌ 密码和认证信息
- ❌ 个人敏感文档
- ❌ 大型二进制文件
- ❌ 临时和缓存文件

### ✅ 应该提交的内容
- ✅ 源代码文件
- ✅ 配置模板（不含敏感信息）
- ✅ 文档和说明
- ✅ 项目依赖配置
- ✅ 测试文件

## 🔧 Git 配置优化

### 全局配置
```bash
# 设置用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 设置默认编辑器
git config --global core.editor "code --wait"

# 设置默认分支名
git config --global init.defaultBranch main

# 启用颜色输出
git config --global color.ui auto
```

### 项目特定配置
```bash
# 在项目目录中设置
git config user.name "Project Specific Name"
git config user.email "project@example.com"
```

## 📊 项目维护

### 定期清理
```bash
# 清理未跟踪的文件
git clean -fd

# 压缩 Git 历史
git gc --aggressive

# 查看仓库大小
git count-objects -vH
```

### 备份策略
```bash
# 创建备份分支
git checkout -b backup/$(date +%Y%m%d)

# 推送所有分支
git push origin --all

# 推送所有标签
git push origin --tags
```

## 🎯 最佳实践

1. **频繁提交** - 小步快跑，经常提交
2. **清晰消息** - 提交消息要描述性强
3. **分支隔离** - 不同功能使用不同分支
4. **代码审查** - 重要更改通过 PR/MR
5. **定期同步** - 经常从远程拉取更新
6. **备份重要** - 重要节点创建标签

现在你的 Agentic RAG 项目已经配置好了完整的 Git 管理！🎉