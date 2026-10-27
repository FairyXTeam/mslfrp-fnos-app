const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const frpcManager = require('./frpcManager');
const cloudProxy = require('./cloudProxy');

const APP_DEST = process.env.TRIM_APPDEST || path.resolve(__dirname, '../..');
const PKG_VAR = process.env.TRIM_PKGVAR || path.join(APP_DEST, 'var');
const SOCKET_PATH = process.env.SOCKET_PATH || '';
const PORT = process.env.PORT || (SOCKET_PATH ? null : 5001);
const GATEWAY_PREFIX = process.env.GATEWAY_PREFIX || '';

// Ensure runtime directories exist
try {
  fs.mkdirSync(path.join(PKG_VAR, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(PKG_VAR, 'run'), { recursive: true });
  fs.mkdirSync(path.join(PKG_VAR, 'data'), { recursive: true });
} catch {}

function getAutostartList() {
  try {
    const f = path.join(PKG_VAR, 'data', 'autostart.json');
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Array.isArray(data)) return data.map(Number).filter((n) => !isNaN(n));
    }
  } catch {}
  return [];
}

function saveAutostartList(list) {
  try {
    const d = path.join(PKG_VAR, 'data');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, 'autostart.json');
    fs.writeFileSync(f, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[mslfrp-backend] Failed to save autostart.json:', err);
  }
}

