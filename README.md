iKuuu VPN 自动签到脚本 (青龙版)

这是一个专门为 [iKuuu VPN](https://ikuuu.eu/) 设计的自动签到脚本，适配 **青龙面板 (Qinglong)** 环境。支持多账号、自动抓取最新域名以及钉钉机器人通知。

## 🌟 功能特性

- **动态域名获取**：自动访问 iKuuu 发布页获取最新主域名，解决域名频繁被封的问题。
- **多账号支持**：支持通过 JSON 数组配置多个账号同时签到。
- **钉钉推送**：深度适配青龙面板的 `config.sh` 配置，支持加签验证。
- **智能重试与容错**：自动识别 Cookie 失效、网络重定向等异常情况并报警。
- **零依赖运行**：使用 Node.js 原生 `fetch` (Node 18+) 和 `crypto` 模块，无需额外安装 npm 包。

## 🚀 快速上手

### 1. 获取 Cookie (关键步骤)

1. 使用 Chrome 或 Edge 浏览器登录 [iKuuu 官网](https://ikuuu.eu/)。
2. 进入 **用户中心** 页面。
3. 按下 `F12` 打开开发者工具，切换到 **控制台 (Console)**。
4. 输入 `document.cookie` 并回车。
5. 复制输出的字符串（不含两端的引号）。它应该包含 `uid=xxx; email=xxx; key=xxx;` 等信息。

> **注意**：提取 Cookie 后请直接关闭浏览器标签页，**不要点击“退出登录”**，否则 Cookie 会失效。

### 2. 配置青龙环境变量

在青龙面板的 **环境变量** 菜单中添加以下变量：

| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `ACCOUNTS` | 账号信息 (JSON 格式) | `[{"name":"账号1", "cookie":"你的Cookie"}]` |
| `HOST` | (可选) 手动指定域名 | `ikuuu.pw` (如果不配置，脚本将自动获取) |

#### `ACCOUNTS` JSON 格式参考：
```json
[
  {
    "name": "我的主账号",
    "cookie": "uid=12345; email=test@gmail.com; key=xxxxxx;"
  },
  {
    "name": "备用账号",
    "cookie": "uid=67890; email=dev@gmail.com; key=yyyyyy;"
  }
]
