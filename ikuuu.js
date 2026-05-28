const crypto = require('crypto'); 

// ==========================================
// 1. 自动获取最新域名的核心功能
// ==========================================
async function getLatestHost() {
  // 如果你在青龙环境变量中强制锁定了 HOST，则优先使用你的配置
  if (process.env.HOST) {
    console.log(`[域名加载] 检测到环境变量 HOST，使用强制指定域名: ${process.env.HOST}`);
    return process.env.HOST;
  }

  console.log("[域名加载] 正在尝试从发布页 (https://ikuuu.eu/) 获取最新主域名...");
  try {
    const response = await fetch("https://ikuuu.eu/", {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      // 设置超时防止卡死
      signal: AbortSignal.timeout(10000) 
    });
    
    const html = await response.text();

    // 使用正则表达式匹配页面中的 ikuuu.xxx 格式的域名
    // (因为主域名通常排在最前面，正则默认会抓取第一个匹配项)
    const match = html.match(/(ikuuu\.[a-z]+)/i);

    if (match && match[1]) {
      const dynamicHost = match[1].toLowerCase();
      console.log(`[域名加载] 🎉 成功获取当前最新域名: ${dynamicHost}`);
      return dynamicHost;
    } else {
      console.log("[域名加载] ⚠️ 页面解析失败，未能匹配到有效域名格式。");
    }
  } catch (error) {
    console.log(`[域名加载] ❌ 获取动态域名请求异常: ${error.message}`);
  }

  // 兜底方案：如果请求发布页失败（比如被墙），使用默认的备用域名
  const fallbackHost = "ikuuu.win";
  console.log(`[域名加载] 将使用默认备用域名进行尝试: ${fallbackHost}`);
  return fallbackHost;
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

  if (!process.env.ACCOUNTS) {
    console.error("❌ 未配置 ACCOUNTS 环境变量。");
    process.exit(1);
  }

  let accounts;
  try {
    accounts = JSON.parse(process.env.ACCOUNTS);
  } catch (error) {
    console.error("❌ ACCOUNTS 环境变量 JSON 格式错误，请检查！");
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
