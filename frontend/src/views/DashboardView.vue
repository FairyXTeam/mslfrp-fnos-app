<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { get } from '../api/client';
import { useAppStore } from '../stores/app';
import { useTunnelsStore } from '../stores/tunnels';
import TrafficChart from '../components/common/TrafficChart.vue';
import AdRewardModal from '../components/AdRewardModal.vue';
import BaseModal from '../components/common/BaseModal.vue';
import MarkdownPreview from '../components/common/MarkdownPreview.vue';
import {
  RocketLaunchIcon,
  ComputerDesktopIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  GiftIcon,
  UserGroupIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();
const tunnelsStore = useTunnelsStore();

// --- 1. Dynamic Greeting & Weather ---
const showAdRewardModal = ref(false);
const weatherText = ref('晴');
const weatherTemp = ref('');
const weatherCity = ref('');
const weatherTip = ref('今天也要开开心心哦～');
const weatherIcon = ref('☀️');

const welcomeGreeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 6) return '夜深了';
  if (hour >= 6 && hour < 12) return '早上好';
  if (hour >= 12 && hour < 18) return '下午好';
  return '晚上好';
});

function getWeatherEmoji(text?: string): string {
  if (!text) return '☀️';
  if (text.includes('晴')) return '☀️';
  if (text.includes('多云')) return '⛅';
  if (text.includes('阴')) return '☁️';
  if (text.includes('雷')) return '⛈️';
  if (text.includes('雨')) return '🌧️';
  if (text.includes('雪')) return '❄️';
  if (text.includes('雾') || text.includes('霾')) return '🌫️';
  if (text.includes('风')) return '🌬️';
  return '🌤️';
}

async function fetchWeather() {
  try {
    const ipRes = await get('/api/tools/ip');
    let city = '佛山市';
    if (ipRes && ipRes.code === 200 && ipRes.data) {
      if (typeof ipRes.data === 'object' && ipRes.data.city) {
        city = ipRes.data.city;
      }
    }

    const weatherRes = await get(`/api/tools/weather?city=${encodeURIComponent(city)}`);
    if (weatherRes && weatherRes.code === 200 && weatherRes.data) {
      const d = weatherRes.data;
      weatherCity.value = d.city || city;
      weatherText.value = d.weather || '晴';
      weatherTemp.value = d.temperature !== undefined ? `${d.temperature}℃` : '';
      weatherIcon.value = getWeatherEmoji(d.weather);
      weatherTip.value = d.tip || '保持好心情，工作学习更高效～';
    } else {
      weatherCity.value = '在线';
      weatherIcon.value = '☀️';
      weatherTip.value = '今天也要开开心心哦～';
    }
  } catch {
    weatherCity.value = '在线';
    weatherIcon.value = '☀️';
    weatherTip.value = '今天也要开开心心哦～';
  }
}

// --- 2. Quote (Hitokoto / 一言) ---
const hitokotoQuote = ref('见鬼去吧！ —— 《我的世界》(恶魂)');

async function fetchHitokoto() {
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=a&c=b&c=c&c=d');
    if (res.ok) {
      const data = await res.json();
      hitokotoQuote.value = `${data.hitokoto} —— 《${data.from}》${data.from_who ? ` (${data.from_who})` : ''}`;
    }
  } catch {
    hitokotoQuote.value = '愿世间每一只小生灵，都能找到属于自己的乐土。 —— 《我的世界》';
  }
}

// --- 3. Core Metrics Formatting ---
const activeTunnelsCount = computed(() => {
  return tunnelsStore.activeCount;
});

const totalUsedTrafficMB = computed(() => {
  return tunnelsStore.tunnels.reduce((acc, t) => acc + (t.total_traffic || 0), 0);
});

