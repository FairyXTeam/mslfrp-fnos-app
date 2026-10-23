# MSL FRP 飞牛 OS (fnOS) 原生应用

适用于飞牛私有云 (fnOS) 的 MSL FRP 内网穿透原生应用安装包 (.fpk)。

采用飞牛原生小窗应用规范与零端口网关技术，视觉设计完全对齐飞牛原生系统应用风格（卡片式数据流向、状态圆标、双模主题适配），实现 24 小时后台稳定守护。

---

## 核心特性

- **纯网关无额外端口通讯**：采用飞牛内置统一网关（gatewaySocket: "app.sock"）与 CGI 调度（app/ui/index.cgi），所有请求经由飞牛现有 Web 路由无缝传输，无需在宿主机暴露任何额外 TCP 端口，杜绝端口冲突。
- **飞牛原生桌面小窗体验**：声明 type: "iframe" 桌面应用入口，在飞牛 NAS 桌面上以原生小窗模式启动。
- **对齐飞牛原生系统视觉设计**：参考飞牛系统原生备份应用界面，卡片采用「本地服务 -> 远程节点 -> 协议类型」清晰直观的流向结构，附带连接状态圆标、一键运行及快捷功能。
- **白天 / 暗黑模式自适应**：原生适配飞牛深色主题与浅色主题，并支持移动端响应式折叠。
- **实时动态拉取配置与无盘启动**：每次在列表中点击启动时，实时从 MSL 云端拉取最新配置直接唤醒 frpc，杜绝本地陈旧配置失效。
- **架构自适应与自动下载**：支持 linux/amd64 (x86_64) 与 linux/arm64 (aarch64)。首次启动时自动从官方下载中心获取对应架构的客户端，无需用户手动折腾。
- **实时控制台日志抽屉**：每 1.5 秒自动更新日志流，支持日志颜色高亮、一键清屏与复制。
- **流量统计图表与监控**：支持查看节点实时与历史流量分析走势，清晰直观。
- **免费子域名一键绑定**：支持通用 A/CNAME/SRV 记录，并提供我的世界 (Minecraft SRV) 专属向导，绑定后玩家直接输入子域名即可免端口直连。
- **商城与增值服务**：内置 FRP VIP 会员、额外隧道与流量包兑换，支持卡密激活码兑换、微信/支付宝在线支付。
- **个人中心与安全退出**：支持用户用量概览、Token 与域名白名单管理，登出时自动注销云端 Token。

---

## 项目结构

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
│   ├── vite.config.ts           # 打包目标指向 ../app/ui/dist
│   └── src/
│       ├── App.vue              # 根组件
│       ├── components/          # 侧边栏、流向卡片、日志抽屉、图表组件
│       ├── views/               # 隧道列表、个人中心、子域名、增值服务、设置
│       └── stores/              # Pinia 状态管理
├── scripts/
│   ├── build_fpk.sh             # 本地一键打包脚本
│   └── build_fpk.js             # Node.js 打包引擎 (生成 3 个目标架构包)
└── .github/
    └── workflows/
        ├── release-fpk.yml      # Release 发布触发：自动按 Tag 版本构建 3 个包并上传附件
        └── dev-build.yml        # Dev 持续集成：每次推送自动打包 dev 产物
```

---

## 本地构建与打包

### 前置要求
- Node.js >= 18
- npm

### 快速构建 .fpk 安装包

```bash
# 1. 赋予构建脚本执行权限
chmod +x scripts/build_fpk.sh scripts/build_fpk.js

# 2. 一键编译前端并打包生成 .fpk
./scripts/build_fpk.sh
# 或者直接运行:
node scripts/build_fpk.js
```

构建完成后，制品保存在 `dist_fpk/` 目录下，共生成 3 个安装包：
- `mslfrp_1.0.0_all.fpk`（全平台/双架构通用）
- `mslfrp_1.0.0_amd64.fpk`（x86 架构）
- `mslfrp_1.0.0_arm64.fpk`（ARM 架构）

---

## 飞牛 OS 安装与使用

1. 打开飞牛私有云 (fnOS) 桌面；
2. 打开「应用中心」；
3. 点击右上角「手动安装」，上传生成的安装包（如 `mslfrp_1.0.0_all.fpk`）；
4. 安装完成后，在桌面打开 MSL 映射；
5. 在弹出的登录窗口录入您的用户 Token（可从用户中心获取）；
6. 即可在桌面原生小窗中自由新增隧道、实时启动穿透、查看日志与管理子域名。

---

## 开源许可

本项目遵循 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 协议开源。
由 [FairyXTeam](https://user.mslmc.net) 制作。
