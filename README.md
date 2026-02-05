# Zotero Immersive Translate - 自用版本

使用自定义 API 的 Zotero 翻译插件。

## 功能特性

- 使用自定义 API 替代付费订阅
- 禁用自动更新功能，避免被原版覆盖

## 编译

```bash
# 安装依赖
pnpm install

# 编译
npm run build
```

编译完成后，xpi 文件位于 `dist` 目录。

## 安装

1. 打开 Zotero
2. 工具 -> 附加组件
3. 点击右上角齿轮图标 -> Install Add-on From File
4. 选择编译生成的 `dist/immersive-translate.xpi` 文件
5. 重启 Zotero

## 环境变量配置

复制 `.env.example` 为 `.env`，配置你自己的 API 密钥。

## 注意事项

- 本版本已禁用自动更新，不会被原仓库版本覆盖
- 每次修改代码后需要重新编译并安装
