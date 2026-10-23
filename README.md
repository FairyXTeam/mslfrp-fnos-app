# MSL FRP 飞牛 OS (fnOS) 原生应用

适用于 **飞牛私有云 (fnOS)** 的 **MSL FRP** 内网穿透原生应用安装包 (`.fpk`)。

采用飞牛原生小窗应用规范与零端口网关技术，视觉设计完全对齐飞牛原生系统应用风格（卡片式数据流向、状态圆标、双模主题适配），实现 24 小时后台稳定守护。

---

## 🌟 核心特性

- 🚀 **纯网关无额外端口通讯**：采用飞牛内置统一网关（`gatewaySocket: "app.sock"`）与 CGI 调度（`app/ui/index.cgi`），所有请求经由飞牛现有 Web 路由无缝传输，**无需在宿主机暴露任何额外 TCP 端口**，杜绝端口冲突。
- 🖥️ **飞牛原生桌面小窗体验**：声明 `type: "iframe"` 桌面应用入口，在飞牛 NAS 桌面上以原生小窗模式启动。
- 🎨 **对齐飞牛原生系统视觉设计**：参考飞牛系统原生「备份」应用界面，卡片采用「本地服务 ➔ 远程节点 ➔ 协议类型」清晰直观的流向结构，附带绿色连接圆标 `✔`、一键运行 `▷` 及 `···` 快捷功能。
- 🌓 **白天 / 暗黑模式自适应**：原生适配飞牛深色主题与浅色主题，并支持移动端响应式折叠。
- ⚡ **实时动态拉取配置与无盘启动**：每次在列表中点击启动时，实时从 MSL 云端 `/api/frp/getTunnelConfig?id={id}&format=toml` 拉取最新 TOML 配置直接唤醒 `frpc`，杜绝本地陈旧配置失效。
- 🛡️ **架构自适应与自动下载**：支持 `linux/amd64` (x86_64) 与 `linux/arm64` (aarch64)。首次启动时自动从 MSL 官方下载中心获取对应架构的客户端，无需用户手动折腾。
- 📄 **实时控制台日志抽屉**：每 1.5 秒自动更新日志流，支持日志颜色高亮、一键清屏与复制。
- 🌐 **免费子域名一键绑定**：支持通用 A/CNAME/SRV 记录，并提供**我的世界 (Minecraft SRV)** 专属向导，绑定后玩家直接输入子域名即可免端口直连！
- 🛒 **商城与在线充值**：内置 FRP VIP 会员、额外隧道与流量包兑换，支持卡密激活码兑换、微信/支付宝在线扫码及爱发电订单激活。
- 👤 **实名认证快捷跳转**：提供显式实名认证状态提示与直达按钮，快速导航至 `https://user.mslmc.net/user/profile`。

---

## 📂 项目结构

```text
mslfrp-fnos/
├── manifest                     # 飞牛应用元数据描述文件
├── ICON.PNG                     # 64x64 应用图标
├── ICON_256.PNG                 # 256x256 应用高清图标
├── config/
│   ├── privilege                # 运行身份配置 (run-as: package)
│   └── resource                 # 运行时资源声明
├── cmd/
│   ├── main                     # 应用生命周期管理脚本 (start, stop, status)
│   ├── install                  # 安装前置脚本
│   └── uninstall                # 卸载清理脚本
├── app/
│   ├── ui/
│   │   ├── config               # 桌面入口声明 (iframe, gatewaySocket)
│   │   ├── index.cgi            # CGI 兼容分发脚本
│   │   ├── images/              # 多尺寸图标文件
│   │   └── dist/                # Vue 3 前端生产构建产物
│   └── server/                  # Node.js 后台服务 (纯标准库，零外部依赖)
│       ├── index.js             # 主服务入口 (绑定 Unix Socket，托管静态与 API)
│       ├── frpcManager.js       # frpc 下载、架构自适应检测、进程监控与日志管理
│       ├── cloudProxy.js        # MSL 云端 API 代理转发模块
│       └── cgiHandler.js        # CGI 转发处理
├── frontend/                    # Vue 3 原生前端源码
│   ├── package.json
│   ├── vite.config.ts           # 打包目标指向 ../app/ui/dist，base: './'
│   └── src/
│       ├── App.vue              # 根组件
│       ├── components/          # 侧边栏、流向隧道卡片、日志抽屉、创建向导
│       ├── views/               # 隧道列表、子域名、商城、充值、设置
│       └── stores/              # Pinia 状态管理
├── scripts/
│   ├── build_fpk.sh             # 本地一键打包脚本
│   └── build_fpk.js             # Node.js 打包与校验引擎 (生成 .fpk)
└── .github/
    └── workflows/
        ├── release-fpk.yml      # Release 发布触发：自动按 Tag 版本构建并上传 Release 附件
        └── dev-build.yml        # Dev 持续集成：每次推送自动打包为 dev 产物 (Artifacts)
```

---

## 🛠️ 本地构建与打包

### 前置要求
- Node.js >= 18
- pnpm (或 npm)

### 快速构建 .fpk 安装包

```bash
# 1. 赋予构建脚本执行权限
chmod +x scripts/build_fpk.sh scripts/build_fpk.js

# 2. 一键编译前端并打包生成 .fpk
./scripts/build_fpk.sh
# 或者直接运行:
node scripts/build_fpk.js
```

构建完成后，制品将保存在：
`dist_fpk/mslfrp-1.0.0.fpk`

---

## 📥 飞牛 OS 安装与使用

1. 打开飞牛私有云 (fnOS) 桌面；
2. 打开「应用中心」；
3. 点击右上角「手动安装」，上传生成的 `mslfrp-1.0.0.fpk` 文件；
4. 安装完成后，在桌面打开 **MSL 映射**；
5. 在弹出的向导中录入您的 MSL 用户 Token（可从 [user.mslmc.net/user/profile](https://user.mslmc.net/user/profile) 复制）；
6. 即可在桌面原生小窗中自由新增隧道、实时启动穿透、查看日志与管理子域名！

---

## 📜 开源许可

本项目遵循 MIT License 协议开源。
由 [MSL Team](https://www.mslmc.cn) 倾情制作。
