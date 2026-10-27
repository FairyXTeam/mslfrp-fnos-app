const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CLIENT_ID = 'laMKvoF7l9yYz2VKtnkveAJGeFA';

function requestHttpsJson(method, endpointPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'User-Agent': 'MSL-FRP-fnOS/1.0.0',
      'Accept': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'user.mslmc.net',
      port: 443,
      path: endpointPath,
      method: method,
      headers: reqHeaders,
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('请求超时'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

class CloudProxy {
  constructor() {
    this.sessions = new Map();
    this.wechatSessions = new Map();
    this.lastRenewedAt = 0;
  }

  async renewToken(token) {
    if (!token) return false;
    const now = Date.now();
    // Throttle: avoid renewing more frequently than every 6 hours
    if (this.lastRenewedAt && (now - this.lastRenewedAt < 6 * 3600 * 1000)) {
      return true;
    }

    try {
      const resp = await requestHttpsJson('POST', '/api/user/renewToken', null, {
        Authorization: `Bearer ${token}`
      });

      if (resp && resp.data && resp.data.code === 200) {
        this.lastRenewedAt = now;
        console.log('[cloudProxy] Token successfully renewed on MSL Cloud for 30 days');
        return true;
      } else {
        console.warn(`[cloudProxy] Token renewal response: ${resp?.data?.msg || resp?.status}`);
      }
    } catch (err) {
      console.warn(`[cloudProxy] Token renewal request error: ${err.message}`);
    }
    return false;
  }

  getToken(pkgVar) {
    const dataDir = path.join(pkgVar, 'data');
    const tokenFile = path.join(dataDir, 'user_token.json');
    if (!fs.existsSync(tokenFile)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      return data.token || null;
    } catch {
      return null;
    }
  }

  saveToken(pkgVar, token) {
    const dataDir = path.join(pkgVar, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tokenFile = path.join(dataDir, 'user_token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({ token, updatedAt: Date.now() }, null, 2), 'utf8');
    return true;
  }

  clearToken(pkgVar) {
    const tokenFile = path.join(pkgVar, 'data', 'user_token.json');
    if (fs.existsSync(tokenFile)) {
      try { fs.unlinkSync(tokenFile); } catch {}
    }
    return true;
  }

  async logoutToken(pkgVar) {
    const token = this.getToken(pkgVar);
    if (token) {
      try {
        await requestHttpsJson('GET', '/api/user/logout', null, {
          Authorization: `Bearer ${token}`
        });
        console.log('[cloudProxy] Token successfully invalidated on MSL Cloud');
      } catch (err) {
        console.warn('[cloudProxy] MSL Cloud logout call warning:', err.message);
      }
    }
    this.clearToken(pkgVar);
    return true;
  }

  cleanExpiredSessions() {
    const now = Date.now();
    for (const [id, item] of this.sessions.entries()) {
      if (now - item.createdAt > 300000) {
        this.sessions.delete(id);
      }
    }
    for (const [id, item] of this.wechatSessions.entries()) {
      if (now - item.createdAt > 300000) {
        this.wechatSessions.delete(id);
      }
    }
  }

  async startOAuthSession() {
    this.cleanExpiredSessions();
    const csrf = crypto.randomBytes(16).toString('hex');
    const sessionId = crypto.randomBytes(16).toString('hex');

    try {
      const resp = await requestHttpsJson('POST', '/api/oauth/createAppLogin', {
        appid: CLIENT_ID,
        csrf: csrf
      });

      if (resp && resp.data && resp.data.code === 200 && resp.data.data) {
        this.sessions.set(sessionId, {
          ssid: resp.data.data.ssid,
          csrf: csrf,
          createdAt: Date.now()
        });

        return {
          code: 200,
          data: {
            sessionId: sessionId,
            url: resp.data.data.url
          }
        };
      } else {
        const errorMsg = resp?.data?.msg || '无法创建授权登录会话';
        return { code: 500, msg: errorMsg };
      }
    } catch (err) {
      return { code: 500, msg: `连接 MSL 用户中心失败: ${err.message}` };
    }
  }

  async pollOAuthSession(sessionId, pkgVar) {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return { code: 400, data: { status: 'expired' }, msg: '会话已过期，请重新登录' };
    }

    const session = this.sessions.get(sessionId);
    if (Date.now() - session.createdAt > 300000) {
      this.sessions.delete(sessionId);
      return { code: 400, data: { status: 'expired' }, msg: '会话已超时，请重新登录' };
    }

    try {
      const targetPath = `/api/oauth/appLogin?ssid=${encodeURIComponent(session.ssid)}&csrf=${encodeURIComponent(session.csrf)}`;
      const resp = await requestHttpsJson('GET', targetPath);

      if (resp && resp.data && resp.data.code === 200) {
        if (resp.data.data && resp.data.data.token) {
          const token = resp.data.data.token;
          const username = resp.data.data.username || '';
          this.saveToken(pkgVar, token);
          this.sessions.delete(sessionId);

          return {
            code: 200,
            data: {
              status: 'success',
              token: token,
              username: username
            }
          };
        } else {
          return {
            code: 200,
            data: {
              status: 'waiting'
            }
          };
        }
      } else {
        this.sessions.delete(sessionId);
        return {
          code: 400,
          data: { status: 'expired' },
          msg: resp?.data?.msg || '授权请求已失效'
        };
      }
    } catch (err) {
      return { code: 500, data: { status: 'error' }, msg: `检查登录状态出错: ${err.message}` };
    }
  }

  async startWechatSession(type = 'qrcode') {
    this.cleanExpiredSessions();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const reqType = type === 'url' ? 'url' : 'qrcode';

    try {
      // 1. Initialize session on user.mslmc.net to generate valid session state & cookie
      const redirectResp = await requestHttpsJson('GET', '/api/oauth/redirect?provider=wechat_miniprogram&mode=login');
      if (!redirectResp || redirectResp.status !== 200 || !redirectResp.data?.data?.uri) {
        return { code: 500, msg: redirectResp?.data?.msg || '获取微信授权状态失败' };
      }

      // Extract connect.sid cookie from set-cookie header
      const rawCookie = redirectResp.headers['set-cookie'];
      let cookie = Array.isArray(rawCookie)
        ? rawCookie.map((c) => c.split(';')[0]).join('; ')
        : (rawCookie ? rawCookie.split(';')[0] : '');

      // Extract state parameter
      const uri = redirectResp.data.data.uri;
      const stateMatch = uri.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      // 2. Fetch official mini-program QR code or URL Scheme carrying this exact session cookie
      const qrResp = await requestHttpsJson('GET', `/api/oauthClient/wechat-mp/qrcode?type=${reqType}`, null, {
        Cookie: cookie
      });

      if (qrResp && qrResp.headers && qrResp.headers['set-cookie']) {
        const qrRaw = qrResp.headers['set-cookie'];
        const qrCookie = Array.isArray(qrRaw) ? qrRaw.map((c) => c.split(';')[0]).join('; ') : qrRaw.split(';')[0];
        if (qrCookie) cookie = qrCookie;
      }

      if (qrResp && qrResp.data && qrResp.data.code === 200 && qrResp.data.data) {
        this.wechatSessions.set(sessionId, {
          cookie,
          state,
          mpSessionId: qrResp.data.data.sessionId,
          createdAt: Date.now()
        });

        return {
          code: 200,
          data: {
            sessionId: sessionId,
            qrcode: qrResp.data.data.qrcode || '',
            urlLink: qrResp.data.data.urlLink || ''
          }
        };
      } else {
        return { code: 500, msg: qrResp?.data?.msg || '生成微信小程序码/链接失败' };
      }
    } catch (err) {
      return { code: 500, msg: `微信服务通信异常: ${err.message}` };
    }
  }

  async pollWechatSession(sessionId, pkgVar) {
    if (!sessionId || !this.wechatSessions.has(sessionId)) {
      return { code: 400, data: { status: 'expired' }, msg: '二维码已失效，请刷新' };
    }

    const session = this.wechatSessions.get(sessionId);
    if (Date.now() - session.createdAt > 300000) {
      this.wechatSessions.delete(sessionId);
      return { code: 400, data: { status: 'expired' }, msg: '二维码已超时' };
    }

    try {
      const pollResp = await requestHttpsJson(
        'GET',
        `/api/oauthClient/wechat-mp/poll?session_id=${encodeURIComponent(session.mpSessionId)}`,
        null,
        { Cookie: session.cookie }
      );

      if (pollResp && pollResp.data && pollResp.data.code === 200 && pollResp.data.data) {
        if (pollResp.data.data.status === 'scanned' && pollResp.data.data.auth_code) {
          // Exchange auth_code with state and cookie
          const loginResp = await requestHttpsJson(
            'POST',
            '/api/oauth/login',
            {
              code: pollResp.data.data.auth_code,
              state: session.state,
              provider: 'wechat_miniprogram',
              mode: 'login'
            },
            { Cookie: session.cookie }
          );

          if (loginResp && loginResp.data && loginResp.data.code === 200 && loginResp.data.data?.token) {
            const token = loginResp.data.data.token;
            this.saveToken(pkgVar, token);
            this.wechatSessions.delete(sessionId);

            return {
              code: 200,
              data: {
                status: 'success',
                token: token,
                username: loginResp.data.data.username || ''
              }
            };
          } else {
            this.wechatSessions.delete(sessionId);
            return {
              code: 400,
              data: { status: 'failed' },
              msg: loginResp?.data?.msg || '该微信尚未绑定 MSL 账户'
            };
          }
        } else {
          return {
            code: 200,
            data: { status: 'waiting' }
          };
        }
      } else if (pollResp && pollResp.status === 404) {
        this.wechatSessions.delete(sessionId);
        return { code: 200, data: { status: 'expired' } };
      } else {
        return { code: 200, data: { status: 'waiting' } };
      }
    } catch (err) {
      return { code: 500, data: { status: 'error' }, msg: `微信状态查询失败: ${err.message}` };
    }
  }

  async verifyToken(pkgVar) {
    const token = this.getToken(pkgVar);
    if (!token) {
      return { code: 401, msg: '未登录' };
    }

    try {
      const resp = await requestHttpsJson('GET', '/api/user/info', null, {
        Authorization: `Bearer ${token}`
      });

      if (resp && resp.data && resp.data.code === 200 && resp.data.data) {
        let frpInfo = null;
        try {
          const frpResp = await requestHttpsJson('GET', '/api/frp/userInfo', null, {
            Authorization: `Bearer ${token}`
          });
          if (frpResp && frpResp.data && frpResp.data.code === 200) {
            frpInfo = frpResp.data.data;
          }
        } catch {}

        // Automatically renew token for another 30 days in background
        this.renewToken(token).catch(() => {});

        return {
          code: 200,
          data: {
            token: token,
            userInfo: resp.data.data,
            frpInfo: frpInfo
          }
        };
      } else {
        return { code: 401, msg: '登录已过期，请重新登录' };
      }
    } catch (err) {
      return { code: 502, msg: `验证登录失败: ${err.message}` };
    }
  }

  forwardRequest(req, res, targetPath, pkgVar) {
    const targetUrl = new URL(`https://user.mslmc.net${targetPath}`);
    
    // Copy headers, replace host
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    headers['user-agent'] = headers['user-agent'] || 'MSL-FRP-fnOS/1.0.0';

    if (!headers.authorization && pkgVar) {
      const token = this.getToken(pkgVar);
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
    }

    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[CloudProxy] Error forwarding request:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 502, msg: `代理请求失败: ${err.message}` }));
      }
    });

    req.pipe(proxyReq);
  }
}

module.exports = new CloudProxy();