function getAppConfig() {
  try {
    const f = path.join(PKG_VAR, 'data', 'config.json');
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch {}
  return {};
}

function saveAppConfig(cfg) {
  try {
    const d = path.join(PKG_VAR, 'data');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, 'config.json');
    fs.writeFileSync(f, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('[mslfrp-backend] Failed to save config.json:', err);
  }
}

function checkAccountSwitch(newUid, username) {
  if (!newUid) return false;
  const cfg = getAppConfig();
  const lastUid = cfg.lastUid;
  let switched = false;

  if (lastUid && Number(lastUid) !== Number(newUid)) {
    console.log(`[mslfrp-backend] Account switch detected: UID ${lastUid} -> UID ${newUid}. Terminating previous account tunnels...`);
    // 1. Terminate all tunnels belonging to the previous account
    frpcManager.stopAll(PKG_VAR);
    // 2. Clear autostart list
    saveAutostartList([]);
    // 3. Clear cached persistent tunnel configurations
    frpcManager.cleanCachedConfigs(PKG_VAR);
    switched = true;
  }

  // Record active user UID
  saveAppConfig({
    ...cfg,
    lastUid: Number(newUid),
    lastUsername: username || cfg.lastUsername || ''
  });

  return switched;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, filePath) {
  const allowedDist = path.resolve(__dirname, '../ui/dist');
  const allowedUi = path.resolve(__dirname, '../ui');
  const resolvedPath = path.resolve(filePath);

  // Security Hardening: Prevent directory traversal outside allowed UI directories
  if (!resolvedPath.startsWith(allowedDist) && !resolvedPath.startsWith(allowedUi)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: 路径越界，禁止访问');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback to index.html if file not found
      const indexPath = path.join(__dirname, '../ui/dist/index.html');
      fs.stat(indexPath, (idxErr, idxStats) => {
        if (idxErr || !idxStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found - MSL FRP UI has not been built yet.');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(indexPath).pipe(res);
      });
      return;
    }

    // Static asset caching: 1 day for assets, no-cache for index.html
    const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheControl
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';

  // Redirect /app/mslfrp to /app/mslfrp/
  if (pathname === '/app/mslfrp') {
    res.writeHead(302, { 'Location': '/app/mslfrp/' + (parsedUrl.search || '') });
    res.end();
    return;
  }

  // Strip gateway prefix if present (e.g. /app/mslfrp or /cgi/ThirdParty/mslfrp/index.cgi)
  if (pathname.startsWith('/app/mslfrp/')) {
    pathname = pathname.slice('/app/mslfrp'.length) || '/';
  } else if (GATEWAY_PREFIX && pathname.startsWith(GATEWAY_PREFIX)) {
    pathname = pathname.slice(GATEWAY_PREFIX.length) || '/';
  } else if (pathname.includes('/index.cgi')) {
    pathname = pathname.slice(pathname.indexOf('/index.cgi') + 10) || '/';
  }

  // --- Local Backend APIs ---
  if (pathname.startsWith('/api/local/')) {
    const apiPath = pathname.slice('/api/local/'.length);

    // 1. Auth Management
    if (apiPath === 'auth/token') {
      if (req.method === 'GET') {
        const token = cloudProxy.getToken(PKG_VAR);
        return sendJson(res, 200, { code: 200, data: { token } });
      }
      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.token) return sendJson(res, 400, { code: 400, msg: '缺少 token 参数' });
        cloudProxy.saveToken(PKG_VAR, body.token);
        return sendJson(res, 200, { code: 200, msg: 'Token 保存成功' });
      }
      if (req.method === 'DELETE') {
        cloudProxy.clearToken(PKG_VAR);
        return sendJson(res, 200, { code: 200, msg: 'Token 已清除' });
      }
    }

    if (apiPath === 'auth/verify' && req.method === 'GET') {
      const result = await cloudProxy.verifyToken(PKG_VAR);
      if (result.code === 200 && result.data && result.data.userInfo) {
        const switched = checkAccountSwitch(result.data.userInfo.uid, result.data.userInfo.username);
        if (switched) {
          result.data.accountSwitched = true;
        }
      }
      return sendJson(res, result.code, result);
    }

    if (apiPath === 'auth/oauth/start' && req.method === 'POST') {
      const result = await cloudProxy.startOAuthSession();
      return sendJson(res, result.code, result);
    }

    if (apiPath === 'auth/oauth/poll' && req.method === 'GET') {
      const sessionId = parsedUrl.query.sessionId;
      const result = await cloudProxy.pollOAuthSession(sessionId, PKG_VAR);
      return sendJson(res, result.code, result);
    }

    if (apiPath === 'auth/wechat/start' && req.method === 'POST') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const type = body.type || parsedUrl.query.type || 'qrcode';
      const result = await cloudProxy.startWechatSession(type);
      return sendJson(res, result.code, result);
    }

    if (apiPath === 'auth/wechat/poll' && req.method === 'GET') {
      const sessionId = parsedUrl.query.sessionId;
      const result = await cloudProxy.pollWechatSession(sessionId, PKG_VAR);
      return sendJson(res, result.code, result);
    }

    if (apiPath === 'auth/logout' && (req.method === 'POST' || req.method === 'GET')) {
      await cloudProxy.logoutToken(PKG_VAR);
      return sendJson(res, 200, { code: 200, msg: '已成功注销并退出登录' });
    }

    // 2. Tunnel Start
    if (apiPath === 'tunnel/start' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const tunnelId = body.id || body.tunnel_id;
      const userToken = body.userToken || req.headers.authorization?.replace(/^Bearer\s+/i, '') || cloudProxy.getToken(PKG_VAR);

      if (!tunnelId || !/^\d+$/.test(String(tunnelId).trim())) {
        return sendJson(res, 400, { code: 400, msg: '缺少或非法的隧道 ID' });
      }

      const hasCached = frpcManager.hasCachedConfig(PKG_VAR, tunnelId);
      if (!userToken && !hasCached) {
        return sendJson(res, 401, { code: 401, msg: '未登录且无本地缓存配置，无法启动隧道' });
      }

      try {
        const result = await frpcManager.startTunnel(APP_DEST, PKG_VAR, userToken || '', tunnelId);
        return sendJson(res, 200, { code: 200, msg: '隧道启动成功', data: result });
      } catch (err) {
        return sendJson(res, 500, { code: 500, msg: `启动失败: ${err.message}` });
      }
    }

    // 3. Tunnel Stop
    if (apiPath === 'tunnel/stop' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const tunnelId = body.id || body.tunnel_id;
      if (!tunnelId || !/^\d+$/.test(String(tunnelId).trim())) {
        return sendJson(res, 400, { code: 400, msg: '缺少或非法的隧道 ID' });
      }

      try {
        const result = frpcManager.stopTunnel(PKG_VAR, tunnelId);
        return sendJson(res, 200, { code: 200, msg: '隧道已停止', data: result });
      } catch (err) {
        return sendJson(res, 500, { code: 500, msg: `停止失败: ${err.message}` });
      }
    }

    // 4. Tunnel Status
    if (apiPath === 'tunnel/status' && (req.method === 'POST' || req.method === 'GET')) {
      let ids = [];
      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        ids = (body.ids || []).filter((id) => /^\d+$/.test(String(id).trim()));
      } else {
        ids = parsedUrl.query.ids
          ? String(parsedUrl.query.ids).split(',').filter((id) => /^\d+$/.test(String(id).trim()))
          : [];
      }
      const statusMap = frpcManager.getTunnelStatus(PKG_VAR, ids);
      return sendJson(res, 200, { code: 200, data: statusMap });
    }

    // 5. Tunnel Logs
    if (apiPath === 'tunnel/logs' && req.method === 'GET') {
      const tunnelId = parsedUrl.query.id || parsedUrl.query.tunnel_id;
      const lines = parseInt(parsedUrl.query.lines || '100', 10);
      if (!tunnelId || !/^\d+$/.test(String(tunnelId).trim())) {
        return sendJson(res, 400, { code: 400, msg: '缺少或非法的隧道 ID' });
      }
      const logs = frpcManager.getTunnelLogs(PKG_VAR, tunnelId, lines);
      return sendJson(res, 200, { code: 200, data: { logs } });
    }

    // 6. Tunnel Autostart Configuration
    if (apiPath === 'tunnel/autostart') {
      if (req.method === 'GET') {
        const autostartList = getAutostartList();
        return sendJson(res, 200, { code: 200, data: autostartList });
      }
      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        let currentList = getAutostartList();

        if (Array.isArray(body.ids)) {
          currentList = Array.from(new Set(body.ids.map(Number).filter((n) => !isNaN(n))));
        } else if (body.id !== undefined) {
          const tid = Number(body.id);
          if (!isNaN(tid)) {
            const enable = body.autostart !== undefined ? !!body.autostart : !currentList.includes(tid);
            if (enable) {
              if (!currentList.includes(tid)) currentList.push(tid);
            } else {
              currentList = currentList.filter((id) => id !== tid);
            }
          }
        }

        saveAutostartList(currentList);
        return sendJson(res, 200, { code: 200, msg: '自启动设置已更新', data: currentList });
      }
    }

    // 6. frpc Info & Download
    if (apiPath === 'frpc/info' && req.method === 'GET') {
      const binPath = path.join(APP_DEST, 'bin/frpc');
      const installed = fs.existsSync(binPath);
      const arch = frpcManager.getSystemArch();
      return sendJson(res, 200, {
        code: 200,
        data: {
          installed,
          arch,
          path: binPath
        }
      });
    }

    if (apiPath === 'frpc/ensure' && req.method === 'POST') {
      try {
        const frpcPath = await frpcManager.ensureFrpc(APP_DEST);
        return sendJson(res, 200, { code: 200, msg: 'frpc 客户端准备就绪', data: { path: frpcPath } });
      } catch (err) {
        return sendJson(res, 500, { code: 500, msg: `下载 frpc 失败: ${err.message}` });
      }
    }

    // 7. General Application Configuration (Persisted in PKG_VAR/data/config.json)
    if (apiPath === 'config') {
      if (req.method === 'GET') {
        const config = getAppConfig();
        return sendJson(res, 200, { code: 200, data: config });
      }
      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        const currentConfig = getAppConfig();
        const updatedConfig = { ...currentConfig, ...body };
        saveAppConfig(updatedConfig);
        return sendJson(res, 200, { code: 200, msg: '配置保存成功', data: updatedConfig });
      }
    }

    return sendJson(res, 404, { code: 404, msg: 'Local API route not found' });
  }

  // --- Cloud API Transparent Proxy ---
  // Any call to /api/* (except /api/local/* already handled above) is proxied by backend to user.mslmc.net
  if (pathname.startsWith('/api/')) {
    let targetPath = pathname;
    if (pathname.startsWith('/api/proxy/')) {
      targetPath = '/' + pathname.slice('/api/proxy/'.length);
    }
    // Append query string if present
    if (parsedUrl.search) {
      targetPath += parsedUrl.search;
    }
    return cloudProxy.forwardRequest(req, res, targetPath, PKG_VAR);
  }

  // --- Static UI File Hosting ---
  // Normalize path
  let relativePath = pathname;
  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  // If requesting images from /images/
  if (relativePath.startsWith('/images/')) {
    const imgPath = path.join(__dirname, '../ui', relativePath);
    return serveStatic(req, res, imgPath);
  }

  // Otherwise serve from frontend dist directory
  const filePath = path.join(__dirname, '../ui/dist', relativePath);
  serveStatic(req, res, filePath);
});

