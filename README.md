# XuetangX Homework Collector

一个用于整理学堂在线作业、章节测试、练习回顾页的本地小工具。它会在你已经登录并能正常查看答案的页面中，采集每道题的题目截图和页面上可见的答案文本，并生成 Word 文档。

> 本项目只读取浏览器页面中已经对当前账号正常展示的内容，不保存账号密码，不绕过登录、验证码、权限或隐藏接口。

## 版本更新

### v2.0.0

- 从“固定 100 题采集”升级为“通用采集”。
- 默认不再要求提前填写题目数量。
- 从当前题开始采集，自动点击“下一题”。
- 找不到下一题、下一题不可点击，或达到安全上限时自动停止。
- 自动从页面文本识别题型：单选题、多选题、判断题。
- `collector.config.json` 变为可选配置，只在特殊页面或需要自定义输出目录时使用。
- 答案识别失败时，Word 中只保留题目截图，不写“未识别”。

### v1.0.0

- 支持固定 100 题作业采集。
- 支持题目截图、答案文本提取和 Word 文档生成。
- 默认题型规则为：1-60 单选，61-80 多选，81-100 判断。

## 功能

- 自动打开浏览器并复用本地登录状态。
- 从当前题开始采集，不要求固定 100 题。
- 自动点击“下一题”，直到找不到下一题、下一题不可用，或达到安全上限。
- 自动识别页面中的题型文本：单选题、多选题、判断题。
- 按题截图保存题目区域。
- 尝试读取页面上可见的答案文本。
- 生成包含题图和答案的 Word 文档。
- 如果某题答案无法识别，Word 中只保留题目截图，不额外写“未识别”。

## 环境要求

请先安装 Node.js LTS 版本。安装完成后，重新打开终端，确认：

```bash
node -v
npm -v
```

如果 `npm` 无法识别，说明 Node.js 没安装好或环境变量没有生效。请重新安装 Node.js LTS，或重启终端/电脑后再试。

推荐下载地址：

- https://nodejs.org/

Windows 用户也可以使用：

```powershell
winget install OpenJS.NodeJS.LTS
```

如果下载失败，通常是网络问题。请换网络、使用浏览器手动下载安装包，或稍后重试。

## 安装

克隆或下载本项目后，在项目根目录运行：

```bash
npm install
```

如果 Playwright 提示需要安装浏览器，运行：

```bash
npx playwright install chromium
```

## 通用使用方法

### 1. 采集题目和答案

运行：

```bash
npm run collect
```

脚本会打开浏览器窗口。然后：

1. 手动登录学堂在线。
2. 打开目标作业或章节测试的答案回顾页。
3. 切到你想开始采集的第一题。
4. 回到终端，直接按回车开始采集。

脚本会从当前题开始，一直点击“下一题”。遇到没有下一题、下一题不可点击，或达到 `maxQuestions` 上限时自动停止。

采集完成后，会生成：

```text
xuetangx_homework_export/
├─ data.json
└─ images/
   ├─ q001.png
   ├─ q002.png
   └─ ...
```

### 2. 生成 Word 文档

运行：

```bash
npm run docx
```

生成文件：

```text
xuetangx_homework_export/xuetangx_homework_answers.docx
```

## 可选配置

多数情况下不需要配置。默认脚本会自动采到没有下一题为止。

如果某个章节测试页面特殊，或者你想指定输出目录、标题、安全上限，可以复制示例配置：

```bash
copy collector.config.example.json collector.config.json
```

然后修改 `collector.config.json`：

```json
{
  "title": "第 1 章测试答案整理",
  "outputDir": "exports/chapter-01",
  "maxQuestions": 30,
  "questionTypes": [
    { "from": 1, "to": 3, "type": "single" },
    { "from": 4, "to": 5, "type": "judgement" }
  ],
  "questionAreaSelector": "",
  "answerSelector": "",
  "nextButtonText": "下一题"
}
```

配置说明：

- `title`：Word 文档标题。
- `outputDir`：导出目录。
- `maxQuestions`：最多采集多少题，防止页面异常时无限循环。
- `questionTypes`：题型兜底规则。页面能识别“单选题/多选题/判断题”时，会优先使用页面识别结果。
- `questionAreaSelector`：题目区域 selector。默认自动猜。
- `answerSelector`：答案区域 selector。默认从整页文本提取。
- `nextButtonText`：下一题按钮文字，默认是“下一题”。

使用配置运行时，脚本会自动读取当前目录下的 `collector.config.json`。也可以指定配置路径：

```bash
npm run collect -- --config=configs/chapter-01.json
```

## 诊断页面选择器

如果截图区域不准确，或答案文本识别不准，可以重新运行：

```bash
npm run collect
```

浏览器打开并进入答案页后，在终端输入：

```text
d
```

脚本会输出候选区域。把合适的 selector 填到 `collector.config.json` 或 `src/collect.js` 顶部配置：

```js
questionAreaSelector: ".question-area-selector",
answerSelector: ".answer-area-selector"
```

然后重新运行采集。

## 开发命令

运行测试：

```bash
npm test
```

语法检查：

```bash
npm run check
```

## 项目结构

```text
xuetangx-homework-collector/
├─ src/
│  ├─ collect.js        # 采集脚本
│  ├─ make-docx.js      # Word 生成脚本
│  └─ helpers.js        # 题型和答案解析工具
├─ tests/
│  └─ helpers.test.js   # helper 测试
├─ collector.config.example.json
├─ package.json
├─ .gitignore
├─ LICENSE
└─ README.md
```

运行后产生的目录不会提交到 GitHub：

```text
node_modules/
xuetangx_homework_export/
exports/
.xuetangx-browser-profile/
collector.config.json
```

## 上传到 GitHub

初始化仓库：

```bash
git init
git add .
git commit -m "Initial commit"
```

在 GitHub 创建一个空仓库后，按页面提示添加远程地址，例如：

```bash
git remote add origin https://github.com/your-name/xuetangx-homework-collector.git
git branch -M main
git push -u origin main
```

## 合规说明

请只在你有权限访问的课程和作业页面中使用本工具。不要用于绕过登录、验证码、权限限制、隐藏接口，也不要采集或发布你无权分享的内容。

## 常见问题

### npm 无法识别怎么办？

请安装 Node.js LTS，并重新打开终端后运行：

```bash
node -v
npm -v
```

两个命令都能显示版本号后，再运行 `npm install`。

### winget 下载 Node.js 失败怎么办？

这是网络下载失败。可以换网络，或者直接访问 https://nodejs.org/ 手动下载 LTS 安装包。

### 章节测试只有 5 题，会不会继续点下去？

不会。脚本会在没有可用“下一题”时自动停止。`maxQuestions` 只是安全上限。

### 判断题答案没有识别出来怎么办？

有些页面会用图标或 CSS 显示答案，普通文本无法读取。当前处理方式是：识别不到答案时，Word 中只保留题目截图，不写“未识别”。

### 只想重新生成 Word，不重新采集可以吗？

可以。只要导出目录里的 `data.json` 和 `images/` 还在，直接运行：

```bash
npm run docx
```
