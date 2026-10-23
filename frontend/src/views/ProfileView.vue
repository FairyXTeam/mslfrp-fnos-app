<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { get, post } from '../api/client';
import { useAppStore } from '../stores/app';
import { useTunnelsStore } from '../stores/tunnels';
import TrafficChart from '../components/common/TrafficChart.vue';
import {
  UserCircleIcon,
  KeyIcon,
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();
const tunnelsStore = useTunnelsStore();

// --- 1. User Info Formatting ---
const totalUsedTrafficMB = computed(() => {
  return tunnelsStore.tunnels.reduce((acc, t) => acc + (t.total_traffic || 0), 0);
});

function formatTraffic(mb: number) {
  if (!mb || mb <= 0) return '0 MB';
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  if (mb < 1024 * 1024) return (mb / 1024).toFixed(2) + ' GB';
  return (mb / (1024 * 1024)).toFixed(2) + ' TB';
}

function formatTimestamp(ts: number | string) {
  if (!ts) return '永久有效';
  const num = Number(ts);
  // Default MSL fallback timestamp 3749682420 -> 2088-10-27 10:27:00
  const date = new Date(num > 1e11 ? num : num * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// --- 2. My Token ---
const showToken = ref(false);
const resettingToken = ref(false);

const maskedToken = computed(() => {
  const token = appStore.userInfo.frpToken;
  if (!token) return '未生成 Frp 系统 Token';
  if (showToken.value) return token;
  if (token.length <= 8) return '••••••••••••';
  return token.substring(0, 4) + '••••••••••••••••' + token.substring(token.length - 4);
});

function copyToken() {
  if (!appStore.userInfo.frpToken) {
    toast.warning('暂无可用的 Token');
    return;
  }
  navigator.clipboard.writeText(appStore.userInfo.frpToken);
  toast.success('Frp 系统 Token 已复制到剪贴板');
}

async function handleResetToken() {
  const confirmed = await confirmModal({
    title: '确认重置 Token',
    message: '确定要重置 Token 吗？这会导致您所有正在运行的客户端掉线！',
    confirmText: '确定重置',
    cancelText: '取消',
    type: 'danger'
  });

  if (!confirmed) return;

  resettingToken.value = true;
  try {
    const res = await get('/api/frp/resetToken');
    if (res && res.code === 200) {
      toast.success(res.msg || 'Frp 用户 Token 重置成功！');
      await appStore.refreshFrpInfo();
    } else {
      toast.error(res?.msg || '重置 Token 失败');
    }
  } catch (err: any) {
    toast.error(err.message || '重置请求发生异常');
  } finally {
    resettingToken.value = false;
  }
}

// --- 3. Domain Whitelist ---
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
  const domain = newDomainInput.value.trim();
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

onMounted(async () => {
  await Promise.all([
    appStore.refreshFrpInfo(),
    tunnelsStore.fetchTunnels(),
    fetchWhitelist()
  ]);
});
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-4 sm:p-6 md:p-8">
    <!-- Header -->
    <div class="flex items-start sm:items-center justify-between gap-3 mb-6">
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight m-0">个人中心</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          管理 MSLFrp 个人配额、Frp 系统密钥、域名白名单以及全局网络流量统计。
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <a
          href="https://user.mslmc.net/user/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs no-underline"
          title="在新窗口打开 MSL 用户中心官网"
        >
          <ArrowTopRightOnSquareIcon class="w-4 h-4" />
          <span>MSL 用户中心</span>
        </a>

        <button
          @click="appStore.refreshFrpInfo(); fetchWhitelist(); tunnelsStore.fetchTunnels()"
          class="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
        >
          <ArrowPathIcon class="w-4 h-4" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-6 pb-12">
      <!-- 1. MSLFrp 用户信息 (6-Grid Metrics fnOS Native Card) -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-5">
        <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserCircleIcon class="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">MSLFrp 用户信息</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">当前登录账户的映射服务资源与配额详情</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="appStore.isRealNamed"
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1"
            >
              <ShieldCheckIcon class="w-3.5 h-3.5" />
              已实名
            </span>
            <span
              v-else
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              免实名
            </span>
          </div>
        </div>

        <!-- 6 Metrics Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <!-- 用户名 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">用户名</span>
            <span class="text-sm font-bold text-zinc-900 dark:text-white truncate" :title="appStore.userInfo.username">
              {{ appStore.userInfo.username }}
            </span>
          </div>

          <!-- 隧道数 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">隧道数</span>
            <div class="flex items-baseline gap-1">
              <span class="text-base font-bold text-blue-600 dark:text-blue-400">{{ tunnelsStore.tunnels.length }}</span>
              <span class="text-xs text-zinc-400">/ {{ appStore.userInfo.maxTunnels }}</span>
            </div>
          </div>

          <!-- 用户组 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">用户组</span>
            <span class="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
              {{ appStore.userInfo.userGroupName || '普通用户' }}
            </span>
          </div>

          <!-- 限速 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">限速</span>
            <span class="text-sm font-bold text-zinc-900 dark:text-white">
              {{ appStore.userInfo.boundLimit || 100 }} Mbps
            </span>
          </div>

          <!-- 已用流量 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">已用流量</span>
            <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {{ formatTraffic(totalUsedTrafficMB) }}
            </span>
          </div>

          <!-- 过期时间 -->
          <div class="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-1">
            <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">过期时间</span>
            <span class="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate" :title="formatTimestamp(appStore.userInfo.vipOutdated)">
              {{ formatTimestamp(appStore.userInfo.vipOutdated) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. 我的 Token Card -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <KeyIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">我的 Token</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">Frp 系统通信密钥，用于客户端与映射中心服务端安全建立连接</p>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <span class="font-mono text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate select-all">
              {{ maskedToken }}
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="showToken = !showToken"
              class="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              :title="showToken ? '隐藏 Token' : '显示 Token'"
            >
              <EyeSlashIcon v-if="showToken" class="w-4 h-4" />
              <EyeIcon v-else class="w-4 h-4" />
            </button>
            <button
              @click="copyToken"
              class="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardDocumentIcon class="w-4 h-4 text-zinc-400" />
              <span>复制 Token</span>
            </button>
            <button
              @click="handleResetToken"
              :disabled="resettingToken"
              class="px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowPathIcon class="w-4 h-4" :class="{ 'animate-spin': resettingToken }" />
              <span>{{ resettingToken ? '重置中...' : '重置 Token' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 3. 域名白名单 Card -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GlobeAltIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">域名白名单</h3>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {{ whitelist.length }} 个域名
                </span>
              </div>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">国内大陆穿透节点 HTTP/HTTPS 建站域名白名单报备管理</p>
            </div>
          </div>
        </div>

        <!-- Tip Box -->
        <div class="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 leading-relaxed flex items-start gap-2">
          <InformationCircleIcon class="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div>
            <strong>温馨提示：</strong>若需要使用中国大陆的节点建站，需要将根域名添加到白名单。若已备案仍提示未备案，请邮件联系
            <a href="mailto:support@mslmc.net" class="text-blue-600 dark:text-blue-400 font-semibold underline hover:text-blue-700">support@mslmc.net</a> 进行人工添加。
          </div>
        </div>

        <!-- Add Input Field -->
        <div class="flex gap-2">
          <input
            v-model="newDomainInput"
            @keyup.enter="handleAddDomain"
            type="text"
            placeholder="请输入需要添加的根域名，例如: example.com"
            class="flex-1 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400"
          />
          <button
            @click="handleAddDomain"
            :disabled="addingDomain"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer border-0 shadow-2xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <PlusIcon class="w-4 h-4" />
            <span>{{ addingDomain ? '添加中...' : '添加域名' }}</span>
          </button>
        </div>

        <!-- Whitelist Domain List -->
        <div v-if="loadingWhitelist" class="py-6 text-center text-xs text-zinc-400">
          正在加载白名单域名列表...
        </div>

        <div v-else-if="whitelist.length === 0" class="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          暂无已添加的白名单域名，如需在大陆节点搭建 Web 服务请输入根域名添加。
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          <div
            v-for="item in whitelist"
            :key="item.id"
            class="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span class="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{{ item.domain }}</span>
              <span class="text-[10px] font-mono text-zinc-400 shrink-0">#{{ item.id }}</span>
            </div>
            <button
              @click="handleDeleteDomain(item)"
              class="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border-0 bg-transparent shrink-0"
              title="删除此域名"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- 4. 全局流量统计分析 Card (Refined without dense dots) -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm">
        <TrafficChart
          api-url="/api/frp/traffic/tunnel"
          title="全局流量统计分析"
          subtitle="全节点、全隧道实时与历史传输流量监控分析"
          :height="230"
        />
      </div>
    </div>
  </div>
</template>
