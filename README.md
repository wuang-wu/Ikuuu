iKuuu VPN 自动签到脚本（青龙版）

这是一个用于 `iKuuu VPN` 的自动签到脚本，适配 `Qinglong` 环境。

## 功能

- 自动获取最新可用域名（多渠道获取 + 可用性验证）
- 支持单账号 Cookie 直接填写
- 兼容 JSON 多账号配置
- 支持钉钉通知
- 使用 Node.js 原生 `fetch` 和 `crypto`，无需额外安装依赖

> 说明：iKuuu 登录接口已启用极验（Geetest）V4 行为验证码，无法用邮箱 + 密码自动登录，因此签到只能使用 Cookie 方式。

## 获取 Cookie

1. 使用浏览器登录 `https://ikuuu.eu/`
2. 进入我的账号
3. 按 `F12` 打开开发者工具
4. 切换到 Console
5. 输入 `document.cookie`
6. 复制输出的整条 Cookie 字符串

注意：获取 Cookie 后不要点退出登录，否则 Cookie 可能失效。Cookie 有有效期，失效后需重新获取。

## 青龙环境变量

在青龙面板中添加以下变量：

| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `ACCOUNTS` | 账号 Cookie，支持纯字符串或 JSON | `_ga=...; PHPSESSID=...; uid=...; key=...;` |
| `HOST` | 可选，手动指定域名 | `ikuuu.pw` |
| `DD_BOT_TOKEN` | 可选，钉钉机器人 Token 或完整 webhook | `https://oapi.dingtalk.com/robot/send?...` |
| `DD_BOT_SECRET` | 可选，钉钉加签密钥 | `SECxxxxx` |

## `ACCOUNTS` 推荐写法

直接填写一整条 Cookie：

```text
_ga=***************;_ga_8HVN7928SC=*********************;PHPSESSID=************;uid=************;email=***************;key=********************;ip=**************;expire_in=***********
```

脚本会自动在内部转换成单账号配置。首尾即使带有单引号 `'...'` 或双引号 `"..."` 也没关系，脚本会自动去除。

## `ACCOUNTS` 多账号写法

多个账号可用换行或 `&&` 分隔多条 Cookie：

```text
uid=12345; key=xxxxxx; && uid=67890; key=yyyyyy;
```

也可以使用 JSON 格式（支持自定义名称）：

```json
[
  {
    "name": "账号1",
    "cookie": "uid=12345; email=test@gmail.com; key=xxxxxx;"
  },
  {
    "name": "账号2",
    "cookie": "uid=67890; email=dev@gmail.com; key=yyyyyy;"
  }
]
```

## 运行要求

- Node.js `18+`
- 青龙或其他支持环境变量的 Node.js 运行环境

## 说明

- 未配置 `HOST` 时，脚本会自动尝试获取最新域名
- `ACCOUNTS` 为空时脚本会直接退出
- 当签到失败或 Cookie 失效时，脚本会输出错误信息
