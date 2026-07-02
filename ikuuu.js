const crypto = require('crypto'); 

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ==========================================
// 0. 账号信息解析
// ==========================================
// 支持三种 ACCOUNTS 格式：
//   1) JSON 数组:  [{"name":"A","cookie":"..."},{"name":"B","cookie":"..."}]
//   2) 单个 JSON 对象: {"name":"A","cookie":"..."}
//   3) 纯 Cookie 字符串（多账号可用换行或 && 分隔）
// 去掉首尾成对的单引号或双引号（兼容用户把 Cookie 用引号包裹的写法）
function stripQuotes(str) {
  let result = str.trim();
  while (result.length >= 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      result = result.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return result;
}

function normalizeAccounts(rawAccounts) {
  const trimmed = (rawAccounts || "").trim();
  if (!trimmed) {
    throw new Error("未配置 ACCOUNTS 环境变量或内容为空");
  }

  let list = null;

  // JSON 检测时先临时去掉可能包裹整体的引号
  const unquoted = stripQuotes(trimmed);
  if (unquoted.startsWith("[") || unquoted.startsWith("{")) {
    try {
      const parsed = JSON.parse(unquoted);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      throw new Error(`ACCOUNTS 看起来是 JSON 但解析失败: ${error.message}`);
    }
  } else {
    // 纯 Cookie 字符串，支持换行或 && 分隔多账号，每段单独去掉首尾引号
    list = trimmed.split(/\r?\n|&&/).map(s => stripQuotes(s)).filter(Boolean);
  }

  const accounts = [];
  list.forEach((item, index) => {
    if (typeof item === "string") {
      item = { cookie: item };
    }
    const cookie = item && typeof item.cookie === "string" ? stripQuotes(item.cookie) : "";
    if (!cookie) {
      console.log(`[账号解析] ⚠️ 第 ${index + 1} 个账号缺少有效 cookie，已跳过`);
      return;
    }
    const name = (item.name || "").toString().trim() || `账号${index + 1}`;
    accounts.push({ name, cookie });
  });

  if (accounts.length === 0) {
    throw new Error("ACCOUNTS 中没有解析到任何有效账号（每个账号必须包含 cookie）");
  }

  console.log(`[账号解析] 共解析到 ${accounts.length} 个有效账号: ${accounts.map(a => a.name).join("、")}`);
  return accounts;
}

// ==========================================
// 1. 自动获取最新域名的核心功能
// ==========================================
const RELEASE_URL = "https://ikuuu.eu/";
const FALLBACK_HOSTS = ["ikuuu.win", "ikuuu.pw", "ikuuu.club"];

function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return fetch(url, {
    headers: { "User-Agent": UA },
    ...options,
    signal: AbortSignal.timeout(timeout)
  });
}

