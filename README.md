# Zotero Immersive Translate Local

这是一个自用/分享用的 Zotero PDF 翻译插件版本。它已经和原版沉浸式翻译插件使用不同的插件 ID，不会再被原版插件的自动更新覆盖。

本项目的翻译流程只使用你自己配置的 API Key。默认推荐使用 BabelDOC 进行 PDF 翻译，以尽量保留原 PDF 排版。

## 功能特性

- 使用自己的 OpenAI 或 DeepSeek API Key 翻译 PDF
- 支持 BabelDOC，本地调用 BabelDOC CLI 生成翻译后的 PDF
- 不需要沉浸式翻译授权码或会员
- 使用独立插件 ID：`zotero-immersivetranslate-local@cy.local`
- 默认禁用原版插件的远端任务/授权码检查路径

## 安装插件

如果你已经有编译好的 XPI 文件，可以直接安装：

1. 打开 Zotero
2. 进入 `工具` -> `附加组件`
3. 点击右上角齿轮图标
4. 选择 `Install Add-on From File`
5. 选择 `dist/immersive-translate-local.xpi`
6. 重启 Zotero

如果是发给朋友使用，只需要把 `immersive-translate-local.xpi` 发给对方即可。对方不需要源码，但需要自己配置 API Key；如果要使用 BabelDOC，也需要在自己的电脑上安装 BabelDOC。

## 首次配置

安装并重启 Zotero 后，进入插件设置页：

1. 打开 Zotero 设置
2. 找到 `Local Translation` 或 `本地翻译`
3. 在 `API Provider` 中选择 `OpenAI (GPT)` 或 `DeepSeek`
4. 填写自己的 `API Key`
5. `Model Name` 可以留空，也可以手动填写模型名
6. 点击 `Test` 测试 API 是否可用

默认模型如下：

- OpenAI：`gpt-4o-mini`
- DeepSeek：`deepseek-chat`

目前插件内置的 API 地址是：

- OpenAI：`https://api.openai.com/v1`
- DeepSeek：`https://api.deepseek.com/v1`

## 使用 BabelDOC

BabelDOC 是推荐方式。它会在本地处理 PDF 结构，并调用你配置的 API 翻译文本，最后生成翻译后的 PDF。相比纯文本提取方式，它通常能更好保留论文排版。

### 安装 BabelDOC

推荐使用 `uv` 安装 BabelDOC：

```bash
uv tool install --python 3.12 BabelDOC
```

安装完成后，确认命令能运行：

```bash
babeldoc --help
```

如果系统提示找不到 `babeldoc`，说明命令没有进入 Zotero 能找到的 PATH。可以先查看 BabelDOC 的完整路径：

```bash
which babeldoc
```

常见路径包括：

- macOS Apple Silicon Homebrew：`/opt/homebrew/bin/babeldoc`
- macOS Intel Homebrew：`/usr/local/bin/babeldoc`
- uv 用户目录：`/Users/你的用户名/.local/bin/babeldoc`
- Linux：`/usr/bin/babeldoc` 或 `/home/你的用户名/.local/bin/babeldoc`

Windows 可以用：

```powershell
where babeldoc
```

然后把查到的完整路径填到插件设置里的 `BabelDOC Path`。

### 在插件中启用 BabelDOC

1. 打开插件设置
2. 勾选 `Use BabelDOC` 或 `使用 BabelDOC`
3. `BabelDOC Path` 默认是 `babeldoc`
4. 如果翻译时报 `BabelDOC not found`，把 `BabelDOC Path` 改成 `which babeldoc` 或 `where babeldoc` 查到的完整路径
5. 确认 `API Provider`、`API Key`、`Model Name` 已配置正确

插件调用 BabelDOC 时会自动传入：

- API Key
- API Provider 对应的 base URL
- 模型名
- 目标语言
- 当前 PDF 文件路径
- 输出目录

翻译成功后，生成的 PDF 会自动导入回 Zotero，并添加 `BabelDOC_translated`、`Local_Translation` 标签。

## 翻译 PDF

1. 在 Zotero 中选择一个条目或 PDF 附件
2. 右键选择 `Translate locally` 或 `使用本地翻译`
3. 也可以使用快捷键 `Shift + A`
4. 在确认窗口中选择目标语言、翻译模式和模型
5. 点击确认后会打开任务管理器
6. 翻译完成后，结果 PDF 会作为新附件加入 Zotero

任务管理器快捷键：

- `Shift + T`：打开本地翻译任务管理器

## 不使用 BabelDOC

如果不勾选 `Use BabelDOC`，插件会使用备用的文本提取翻译方式：

- 从 PDF 中提取每页文本
- 分块调用你配置的 API 翻译
- 生成 Markdown 附件

这种方式不适合需要保留论文版式的场景，但可以作为 BabelDOC 不可用时的临时 fallback。

## 常见问题

### 提示 `Please configure your custom API key in settings`

说明还没有在插件设置里填写 `customApiKey`。进入插件设置页，选择 API Provider 并填写自己的 API Key。

### 提示 `BabelDOC not found`

说明 Zotero 没找到 BabelDOC 命令。先在终端运行：

```bash
which babeldoc
```

然后把完整路径填入插件设置里的 `BabelDOC Path`。

### 朋友安装后能不能直接用？

可以直接安装 XPI，但不能免配置直接翻译。每个人都需要：

- 填自己的 API Key
- 如果使用 BabelDOC，需要本机安装 BabelDOC
- 如果 Zotero 找不到 BabelDOC，需要在插件设置里填写完整 BabelDOC 路径

### 会不会再被原版沉浸式翻译插件覆盖？

不会。这个版本使用独立的插件 ID 和独立的偏好设置前缀，并且构建产物的 manifest 中没有原版插件的 `update_url`。

## 从源码编译

```bash
pnpm install
pnpm run build
```

编译完成后，XPI 文件位于：

```text
dist/immersive-translate-local.xpi
```

## 开发说明

本项目的关键配置在 `package.json`：

- `config.addonID`
- `config.addonRef`
- `config.addonInstance`
- `config.prefsPrefix`
- `config.xpiName`

如果以后再次 fork 或改名，务必保持这些值和原版插件不同，否则 Zotero 可能会把两个插件识别为同一个插件。
