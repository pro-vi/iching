# iching

[English](README.md) · **简体中文**

一款沉静的终端易经 TUI。

<p align="center">
  <img src="assets/home.png" alt="iching 主界面" width="480" />
</p>

立意。起卦。静观所现。

## 功能

- **起卦**：可选择写下问意。仪式以动画展开 —— 三枚铜钱、
  六爻、最后以盲文大字呈现卦象。
- **浏览** 全部六十四卦，附古文经传（大象傳、彖傳）、
  英译象辞与卦辞、以及卫礼贤风格的注解。
- **日志** 自动记录每一次起卦（含时间戳与问意），
  以追加式 JSONL 保存 —— 你自己的卜筮史。
- **接入大语言模型**：助手可读取你的卦象作进一步释义。

原始 ANSI 渲染、五种手调主题（ink、bone、cinnabar、jade、river）、
四种字符显化动画、三种汉字字体。
不依赖任何 Web 技术与框架。

## 安装

需要 [Bun](https://bun.sh) >= 1.0。

```bash
bunx @pro-vi/iching          # 一键运行，无需安装
```

或克隆构建：

```bash
git clone https://github.com/pro-vi/iching.git
cd iching
bun install
bun run build                # 为当前平台构建 dist/iching
```

## 用法

```bash
iching                          # 进入交互式 TUI
iching cast                     # 一次性起卦（纯文本）
iching cast "该不该上线？"       # 带问意起卦
iching cast --json              # 结构化输出
iching journal list             # 近期记录
iching journal show today       # 今日卦象
iching hexagram 1               # 按卦序查阅
iching dict                     # 在 TUI 中浏览六十四卦
iching config theme cinnabar    # 设置主题
```

按 `c` 起卦，`j` 查日志，`d` 查卦典，`s` 设置，`q` 退出。

## 数据存储

文件路径遵循 [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/) 规范：

| 类别 | 路径 | 用途 |
|------|------|------|
| 缓存 | `~/.cache/iching/daily-cache.json` | 最近一卦 |
| 日志 | `~/.local/state/iching/history.jsonl` | 全部卦象 |
| 配置 | `~/.config/iching/config.json` | 主题、动画、字符设置 |

可用 `ICHING_HOME` 环境变量或 `--data-dir` 参数覆盖。

## 项目结构

Bun 工作区单仓多包。共四个包：

| 包 | 职责 |
|-----|------|
| `@iching/core` | 纯领域逻辑 —— 起卦、推演、卦象数据 |
| `@iching/storage` | 文件持久化（JSON、JSONL、XDG 路径） |
| `@iching/terminal` | TUI 渲染 —— 场景、动画、主题（原始 ANSI） |
| `@iching/cli` | 基于 Commander 的入口与 hook 适配 |

## 开发

```bash
bun test          # 运行测试（382 项，约 100ms）
bun run typecheck # tsc --noEmit
bun run smoke     # 端到端冒烟测试
```

## 缘起

卦象既真，则其象已遍布于今日 —— 项目里、对话中、
代码间、抉择里。它不是一则待解的讯息，
而是一面早已在场的明镜。

观之，勿释。

## 许可

MIT
