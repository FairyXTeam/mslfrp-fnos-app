const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const https = require('https');

class FrpcManager {
  constructor() {
    this.processes = new Map(); // tunnelId -> { pid, proc, startTime, configFile, logFile }
  }

  getSystemArch() {
    const arch = os.arch();
    if (arch === 'x64') return 'amd64';
    if (arch === 'arm64') return 'arm64';
    return 'amd64';
  }

  fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const getReq = (targetUrl) => {
        https.get(targetUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            getReq(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed with status code ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      };
      getReq(url);
    });
  }

  async ensureFrpc(appDest) {
    const binDir = path.join(appDest, 'bin');
    const frpcPath = path.join(binDir, 'frpc');

    if (fs.existsSync(frpcPath)) {
      try { fs.chmodSync(frpcPath, 0o755); } catch {}
      return frpcPath;
    }

    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const arch = this.getSystemArch();
    console.log(`[frpcManager] Detected system architecture: ${arch}`);

    let downloadUrl = '';
    try {
      const res = await this.fetchJson('https://user.mslmc.net/api/frp/download');
      if (res && res.data && res.data.cli && res.data.cli.length > 0) {
        const cliData = res.data.cli[0].download;
        if (cliData.Linux && cliData.Linux[arch]) {
          downloadUrl = cliData.Linux[arch].url;
        }
      }
    } catch (e) {
      console.warn('[frpcManager] Failed to fetch download info from MSL API:', e.message);
    }

    if (!downloadUrl) {
      // Official MSL fallback mirror
      downloadUrl = `https://github.com/MSLTeam/frp/releases/download/v0.61.0/frp_0.61.0_linux_${arch}.tar.gz`;
    }

    console.log(`[frpcManager] Downloading frpc from: ${downloadUrl}`);
    const tempDir = '/tmp/mslfrp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const archivePath = path.join(tempDir, `frpc_linux_${arch}.tar.gz`);
    await this.downloadFile(downloadUrl, archivePath);

    // Extract archive
    await new Promise((resolve, reject) => {
      execFile('tar', ['-xzf', archivePath, '-C', tempDir], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Find the extracted frpc binary in tempDir
    const findFrpc = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findFrpc(fullPath);
          if (found) return found;
        } else if (entry.name === 'frpc') {
          return fullPath;
        }
      }
      return null;
    };

    const extractedFrpc = findFrpc(tempDir);
    if (!extractedFrpc) {
      throw new Error('frpc binary not found inside downloaded archive');
    }

    fs.copyFileSync(extractedFrpc, frpcPath);
    fs.chmodSync(frpcPath, 0o755);
    console.log(`[frpcManager] frpc installed successfully to: ${frpcPath}`);
    return frpcPath;
  }

  async startTunnel(appDest, pkgVar, userToken, tunnelId) {
    const numericId = Number(tunnelId);
    
    // Check if already running
    const existing = this.getTunnelStatus(pkgVar, [numericId]);
    if (existing[numericId] && existing[numericId].running) {
      return { status: 'running', pid: existing[numericId].pid, alreadyRunning: true };
    }

    // Clean up in-memory reference of any old instance before starting anew
    if (this.processes.has(numericId)) {
      const old = this.processes.get(numericId);
      this.processes.delete(numericId);
      try { if (old.proc && !old.proc.killed) old.proc.kill('SIGKILL'); } catch {}
    }

    const frpcBin = await this.ensureFrpc(appDest);

    // 1. Fetch live dynamic configuration in TOML format from MSL Cloud API, or fallback to persistent cached config
    let tomlContent = '';
    const persistentDir = path.join(pkgVar, 'data', 'configs');
    const persistentConfigFile = path.join(persistentDir, `tunnel_${numericId}.toml`);

    if (userToken) {
      try {
        console.log(`[frpcManager] Fetching dynamic config for tunnel ${numericId}...`);
        const configUrl = `https://user.mslmc.net/api/frp/getTunnelConfig?id=${numericId}&format=toml`;
        const configRes = await this.fetchJson(configUrl, {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'User-Agent': 'MSL-FRP-fnOS/1.0.0'
          }
        });

        if (configRes && configRes.code === 200 && configRes.data) {
          tomlContent = configRes.data;
          try {
            if (!fs.existsSync(persistentDir)) fs.mkdirSync(persistentDir, { recursive: true });
            fs.writeFileSync(persistentConfigFile, tomlContent, 'utf8');
          } catch (e) {
            console.warn(`[frpcManager] Failed to persist config for tunnel ${numericId}:`, e.message);
          }
        } else {
          console.warn(`[frpcManager] Live config fetch returned error: ${configRes?.msg || 'unknown'}`);
        }
      } catch (err) {
        console.warn(`[frpcManager] Live config fetch request failed: ${err.message}`);
      }
    }

    // Fallback to persistent cached config if live fetch could not be obtained (e.g. login expired or offline)
    if (!tomlContent) {
      if (fs.existsSync(persistentConfigFile)) {
        try {
          tomlContent = fs.readFileSync(persistentConfigFile, 'utf8');
          console.log(`[frpcManager] Using persistent cached configuration for tunnel ${numericId}`);
        } catch (e) {
          console.warn(`[frpcManager] Failed to read cached config for tunnel ${numericId}:`, e.message);
        }
      }
    }

    if (!tomlContent) {
      throw new Error('获取隧道穿透配置失败，且无本地持久化配置缓存');
    }

    // 2. Write runtime temporary configuration
    const tempDir = '/tmp/mslfrp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const configFile = path.join(tempDir, `tunnel_${numericId}.toml`);
    fs.writeFileSync(configFile, tomlContent, 'utf8');

    // 3. Prepare log file
    const logDir = path.join(pkgVar, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `tunnel_${numericId}.log`);
    
    // Append startup separator
    const startTimeStr = new Date().toLocaleString();
    fs.appendFileSync(logFile, `\n\n=== [${startTimeStr}] Tunnel ${numericId} Starting ===\n`);

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // 4. Spawn detached child frpc process
    const proc = spawn(frpcBin, ['-c', configFile], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.pipe(logStream);
    proc.stderr.pipe(logStream);

    const runDir = path.join(pkgVar, 'run');
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
    const pidFile = path.join(runDir, `tunnel_${numericId}.pid`);
    fs.writeFileSync(pidFile, String(proc.pid), 'utf8');

    const procRecord = {
      pid: proc.pid,
      proc,
      startTime: Date.now(),
      configFile,
      logFile,
      hasError: false,
      lastError: null
    };
    this.processes.set(numericId, procRecord);

    proc.on('exit', (code, signal) => {
      console.log(`[frpcManager] Tunnel ${numericId} exited with code ${code}, signal ${signal}`);
      this.processes.delete(numericId);
      try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch {}
      try { if (fs.existsSync(configFile)) fs.unlinkSync(configFile); } catch {}
    });

    // 5. Await startup confirmation or failure (handshake window)
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let startupBuffer = '';

      const cleanupListeners = () => {
        if (timeoutId) clearTimeout(timeoutId);
        proc.stdout.removeListener('data', onData);
        proc.stderr.removeListener('data', onData);
      };

      const fail = (errMsg) => {
        if (isSettled) return;
        isSettled = true;
        cleanupListeners();

        procRecord.hasError = true;
        procRecord.lastError = errMsg;

        // Force kill failed frpc so it doesn't linger as a zombie process
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch {}
          }, 300);
        } catch {}

        this.processes.delete(numericId);
        try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch {}
        try { if (fs.existsSync(configFile)) fs.unlinkSync(configFile); } catch {}

        try {
          fs.appendFileSync(logFile, `[System] 启动失败: ${errMsg}\n`);
        } catch {}

        reject(new Error(errMsg));
      };

      const succeed = () => {
        if (isSettled) return;
        isSettled = true;
        cleanupListeners();
        proc.unref();

        // Keep runtime error watcher on process: if proxy fails at any point, terminate zombie
        const onRuntimeError = (chunk) => {
          const text = chunk.toString();
          if (text.includes('start error:') || text.includes('already exists')) {
            console.error(`[frpcManager] Proxy error detected in tunnel ${numericId}: ${text.trim()}`);
            procRecord.hasError = true;
            try { proc.kill('SIGKILL'); } catch {}
          }
        };
        proc.stdout.on('data', onRuntimeError);
        proc.stderr.on('data', onRuntimeError);

        resolve({ status: 'running', pid: proc.pid });
      };

      const onData = (chunk) => {
        const text = chunk.toString();
        startupBuffer += text;

        // Check for specific known frpc failure patterns
        if (startupBuffer.includes('already exists')) {
          return fail('代理名称已被占用 (proxy already exists)，该隧道可能已在其他设备或云端在线运行');
        }
        if (startupBuffer.includes('port already used')) {
          return fail('远端映射端口已被占用 (port already used)，请更换端口或稍后重试');
        }
        if (startupBuffer.includes('start error:')) {
          const match = startupBuffer.match(/start error:\s*([^\n\r]+)/);
          const detail = match ? match[1].trim() : '代理启动错误';
          return fail(`代理启动失败: ${detail}`);
        }
        if (startupBuffer.includes('login to server failed:')) {
          const match = startupBuffer.match(/login to server failed:\s*([^\n\r]+)/);
          const detail = match ? match[1].trim() : '无法连接至穿透服务器';
          return fail(`节点登录失败: ${detail}`);
        }
        if (startupBuffer.includes('connect to server error:')) {
          return fail('无法连接至穿透节点服务器，请检查节点状态或网络');
        }
        if (startupBuffer.includes('authorization failed')) {
          return fail('穿透节点授权失败 (Token 或密钥无效)');
        }

        // Check for success pattern
        if (startupBuffer.includes('start proxy success') || startupBuffer.includes('隧道已成功启动')) {
          return succeed();
        }
      };

      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);

      proc.once('exit', (code) => {
        if (!isSettled) {
          fail(`frpc 进程提前退出 (退出码: ${code})`);
        }
      });

      // Handshake timeout (7.5s) for high-latency / remote node connections
      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          fail('连接穿透节点超时 (7.5 秒未收到节点响应)，请检查节点状态或重试');
        }
      }, 7500);
    });
  }

  stopTunnel(pkgVar, tunnelId) {
    const numericId = Number(tunnelId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new Error('Invalid tunnel ID');
    }

    let pid = null;

    if (this.processes.has(numericId)) {
      const info = this.processes.get(numericId);
      pid = info.pid;
      this.processes.delete(numericId);
      try {
        if (info.proc && !info.proc.killed) {
          info.proc.kill('SIGTERM');
        }
      } catch {}
    } else {
      const pidFile = path.join(pkgVar, 'run', `tunnel_${numericId}.pid`);
      if (fs.existsSync(pidFile)) {
        try {
          pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        } catch {}
      }
    }

    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        // Process might have already terminated
      }

      // Escalate to SIGKILL for that specific PID only if still alive after 1.2s
      const targetPid = pid;
      setTimeout(() => {
        try {
          process.kill(targetPid, 0);
          process.kill(targetPid, 'SIGKILL');
          console.log(`[frpcManager] Force-killed stubborn tunnel ${numericId} (PID: ${targetPid})`);
        } catch {}
      }, 1200);
    } else {
      try {
        execFile('pkill', ['-TERM', '-f', `tunnel_${numericId}.toml`], () => {});
      } catch {}
    }

    // Cleanup PID file and temp config
    try {
      const pidFile = path.join(pkgVar, 'run', `tunnel_${numericId}.pid`);
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch {}

    try {
      const configFile = path.join('/tmp/mslfrp', `tunnel_${numericId}.toml`);
      if (fs.existsSync(configFile)) fs.unlinkSync(configFile);
    } catch {}

    const logFile = path.join(pkgVar, 'logs', `tunnel_${numericId}.log`);
    try {
      if (fs.existsSync(logFile)) {
        fs.appendFileSync(logFile, `=== [${new Date().toLocaleString()}] Tunnel ${numericId} Stopped ===\n`);
      }
    } catch {}

    return { status: 'stopped' };
  }

  stopAll(pkgVar) {
    console.log('[frpcManager] Stopping all running tunnels...');
    for (const [numericId, info] of this.processes.entries()) {
      try {
        if (info.proc && !info.proc.killed) {
          info.proc.kill('SIGTERM');
        }
      } catch {}
      try {
        execFile('pkill', ['-TERM', '-f', `tunnel_${numericId}.toml`], () => {});
      } catch {}
    }
    this.processes.clear();

    const runDir = path.join(pkgVar, 'run');
    if (fs.existsSync(runDir)) {
      try {
        const files = fs.readdirSync(runDir);
        for (const f of files) {
          if (f.startsWith('tunnel_') && f.endsWith('.pid')) {
            const pPath = path.join(runDir, f);
            try {
              const pid = parseInt(fs.readFileSync(pPath, 'utf8').trim(), 10);
              if (pid) process.kill(pid, 'SIGTERM');
            } catch {}
            try { fs.unlinkSync(pPath); } catch {}
          }
        }
      } catch {}
    }

    try {
      execFile('pkill', ['-TERM', '-f', 'tunnel_.*\\.toml'], () => {});
    } catch {}
  }

  hasCachedConfig(pkgVar, tunnelId) {
    const numericId = Number(tunnelId);
    const persistentConfigFile = path.join(pkgVar, 'data', 'configs', `tunnel_${numericId}.toml`);
    return fs.existsSync(persistentConfigFile);
  }

  cleanCachedConfigs(pkgVar) {
    const cfgDir = path.join(pkgVar, 'data', 'configs');
    if (fs.existsSync(cfgDir)) {
      try {
        const files = fs.readdirSync(cfgDir);
        for (const f of files) {
          if (f.endsWith('.toml')) {
            try { fs.unlinkSync(path.join(cfgDir, f)); } catch {}
          }
        }
        console.log('[frpcManager] All persistent cached tunnel configurations cleared');
      } catch (e) {
        console.warn('[frpcManager] Failed to clean cached configs:', e.message);
      }
    }
  }

  getTunnelStatus(pkgVar, tunnelIds = []) {
    const statusMap = {};
    const runDir = path.join(pkgVar, 'run');

    for (const id of tunnelIds) {
      const numericId = Number(id);
      let isRunning = false;
      let pid = null;
      let startTime = null;

      if (this.processes.has(numericId)) {
        const info = this.processes.get(numericId);
        pid = info.pid;
        startTime = info.startTime;
        if (info.hasError) {
          isRunning = false;
        } else {
          try {
            process.kill(pid, 0);
            isRunning = true;
          } catch {
            this.processes.delete(numericId);
          }
        }
      } else if (fs.existsSync(runDir)) {
        const pidFile = path.join(runDir, `tunnel_${numericId}.pid`);
        if (fs.existsSync(pidFile)) {
          try {
            pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
            process.kill(pid, 0);
            isRunning = true;
          } catch {
            try { fs.unlinkSync(pidFile); } catch {}
          }
        }
      }

      statusMap[numericId] = {
        running: isRunning,
        pid: isRunning ? pid : null,
        startTime: isRunning ? startTime : null,
        uptime: isRunning && startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
      };
    }

    return statusMap;
  }

  maskLogContent(text) {
    if (!text || typeof text !== 'string') return '';
    // Mask user token before -<uid>.<tunnel_name>, keeping first 3 and last 3 characters
    return text.replace(/([a-zA-Z0-9_-]{8,64})(?=-\d+\.[a-zA-Z0-9_\-\.]+)/g, (match, token) => {
      if (token.length > 6) {
        return `${token.slice(0, 3)}*****${token.slice(-3)}`;
      }
      return '*****';
    });
  }

  getTunnelLogs(pkgVar, tunnelId, maxLines = 100) {
    const numericId = Number(tunnelId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return '非法的隧道 ID';
    }
    const logFile = path.join(pkgVar, 'logs', `tunnel_${numericId}.log`);
    if (!fs.existsSync(logFile)) {
      return '暂无日志记录。';
    }
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      const sliced = lines.slice(-maxLines).join('\n');
      return this.maskLogContent(sliced);
    } catch (e) {
      return `读取日志错误: ${e.message}`;
    }
  }
}

module.exports = new FrpcManager();
