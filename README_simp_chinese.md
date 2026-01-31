# Voices of the Court (VOTC)

An AI-powered companion for Crusader Kings III that helps you keep track of characters, plots, and storylines. Voices of the Court integrates Large Language Models into the game, letting you hold natural conversations with characters and dynamically influence the game state.

Documentation: https://docs.voicesofthecourt.app

[Steam page](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Join our Discord:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Trailer video 
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Gameplay video by DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Features

### 🎮 Configuration Interface
- **🤖 Multiple AI Models**: Support for OpenAI GPT models, Anthropic Claude, and local models
- **🧠 Character Memory**: Persistent memory system that tracks character relationships and history
- **📚 Context Management**: Adjustable context window and conversation history settings
- **🎯 Custom Prompts**: Personalized system prompts for different character types
- **🔄 Restore Defaults**: One-click restore to default prompts and settings

### 💬 Chat Interface
- **⚡ Real-time Conversations**: Natural dialogue with CK3 characters
- **👤 Character Profiles**: Detailed information about each character
- **🔖 Bookmark System**: Save and organize important conversations
- **📤 Export Functionality**: Export conversations to text files

### 📋 Summary Manager
- **🤖 Automatic Summaries**: AI-generated summaries of important events
- **🔖 Bookmark Integration**: Convert bookmarks to summaries
- **🔍 Search Functionality**: Find specific conversations and summaries
- **📤 Export Options**: Save summaries in various formats 配置界面详解

应用程序提供了六个主要配置页面，每个页面负责不同的功能设置：

### 1. 连接页面 (Connection)

连接页面用于配置与语言模型API的连接和游戏路径设置。

- **API连接配置**：
  - 选择文本生成API提供商（如OpenAI、Kobold等）
  - 配置API密钥、端点URL和模型名称

- **CK3用户文件夹路径**：
  - 设置存储用户数据的CK3文件夹路径
  - 默认路径：`用户文档/Paradox Interactive/Crusader Kings III`
  - 可以通过"选择文件夹"按钮浏览并选择正确的路径

### 2. 动作页面 (Actions)

动作页面用于配置游戏中可检测的动作和相应的AI响应。

- **启用动作**：
  - 总开关，控制是否启用动作检测功能
  - 启用AI叙述：在动作触发后生成AI叙述描述

- **API配置**：
  - 可以选择使用与连接页面相同的API设置
  - 或者为动作功能单独配置API

- **参数设置**：
  - 温度：控制AI响应的创造性（默认0.2，较低值使响应更确定）
  - 频率惩罚：减少重复内容的生成
  - 存在惩罚：鼓励谈论新话题
  - Top P：控制词汇选择的多样性

- **动作选择**：
  - 从列表中选择希望模组检测的动作类型
  - 每个动作都有描述和创建者信息
  - 可以通过"重新加载文件"按钮刷新动作列表
  - 通过"打开文件夹"按钮访问自定义动作脚本

### 3. 摘要页面 (Summarization)

摘要页面用于配置对话摘要功能的API设置。

- **API配置**：
  - 可以选择使用与连接页面相同的API设置
  - 或者为摘要功能单独配置API

- **参数设置**：
  - 温度：控制摘要的创造性（默认0.2）
  - 频率惩罚：减少摘要中的重复内容
  - 存在惩罚：鼓励包含新信息
  - Top P：控制词汇选择的多样性

摘要功能用于将长对话压缩为简短摘要，帮助保持对话上下文在token限制内，并在对话结束后生成摘要用于以后的对话。

### 4. 提示词页面 (Prompts)

提示词页面用于配置与AI交互的各种提示词和脚本。

- **主要提示词**：
  - 主提示词：控制AI如何响应的基本指令
  - 自言自语提示词：角色内心独白的生成规则
  - 摘要提示词：生成对话摘要的指令
  - 自言自语摘要提示词：角色内心独白的摘要规则
  - 记忆提示词：角色如何记忆和引用过去事件
  - 后缀提示词：在API请求前插入的最后一条系统消息，用于指导模型格式化响应
  - 叙述提示词：在动作触发后生成AI叙述描述的规则

- **脚本选择**：
  - 角色描述脚本：动态生成角色描述的脚本
  - 示例消息脚本：生成示例对话消息的脚本
  - 剧本：用于导入的特定剧本文件，包含世界观和角色设定

每个脚本都有标准版本和自定义版本，可以通过下拉菜单选择，并通过"打开文件夹"按钮访问脚本文件。

### 5. 设置页面 (Settings)

设置页面包含应用程序的各种行为和生成参数配置。

- **基本设置**：
  - 最大新token数：限制AI单次响应的最大长度
  - 最大记忆token数：限制角色记忆的最大长度
  - 流式消息：启用/禁用流式响应（实时显示AI生成过程）
  - 清理消息：尝试移除AI生成的不应有内容（如表情符号）
  - 角色顺序乱序：在多人对话中随机化角色发言顺序
  - 动态角色选择：使用LLM分析对话并选择下一个发言角色
  - 验证角色身份：验证生成的消息是否符合角色身份，防止llm生成别的角色的回复
  - 显示建议按钮：在聊天窗口中显示/隐藏推荐输入语句功能

- **插入深度设置**：
  - 摘要插入深度：控制摘要在对话历史中的插入位置
  - 记忆插入深度：控制角色记忆在对话历史中的插入位置
  - 角色描述插入深度：控制角色描述在对话历史中的插入位置

- **指令设置**：
  - 输入序列：标记用户输入的特殊标记
  - 输出序列：标记AI输出的特殊标记

- **文本生成参数**：
  - 温度：控制AI响应的创造性（默认0.8）
  - 频率惩罚：减少重复内容的生成
  - 存在惩罚：鼓励谈论新话题
  - Top P：控制词汇选择的多样性（默认0.9）

### 6. 系统页面 (System)

系统页面提供应用程序维护和社区链接功能。

- **更新功能**：
  - 显示当前应用程序版本
  - 检查更新按钮：手动检查是否有新版本
  - 启动时检查更新：自动在应用启动时检查更新

- **日志文件**：
  - 如果遇到错误/崩溃，可以查看日志文件
  - 打开日志文件夹按钮：直接访问日志文件

- **对话摘要管理**：
  - 清除摘要按钮：删除所有角色的先前对话摘要
  - 打开对话摘要文件夹按钮：访问存储的对话摘要


## 聊天界面功能

聊天界面是与游戏角色进行交互的主要界面，包含以下功能：

- **消息显示**：
  - 玩家消息和AI角色消息以不同样式显示
  - 支持Markdown格式的基本标记（粗体、斜体）
  - 叙述消息以特殊样式显示，提供场景描述

- **输入功能**：
  - 文本输入框：输入与角色的对话内容
  - Enter键发送消息
  - 支持多行输入

- **建议功能**（可配置显示/隐藏）：
  - 建议按钮：显示推荐输入语句
  - 建议列表：点击建议项可自动填入输入框
  - 关闭按钮：隐藏建议面板

- **对话控制**：
  - 结束对话按钮：退出当前对话

- **状态指示**：
  - 加载点：显示AI正在生成响应
  - 错误消息：显示连接或生成错误

## 总结管理器功能

总结管理器是用于管理和编辑游戏角色对话摘要的界面，提供以下功能：

### 顶部控制按钮

- **刷新按钮**：重新加载所有摘要数据，包括从游戏日志解析玩家ID和读取摘要文件
- **保存按钮**：将当前所有摘要更改保存到文件
- **关闭按钮**：关闭总结管理器窗口

### 信息面板

- **玩家ID**：显示从游戏日志中解析出的当前玩家ID（只读）
- **选择角色**：下拉菜单，用于筛选特定角色的摘要或查看所有角色摘要
- **总结文件路径**：显示当前摘要文件的存储路径（只读）

### 总结列表区域

- **总结列表**：显示当前筛选条件下的所有摘要，每项包含日期、角色和摘要内容
- **添加新总结按钮**：在列表顶部创建一个新的空白摘要，默认使用当前选择的角色

### 编辑器区域

- **日期输入框**：编辑当前选中摘要的日期
- **内容文本框**：编辑当前选中摘要的详细内容
- **更新总结按钮**：保存对当前选中摘要的更改
- **删除总结按钮**：删除当前选中的摘要（需要确认）
- **新建总结按钮**：清空编辑器，准备创建新摘要

### 使用说明

1. 点击列表中的摘要项可选中并加载到编辑器
2. 使用角色筛选器可以查看特定角色或所有角色的摘要
3. 所有更改需要点击"保存"按钮才会写入文件
4. 删除操作不可撤销，请谨慎使用

## 🚀 本地设置

### 📥 安装
1. 下载最新版本的VOTC mod
2. 解压到您的CK3 mod文件夹
3. 启动CK3并在启动器中启用mod
4. 运行VOTC应用程序

### ⚙️ 配置
1. 启动应用程序
2. 导航到配置界面
3. 输入您的AI服务API密钥
4. 调整设置以符合您的偏好
5. 点击"保存配置"应用更改

### 🔄 恢复默认设置
- 使用"恢复默认Prompt"按钮可以一键恢复所有默认prompt设置
- 在配置界面中可以重置各个单独的配置项

## 🛠️ 故障排除

### 🔧 常见问题

#### 1. **应用程序无法启动**
   - 确保已安装所有依赖项：运行 `npm install`
   - 检查Node.js版本是否兼容
   - 验证游戏文件路径是否正确

#### 2. **AI连接问题**
   - 检查API密钥是否正确输入
   - 验证网络连接是否正常
   - 确认AI服务商的API状态

#### 3. **游戏集成问题**
   - 确保CK3游戏正在运行
   - 检查mod是否正确安装
   - 验证游戏文件路径配置

#### 4. **性能问题**
   - 减少上下文窗口大小
   - 限制对话历史记录数量
   - 关闭不必要的后台程序

#### 5. **恢复默认设置**
   - 使用配置界面中的"恢复默认Prompt"按钮
   - 重新配置API设置和模型参数
   - 检查配置文件是否正确保存

## 🤝 贡献

欢迎通过以下方式为项目做出贡献：
- 报告bug和提出功能请求

### 📝 贡献指南
1. Fork 这个仓库
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 📄 许可证

本项目采用 [GPL-3.0 许可证](LICENSE) - 详情请查看 [LICENSE](LICENSE) 文件

