<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { get, post, getAuthToken } from '../api/client';
import { useAppStore } from '../stores/app';
import { useTunnelsStore } from '../stores/tunnels';
import {
  Cog6ToothIcon,
  KeyIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckIcon,
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
  PaintBrushIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();
const tunnelsStore = useTunnelsStore();

// --- 1. frpc Core Info ---
const frpcInfo = ref<{ installed: boolean; arch: string; path: string }>({
  installed: false,
  arch: 'amd64',
  path: ''
});
const checkingFrpc = ref(false);
const downloadingFrpc = ref(false);

// --- 2. Domain Whitelist ---
interface WhitelistDomain {
  id: number;
  domain: string;
}

const whitelist = ref<WhitelistDomain[]>([]);
const loadingWhitelist = ref(false);
const newDomainInput = ref('');
const addingDomain = ref(false);

async function fetchWhitelist() {
  loadingWhitelist.value = true;
  try {
    const res = await get('/api/frp/getWhiteListDomain');
    if (res && res.code === 200 && Array.isArray(res.data)) {
      whitelist.value = res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch domain whitelist:', err);
  } finally {
    loadingWhitelist.value = false;
  }
}

async function handleAddDomain() {
  const domain = newDomainInput.value.trim().toLowerCase();
  if (!domain) {
    toast.warning('请输入有效的根域名');
    return;
  }

  addingDomain.value = true;
  try {
    const res = await post('/api/frp/addWhiteListDomain', { domain });
    if (res && res.code === 200) {
      toast.success('域名添加白名单成功！');
      newDomainInput.value = '';
      await fetchWhitelist();
    } else {
      toast.error(res?.msg || '添加白名单失败');
    }
  } catch (err: any) {
    toast.error(err.message || '添加失败');
  } finally {
    addingDomain.value = false;
  }
}

async function handleDeleteDomain(item: WhitelistDomain) {
  const confirmed = await confirmModal({
    title: '移除域名白名单',
    message: `确定要将域名 "${item.domain}" 从白名单中移除吗？`,
    confirmText: '确定移除',
    cancelText: '取消',
    type: 'danger'
  });

  if (!confirmed) return;

  try {
    const res = await post('/api/frp/deleteWhiteListDomain', { id: item.id });
    if (res && res.code === 200) {
      toast.success('域名已从白名单移除');
      await fetchWhitelist();
    } else {
      toast.error(res?.msg || '移除失败');
    }
  } catch (err: any) {
    toast.error(err.message || '移除请求异常');
  }
}

function copyDomain(domain: string) {
  navigator.clipboard.writeText(domain);
  toast.success(`域名 ${domain} 已复制到剪贴板`);
}

onMounted(async () => {
  await Promise.all([
    fetchFrpcInfo(),
    fetchWhitelist(),
    tunnelsStore.tunnels.length === 0 ? tunnelsStore.fetchTunnels() : tunnelsStore.fetchAutostart()
  ]);
});

async function handleToggleAutostart(id: number) {
  try {
    const newState = await tunnelsStore.toggleAutostart(id);
    toast.success(newState ? '已开启开机自启动' : '已关闭开机自启动');
  } catch (err: any) {
    toast.error(err.message || '设置自启动失败');
  }
}

async function fetchFrpcInfo() {
  checkingFrpc.value = true;
  try {
    const res = await get('/api/local/frpc/info');
    if (res && res.code === 200 && res.data) {
      frpcInfo.value = res.data;
    }
  } catch {}
  finally {
    checkingFrpc.value = false;
  }
}

async function handleDownloadFrpc() {
  downloadingFrpc.value = true;
  try {
    const res = await post('/api/local/frpc/ensure');
    if (res && res.code === 200) {
      toast.success('frpc 客户端核心下载完成！');
      await fetchFrpcInfo();
    } else {
      toast.error(res?.msg || '下载失败');
    }
  } catch (err: any) {
    toast.error(err.message || '下载请求异常');
  } finally {
    downloadingFrpc.value = false;
  }
}

function handleReLogin() {
  appStore.showLoginDialog = true;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-2 sm:p-3 md:p-4 select-none">
    <!-- Header Card (Matching Reference Card Style) -->
    <div class="shrink-0 p-4 sm:p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h1 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight m-0">系统设置</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          管理本地 frpc 核心运行时、账户凭证授权、开机自启策略以及自定义域名白名单。
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 pb-12">
      <!-- 0. 外观主题与框架风格 (Appearance & Layout Theme) -->
      <div class="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <PaintBrushIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">外观与框架主题</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">选择应用的窗口呈现形态，并可自由在 MSL 原生与飞牛官方原生规范之间无缝切换</p>
            </div>
          </div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 shrink-0">
            当前: {{ appStore.layoutTheme === 'fnos' ? 'fnOS 飞牛原生' : 'MSLFrp Native' }}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <!-- Option 1: fnOS Native (Default) -->
          <div
            @click="appStore.setLayoutTheme('fnos')"
            :class="[
              'p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative select-none',
              appStore.layoutTheme === 'fnos'
                ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs'
                : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700'
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-zinc-900 dark:text-white">fnOS 飞牛原生</span>
                </div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 m-0 leading-relaxed">
                  飞牛系统原生卡片式嵌入框架，与飞牛桌面窗口风格高度融合，轻量简洁。
                </p>
              </div>
              <div
                :class="[
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                  appStore.layoutTheme === 'fnos' ? 'bg-blue-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'
                ]"
              >
                <CheckIcon v-if="appStore.layoutTheme === 'fnos'" class="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
              <span>特性: 飞牛桌面融合 · 悬浮圆角卡片 · 原生设计</span>
            </div>
          </div>

          <!-- Option 2: MSLFrp Native -->
          <div
            @click="appStore.setLayoutTheme('native')"
            :class="[
              'p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative select-none',
              appStore.layoutTheme === 'native'
                ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs'
                : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700'
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-zinc-900 dark:text-white">MSLFrp 经典原生</span>
                </div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 m-0 leading-relaxed">
                  独立客户端沉浸式全宽布局，保留完整品牌标识栏与宽版导航卡，适合全屏浏览。
                </p>
              </div>
              <div
                :class="[
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                  appStore.layoutTheme === 'native' ? 'bg-blue-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'
                ]"
              >
                <CheckIcon v-if="appStore.layoutTheme === 'native'" class="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
              <span>特性: 沉浸式侧边栏 · 完整应用标识 · 全宽视图</span>
            </div>
          </div>
        </div>

        <!-- 颜色主题模式: 跟随系统 / 亮白 / 暗黑 -->
        <div class="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">主题色彩模式</span>
            <span class="text-xs text-zinc-400">
              当前: {{ appStore.themeMode === 'auto' ? '自动 (跟随系统)' : appStore.themeMode === 'dark' ? '深色模式' : '浅色模式' }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2.5">
            <button
              @click="appStore.setThemeMode('auto')"
              :class="[
                'py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer select-none',
                appStore.themeMode === 'auto'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              ]"
            >
              <ComputerDesktopIcon class="w-4 h-4" />
              <span>跟随系统</span>
            </button>
            <button
              @click="appStore.setThemeMode('light')"
              :class="[
                'py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer select-none',
                appStore.themeMode === 'light'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              ]"
            >
              <SunIcon class="w-4 h-4" />
              <span>亮白模式</span>
            </button>
            <button
              @click="appStore.setThemeMode('dark')"
              :class="[
                'py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer select-none',
                appStore.themeMode === 'dark'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              ]"
            >
              <MoonIcon class="w-4 h-4" />
              <span>暗黑模式</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 1. frpc Core Status -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-5">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Cog6ToothIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">frpc 穿透核心</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">负责在飞牛系统后台执行端口映射穿透的底层组件</p>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">检测到宿主架构:</span>
              <span class="font-mono font-bold text-zinc-900 dark:text-white uppercase">{{ frpcInfo.arch }} (Linux)</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">核心就绪状态:</span>
              <span :class="['font-bold flex items-center gap-1.5', frpcInfo.installed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500']">
                <span :class="['w-2 h-2 rounded-full inline-block', frpcInfo.installed ? 'bg-emerald-500' : 'bg-amber-500']"></span>
                <span>{{ frpcInfo.installed ? '已就绪' : '未安装 (启动时自动下载)' }}</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">程序存储路径:</span>
              <span class="font-mono text-[11px] text-zinc-400 truncate max-w-[240px]">{{ frpcInfo.path || 'bin/frpc' }}</span>
            </div>
          </div>
        </div>

        <button
          @click="handleDownloadFrpc"
          :disabled="downloadingFrpc"
          class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer border-0 shadow-xs transition-colors text-center disabled:opacity-50"
        >
          {{ downloadingFrpc ? '正在从 MSL 下载核心...' : (frpcInfo.installed ? '重新下载 / 强制更新核心' : '立即下载 frpc 核心') }}
        </button>
      </div>

      <!-- 2. Account & Token Management -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-5">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <KeyIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">账户凭证与授权</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">采用 MSL 统一授权登录，凭证持久化于本地 NAS</p>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">关联账户:</span>
              <div class="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                <span>{{ appStore.userInfo.username }}</span>
                <span v-if="appStore.userInfo.uid" class="font-mono text-zinc-400 dark:text-zinc-500 font-normal">(UID: {{ appStore.userInfo.uid }})</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">用户 UID:</span>
              <span class="font-mono font-bold text-zinc-900 dark:text-white">#{{ appStore.userInfo.uid || '未获取' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">实名认证状态:</span>
              <span :class="['font-semibold', appStore.isRealNamed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500']">
                {{ appStore.isRealNamed ? '已通过实名' : '未实名认证' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">登录状态:</span>
              <span class="font-mono text-[11px] text-zinc-400 truncate max-w-[200px]">
                {{ getAuthToken() ? '已授权登录' : '未登录' }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="handleReLogin"
            class="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-center"
          >
            重新授权登录
          </button>
          <button
            @click="appStore.logout"
            class="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer hover:bg-rose-100 transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>

      <!-- 3. Tunnel Autostart Management -->
      <div class="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <BoltIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">开机自启动隧道</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">当飞牛 NAS 或本应用后台启动时，自动唤醒并运行选中的穿透隧道</p>
            </div>
          </div>
          <span class="text-xs font-medium text-zinc-500">
            已启用 {{ tunnelsStore.autostartIds.length }} / {{ tunnelsStore.tunnels.length }} 条
          </span>
        </div>

        <div v-if="tunnelsStore.tunnels.length === 0" class="py-8 text-center text-xs text-zinc-400">
          暂无已创建的隧道，请先在“全部隧道”中新建隧道。
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          <div
            v-for="tun in tunnelsStore.tunnels"
            :key="tun.id"
            class="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between gap-3"
          >
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">{{ tun.name }}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 shrink-0">
                  {{ tun.type }}
                </span>
              </div>
              <span class="text-[11px] text-zinc-400 truncate mt-0.5">节点: {{ tun.node_name }}</span>
            </div>

            <button
              type="button"
              @click="handleToggleAutostart(tun.id)"
              :class="[
                'w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer border-0 shrink-0',
                tunnelsStore.autostartIds.includes(tun.id)
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700/80 dark:hover:bg-zinc-600 text-transparent'
              ]"
              :title="tunnelsStore.autostartIds.includes(tun.id) ? '已配置开机自启' : '未开启开机自启'"
            >
              <CheckIcon class="w-4 h-4 stroke-[3] text-white" />
            </button>
          </div>
        </div>
      </div>

      <!-- 4. 自定义域名白名单 (Domain Whitelist - Migrated from Profile as requested) -->
      <div class="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <GlobeAltIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">自定义域名白名单</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">绑定属于您自己的独立域名，添加后可在 HTTP / HTTPS 映射隧道中自由绑定子域名</p>
            </div>
          </div>
          <span class="text-xs font-medium text-zinc-500">
            已添加 {{ whitelist.length }} 个域名
          </span>
        </div>

        <!-- Add Domain Input Box -->
        <div class="flex items-center gap-2 pt-1">
          <input
            v-model="newDomainInput"
            type="text"
            placeholder="输入您的根域名，如 example.com (无需包含 http/https)"
            @keyup.enter="handleAddDomain"
            class="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-blue-500 transition-colors"
          />
          <button
            @click="handleAddDomain"
            :disabled="addingDomain || !newDomainInput.trim()"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer border-0 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
          >
            <PlusIcon class="w-4 h-4 stroke-[2.5]" />
            <span>{{ addingDomain ? '添加中...' : '添加域名' }}</span>
          </button>
        </div>

        <!-- Whitelist Domains Grid -->
        <div v-if="loadingWhitelist" class="py-8 text-center text-xs text-zinc-400">
          <div class="w-5 h-5 border-2 border-zinc-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          正在加载域名白名单...
        </div>

        <div v-else-if="whitelist.length === 0" class="py-6 text-center text-xs text-zinc-400">
          暂无已添加的白名单域名。请在上方输入框中输入您的主根域名（如 mynas.com）并点击“添加域名”。
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          <div
            v-for="item in whitelist"
            :key="item.id"
            class="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <GlobeAltIcon class="w-4 h-4 text-purple-500 shrink-0" />
              <span class="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate" :title="item.domain">
                {{ item.domain }}
              </span>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <button
                @click="copyDomain(item.domain)"
                class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 border-0 bg-transparent cursor-pointer transition-colors"
                title="复制域名"
              >
                <ClipboardDocumentIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDeleteDomain(item)"
                class="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-0 bg-transparent cursor-pointer transition-colors"
                title="从白名单中删除"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- DNS Guidelines Notice -->
        <div class="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-3 rounded-xl text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <div class="flex items-start gap-1.5">
            <InformationCircleIcon class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <strong>域名解析提示：</strong>添加根域名白名单后，请在您的域名 DNS 解析商（如阿里云、腾讯云、Cloudflare 等）将二级域名（如 <code>nas.example.com</code>）通过 <strong>CNAME</strong> 记录指向您所选穿透节点的域名，即可在新建/绑定 HTTP 隧道时生效。
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