// 依次尝试多个渠道拉取发布页 HTML（直连优先，失败再走代理接口）
async function fetchReleasePageHtml() {
  const sources = [
    { name: "直连发布页", url: RELEASE_URL },
    { name: "代理接口 allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(RELEASE_URL)}` },
    { name: "代理接口 codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(RELEASE_URL)}` }
  ];

  for (const source of sources) {
    try {
      console.log(`[域名加载] 正在通过「${source.name}」获取发布页...`);
      const response = await fetchWithTimeout(source.url);
      if (!response.ok) {
        console.log(`[域名加载] ⚠️ ${source.name} 返回状态码 ${response.status}，尝试下一渠道`);
        continue;
      }
      const html = await response.text();
      if (html && html.length > 0) {
        console.log(`[域名加载] ✅ 通过「${source.name}」成功获取发布页内容`);
        return html;
      }
    } catch (error) {
      console.log(`[域名加载] ⚠️ ${source.name} 请求异常: ${error.message}，尝试下一渠道`);
    }
  }
  return null;
}

// 从 HTML 中提取所有 ikuuu.xxx 候选域名（去重、排除发布页自身域名）
function extractCandidateHosts(html) {
  const matches = html.match(/ikuuu\.[a-z]{2,10}/gi) || [];
  const releaseHost = new URL(RELEASE_URL).hostname.replace(/^www\./, "");
  return [...new Set(matches.map(m => m.toLowerCase()))].filter(h => h !== releaseHost);
}

// 验证候选域名是否真实可访问（防止拿到已被墙或已废弃的域名）
async function isHostAlive(host) {
  try {
    const response = await fetchWithTimeout(`https://${host}/auth/login`, { method: "GET" }, 8000);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function getLatestHost() {
  // 如果你在青龙环境变量中强制锁定了 HOST，则优先使用你的配置
  if (process.env.HOST) {
    console.log(`[域名加载] 检测到环境变量 HOST，使用强制指定域名: ${process.env.HOST}`);
    return process.env.HOST;
  }

  const html = await fetchReleasePageHtml();
  const candidates = html ? extractCandidateHosts(html) : [];

  if (candidates.length > 0) {
    console.log(`[域名加载] 从发布页解析到候选域名: ${candidates.join("、")}`);
  } else {
    console.log("[域名加载] ⚠️ 未能从发布页解析到候选域名，将直接尝试备用域名");
  }

  // 候选域名 + 备用域名合并去重后，逐个验证可用性，取第一个能连通的
  const allHosts = [...new Set([...candidates, ...FALLBACK_HOSTS])];
  for (const host of allHosts) {
    console.log(`[域名加载] 正在验证域名可用性: ${host} ...`);
    if (await isHostAlive(host)) {
      console.log(`[域名加载] 🎉 域名验证通过，本次使用: ${host}`);
      return host;
    }
    console.log(`[域名加载] ❌ ${host} 无法访问，尝试下一个`);
  }

  // 全部验证失败时的最终兜底
  console.log(`[域名加载] ⚠️ 所有域名均验证失败，将强行使用默认备用域名: ${FALLBACK_HOSTS[0]}`);
  return FALLBACK_HOSTS[0];
}

// ==========================================
// 2. 钉钉推送功能
// ==========================================
async function sendDingTalk(title, message) {
  let token = process.env.DD_BOT_TOKEN;
  let secret = process.env.DD_BOT_SECRET;

  if (!token) return;

  let url = token.startsWith('http') 
    ? token 
    : `https://oapi.dingtalk.com/robot/send?access_token=${token}`;
  
  if (secret) {
    try {
      const timestamp = Date.now();
      const stringToSign = timestamp + "\n" + secret;
      const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
      const encodedSign = encodeURIComponent(sign);
      url += `&timestamp=${timestamp}&sign=${encodedSign}`;
    } catch (e) {
      console.error("钉钉签名计算失败:", e.message);
    }
  }

  const payload = {
    msgtype: "markdown",
    markdown: {
      title: title,
      text: `### ${title}\n\n${message}\n\n---\n*时间：${new Date().toLocaleString('zh-CN')}*`
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.errcode !== 0) {
      console.log(`❌ 钉钉推送失败: ${data.errmsg}`);
    }
  } catch (err) {
    console.log(`❌ 钉钉推送请求异常: ${err.message}`);
  }
}

// ==========================================
// 3. 签到核心逻辑
// ==========================================
// 注意：现在 checkIn 接收动态获取的 host 作为第二个参数
async function checkIn(account, host) {
  const checkInUrl = `https://${host}/user/checkin`;
  try {
    const response = await fetch(checkInUrl, {
      method: "POST",
      headers: {
        "Cookie": account.cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
    });

    const text = await response.text();

    if (text.startsWith("<!DOCTYPE") || text.includes("<html")) {
      return "失败 ❌ (Cookie失效，或当前获取的域名已被墙导致重定向)";
    }

    try {
      const data = JSON.parse(text);
      return `成功 ✅ : ${data.msg || "已签到"}`;
    } catch (e) {
      return `解析异常: ${text.substring(0, 30)}...`;
    }

  } catch (error) {
    return `请求异常 ❌: ${error.message}`;
  }
}

// ==========================================
// 4. 主入口
// ==========================================
async function main() {
  console.log("=== iKuuu 青龙自动签到开始 ===\n");

  let accounts;
  try {
    accounts = normalizeAccounts(process.env.ACCOUNTS);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  // 第一步：先动态获取一次最新的域名
  const targetHost = await getLatestHost();
  console.log(`\n▶ 本次任务将使用域名: ${targetHost}\n`);

  let hasError = false;
  let notifyContent = `**签到域名**: \`${targetHost}\`\n\n`; 

  // 第二步：使用动态获取的域名进行签到
  for (const acc of accounts) {
    // 挨个串行签到，防止并发过高被拦截
    const resultText = await checkIn(acc, targetHost);
    console.log(`账号 [${acc.name}] 签到结果: \n${resultText}\n`);
    notifyContent += `**账号 [${acc.name}]**:\n> ${resultText}\n\n`;

    if (resultText.includes("❌")) {
      hasError = true;
    }
  }

  // 触发钉钉推送
  await sendDingTalk("iKuuu 签到通知", notifyContent);

  console.log("=== 签到任务执行完毕 ===");

  if (hasError) {
    process.exit(1);
  }
}

main();