const todayTrafficMB = computed(() => {
  return tunnelsStore.tunnels.reduce((acc, t) => acc + (t.today_traffic || 0), 0);
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
  const date = new Date(num > 1e11 ? num : num * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${d}-${m}`;
}

// --- 4. My Token Management ---
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

// --- 5. Announcement (fnosNoticeMd) & Modal Notification ---
const noticeContent = ref('');
const noticeLoading = ref(false);
const showNoticeModal = ref(false);
const hasPendingNoticeModal = ref(false);
const currentNoticeHash = ref('');

function simpleNoticeHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'notice_' + Math.abs(hash).toString(36) + '_' + str.length;
}

async function fetchNotice(manual = false) {
  noticeLoading.value = true;
  try {
    const res = await axios.get('https://api.mslmc.cn/v3/query/notice?query=fnosNoticeMd', {
      timeout: 10000
    });
    if (res.data && res.data.code === 200 && res.data.data) {
      const content = res.data.data.fnosNoticeMd || '';
      noticeContent.value = content;
      if (content.trim()) {
        const hash = simpleNoticeHash(content.trim());
        currentNoticeHash.value = hash;
        const cfg = await appStore.fetchAppConfig();
        const lastHash = cfg?.lastNoticeHash;

        if (manual) {
          toast.success('服务动态已更新');
        } else if (hash !== lastHash) {
          // Announcement updated or never seen before
          if (appStore.showLoginDialog) {
            // Login dialog has higher priority; defer notice modal until login modal closes
            hasPendingNoticeModal.value = true;
          } else {
            showNoticeModal.value = true;
          }
        }
      }
    } else if (manual) {
      toast.info('暂无最新服务动态');
    }
  } catch (err: any) {
    console.error('Fetch notice error:', err);
    if (manual) {
      toast.error('获取服务动态失败');
    }
  } finally {
    noticeLoading.value = false;
  }
}

// Watch login dialog: when closed, show pending notice modal
watch(
  () => appStore.showLoginDialog,
  (isOpen) => {
    if (!isOpen && hasPendingNoticeModal.value) {
      setTimeout(() => {
        if (!appStore.showLoginDialog && hasPendingNoticeModal.value) {
          showNoticeModal.value = true;
          hasPendingNoticeModal.value = false;
        }
      }, 300);
    }
  }
);

function dismissNoticeModal() {
  showNoticeModal.value = false;
  if (currentNoticeHash.value) {
    appStore.updateAppConfig({ lastNoticeHash: currentNoticeHash.value });
  }
}

watch(showNoticeModal, (val) => {
  if (!val && currentNoticeHash.value) {
    appStore.updateAppConfig({ lastNoticeHash: currentNoticeHash.value });
  }
});

onMounted(async () => {
  await Promise.all([
    appStore.refreshFrpInfo(),
    tunnelsStore.fetchTunnels(),
    fetchWeather(),
    fetchHitokoto(),
    fetchNotice()
  ]);
});
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-2 sm:p-3 md:p-4 select-none">
    <div class="flex flex-col gap-4 sm:gap-5 pb-12">
      <!-- 1. 欢迎 Banner (Matching Image 1: Avatar + Greeting + Real-name Badge + Weather + Earn Points Button) -->
      <div class="relative w-full p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 overflow-hidden">
        <!-- Background subtle tint -->
        <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <!-- Left: Avatar & Greeting & Real-name Tag -->
        <div class="flex items-center gap-4 z-10 min-w-0">
          <!-- Circular Avatar with Subtle Ring & Online Badge -->
          <div class="relative shrink-0">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-blue-500/25 via-indigo-500/15 to-emerald-400/25 shadow-xs">
              <img
                :src="appStore.userInfo.avatar"
                alt="Avatar"
                class="w-full h-full rounded-full object-cover ring-2 ring-white dark:ring-zinc-900 bg-zinc-100 dark:bg-zinc-800"
                onerror="this.src='https://www.mslmc.cn/logo.png'"
              />
            </div>
            <span
              class="absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full shadow-2xs"
              title="在线"
            >
              <span class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40"></span>
            </span>
          </div>

          <div class="flex flex-col gap-1.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white m-0 tracking-tight flex items-center">
                <span>{{ welcomeGreeting }}，</span>
                <span class="text-blue-600 dark:text-blue-400 font-extrabold">{{ appStore.userInfo.username }}</span>
              </h2>

              <!-- Real Name Badge -->
              <span
                v-if="appStore.isRealNamed"
                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
              >
                <ShieldCheckIcon class="w-3.5 h-3.5" />
                <span>账户已实名</span>
              </span>
              <span
                v-else
                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
              >
                <span>未实名认证</span>
              </span>
            </div>

            <!-- Weather & Care tip line -->
            <div class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium text-[11px] shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                {{ weatherIcon }} {{ weatherCity }} {{ weatherText }} {{ weatherTemp }}
              </span>
              <span class="text-[11px] text-zinc-400 dark:text-zinc-500 truncate" :title="weatherTip">
                {{ weatherTip }}
              </span>
            </div>
          </div>
        </div>

        <!-- Right: Earn Points Action Button -->
        <div class="z-10 w-full md:w-auto flex items-center justify-end">
          <button
            @click="showAdRewardModal = true"
            class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer border-0 transition-all"
            title="领取免费积分"
          >
            <GiftIcon class="w-4 h-4 stroke-[2.2]" />
            <span>赚积分</span>
          </button>
        </div>
      </div>

      <!-- 2. 一言格言条 (Hitokoto / MC Quote) -->
      <div class="w-full p-3.5 sm:px-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center gap-3 transition-colors">
        <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ChatBubbleLeftRightIcon class="w-4 h-4" />
        </div>
        <p class="text-zinc-600 dark:text-zinc-400 font-medium italic m-0 text-xs sm:text-sm truncate" :title="hitokotoQuote">
          {{ hitokotoQuote }}
        </p>
      </div>

      <!-- 3. 核心指标看板 (标题与数据同排横向展示，超低高度，窄屏固定2行3列) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2.5 sm:gap-3">
        <!-- Metric 1: 运行中隧道 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-emerald-400/60 transition-colors"
          :title="`本机运行: ${tunnelsStore.runningCount} | 远端在线: ${tunnelsStore.remoteCount}`"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <RocketLaunchIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">运行中隧道</span>
          </div>
          <div class="flex items-baseline gap-1 shrink-0 font-mono">
            <span class="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
              {{ tunnelsStore.activeCount }}
            </span>
            <span class="text-xs text-zinc-400 font-normal">/ {{ tunnelsStore.tunnels.length }}</span>
          </div>
        </div>

        <!-- Metric 2: 隧道配额 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-blue-400/60 transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ComputerDesktopIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">隧道配额</span>
          </div>
          <div class="flex items-baseline gap-1 shrink-0 font-mono">
            <span class="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
              {{ tunnelsStore.tunnels.length }}
            </span>
            <span class="text-xs text-zinc-400 font-normal">/ {{ appStore.userInfo.maxTunnels }}</span>
          </div>
        </div>

        <!-- Metric 3: 当前可用积分 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-amber-400/60 transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shrink-0">
              <GiftIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">当前积分</span>
          </div>
          <span class="text-sm sm:text-base font-bold font-mono text-zinc-900 dark:text-white shrink-0 truncate">
            {{ appStore.userInfo.score }}
          </span>
        </div>

        <!-- Metric 4: 会员级别 / 用户组 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-purple-400/60 transition-colors"
          :title="appStore.userInfo.isVip ? `会员有效期至 ${formatTimestamp(appStore.userInfo.vipOutdated)}` : ''"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center shrink-0">
              <UserGroupIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">用户组</span>
          </div>
          <span class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white shrink-0 truncate max-w-[120px]">
            {{ appStore.userInfo.userGroupName || '普通用户' }}
          </span>
        </div>

        <!-- Metric 5: 穿透带宽限速 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-cyan-400/60 transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <BoltIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">映射限速</span>
          </div>
          <div class="flex items-baseline gap-1 shrink-0 font-mono">
            <span class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
              {{ appStore.userInfo.boundLimit || 100 }}
            </span>
            <span class="text-xs text-zinc-400 font-normal font-sans">Mbps</span>
          </div>
        </div>

        <!-- Metric 6: 累计已用流量 -->
        <div
          class="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-2.5 hover:border-emerald-400/60 transition-colors"
          :title="`今日流量: ${formatTraffic(todayTrafficMB)}`"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowTrendingUpIcon class="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">累计流量</span>
          </div>
          <span class="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 shrink-0 truncate">
            {{ formatTraffic(totalUsedTrafficMB) }}
          </span>
        </div>
      </div>

      <!-- 3.5. 仪表盘服务动态卡片 (6个数据卡片正下方) -->
      <div class="p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-3 transition-colors">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MegaphoneIcon class="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">
                服务动态
              </h3>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              @click="fetchNotice(true)"
              :disabled="noticeLoading"
              class="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
              title="刷新动态"
            >
              <ArrowPathIcon class="w-3.5 h-3.5" :class="{ 'animate-spin': noticeLoading }" />
            </button>
          </div>
        </div>

        <!-- Card Body -->
        <div v-if="noticeLoading && !noticeContent" class="py-6 flex items-center justify-center text-xs text-zinc-400 gap-2">
          <ArrowPathIcon class="w-4 h-4 animate-spin text-blue-500" />
          <span>正在加载服务动态...</span>
        </div>
        <div v-else-if="noticeContent" class="text-xs">
          <MarkdownPreview :content="noticeContent" editor-id="fnos-notice-dashboard" />
        </div>
        <div v-else class="py-6 text-center text-xs text-zinc-400">
          暂无最新动态
        </div>
      </div>

      <!-- 4. 流量趋势图卡片 -->
      <div class="p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col overflow-hidden">
        <TrafficChart api-url="/api/frp/traffic/tunnel" title="MSLFrp 流量概览" :height="220" />
      </div>

      <!-- 5. 我的 Token 密钥管理卡片 -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-6 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <KeyIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">我的 Token 通信密钥</h3>
              <p class="text-[11px] text-zinc-400 m-0 mt-0.5">Frp 系统通信身份密钥，用于客户端与映射中心服务端安全建立连接通道</p>
            </div>
          </div>
        </div>

        <div class="p-3 sm:p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <span class="font-mono text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate select-all">
              {{ maskedToken }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
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
              class="px-2.5 sm:px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ClipboardDocumentIcon class="w-4 h-4 text-zinc-400" />
              <span>复制</span>
            </button>
            <button
              @click="handleResetToken"
              :disabled="resettingToken"
              class="px-2.5 sm:px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowPathIcon class="w-4 h-4" :class="{ 'animate-spin': resettingToken }" />
              <span>{{ resettingToken ? '重置中...' : '重置 Token' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 6. 关于卡片 (About Card - Requested by User) -->
      <div class="p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3.5">
          <div class="flex items-center gap-3">
            <img src="../assets/logo.png" onerror="this.src='./images/icon_64.png'" alt="MSL" class="w-8 h-8 rounded-xl object-contain drop-shadow-xs" />
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">关于 MSLFrp 内网映射客户端</h3>
              <p class="text-[11px] text-zinc-400 m-0 mt-0.5">飞牛私有云 (fnOS) Native 客户端</p>
            </div>
          </div>
          <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
            v1.0.0
          </span>
        </div>

        <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed m-0">
          MSLFrp 内网映射是由 <strong>FairyXTeam</strong> 与 <strong>广州兮辰云科技有限公司</strong> 联合运营的高性能端口映射穿透服务。专为 NAS、个人游戏服务器、开发调试等场景打造，开箱即用，支持多架构原生硬件直连。
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-0.5">
            <span class="text-zinc-400 text-[10px]">客户端版本</span>
            <span class="font-mono font-semibold text-zinc-800 dark:text-zinc-200">1.0.0 (Native)</span>
          </div>

          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-0.5">
            <span class="text-zinc-400 text-[10px]">联合运营团队</span>
            <span class="font-semibold text-zinc-800 dark:text-zinc-200">FairyX Team & 兮辰云</span>
          </div>

          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-0.5">
            <span class="text-zinc-400 text-[10px]">工信部 ICP 备案</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="font-mono text-zinc-700 dark:text-zinc-300 hover:text-blue-600 no-underline truncate">
              粤ICP备2023129252号-3
            </a>
          </div>

          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-0.5">
            <span class="text-zinc-400 text-[10px]">增值电信业务许可</span>
            <span class="font-mono text-zinc-700 dark:text-zinc-300 truncate" title="B1-20251563">
              B1-20251563
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2 text-[11px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/60 flex-wrap">
          <span>Copyright © FairyXTeam 2021-2026. All rights reserved.</span>
          <div class="flex items-center gap-3">
            <a href="https://user.mslmc.net" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors no-underline">
              官方网站
            </a>
            <span class="opacity-30">·</span>
            <a href="https://github.com/FairyXTeam/mslfrp-fnos-app" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors no-underline">
              GitHub
            </a>
            <span class="opacity-30">·</span>
            <a href="https://xicheny.com" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors no-underline">
              兮辰云科技
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Ad Reward (Earn Points) WeChat Modal -->
    <AdRewardModal v-model="showAdRewardModal" />

    <!-- Notice Popup Modal (弹窗 - 登录弹窗优先级高于服务动态，内容不变只弹一次) -->
    <BaseModal
      v-model="showNoticeModal"
      title="服务动态"
      max-width="max-w-xl"
    >
      <div class="max-h-[60vh] overflow-y-auto py-1 pr-1">
        <MarkdownPreview
          v-if="noticeContent"
          :content="noticeContent"
          editor-id="fnos-notice-popup"
        />
        <div v-else class="py-8 text-center text-xs text-zinc-400">
          暂无动态内容
        </div>
      </div>

      <template #footer>
        <button
          @click="dismissNoticeModal"
          class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer border-0"
        >
          我知道了
        </button>
      </template>
    </BaseModal>
  </div>
</template>