// Startup handling
function runAutostartTunnels() {
  setTimeout(async () => {
    try {
      const autostartIds = getAutostartList();
      if (!autostartIds || !autostartIds.length) {
        console.log('[mslfrp-backend] No autostart tunnels configured');
        return;
      }
      const userToken = cloudProxy.getToken(PKG_VAR);
      if (!userToken) {
        console.log('[mslfrp-backend] Autostart: No active user token found, launching tunnels via persistent cached configs...');
      }
      console.log(`[mslfrp-backend] Executing autostart for ${autostartIds.length} tunnel(s)...`);
      for (const tunnelId of autostartIds) {
        try {
          console.log(`[mslfrp-backend] Autostarting tunnel ${tunnelId}...`);
          await frpcManager.startTunnel(APP_DEST, PKG_VAR, userToken || '', tunnelId);
          console.log(`[mslfrp-backend] Tunnel ${tunnelId} autostarted successfully.`);
        } catch (err) {
          console.error(`[mslfrp-backend] Failed to autostart tunnel ${tunnelId}:`, err.message);
        }
      }
    } catch (e) {
      console.error('[mslfrp-backend] Autostart error:', e);
    }
  }, 3000);
}

// Background keeper: keep user token automatically renewed every 12 hours
function startTokenRenewalKeeper() {
  const RENEW_INTERVAL = 12 * 3600 * 1000;
  setInterval(async () => {
    try {
      const token = cloudProxy.getToken(PKG_VAR);
      if (token) {
        await cloudProxy.renewToken(token);
      }
    } catch (err) {
      console.warn('[mslfrp-backend] Scheduled token renewal error:', err.message);
    }
  }, RENEW_INTERVAL);
}

if (SOCKET_PATH) {
  if (fs.existsSync(SOCKET_PATH)) {
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
  }
  server.listen(SOCKET_PATH, () => {
    try { fs.chmodSync(SOCKET_PATH, 0o777); } catch {}
    console.log(`[mslfrp-backend] Server listening on socket: ${SOCKET_PATH}`);
    runAutostartTunnels();
    startTokenRenewalKeeper();
  });
} else if (PORT) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[mslfrp-backend] Server listening on local HTTP port: 127.0.0.1:${PORT}`);
    runAutostartTunnels();
    startTokenRenewalKeeper();
  });
}

// Graceful termination
const shutdown = () => {
  console.log('[mslfrp-backend] Shutting down server and stopping all tunnels...');
  try {
    frpcManager.stopAll(PKG_VAR);
  } catch (e) {
    console.error('[mslfrp-backend] Error stopping tunnels on shutdown:', e);
  }

  if (SOCKET_PATH && fs.existsSync(SOCKET_PATH)) {
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
