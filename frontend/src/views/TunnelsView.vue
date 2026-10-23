<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useTunnelsStore, FrpTunnel } from '../stores/tunnels';
import { useAppStore } from '../stores/app';
import TunnelCard from '../components/TunnelCard.vue';
import LogDrawer from '../components/LogDrawer.vue';
import CreateTunnelDialog from '../components/CreateTunnelDialog.vue';
import TunnelTrafficDialog from '../components/TunnelTrafficDialog.vue';
import {
  RocketLaunchIcon,
  ArrowPathIcon,
  PlusIcon
} from '@heroicons/vue/24/outline';

const tunnelsStore = useTunnelsStore();
const appStore = useAppStore();

const showCreateDialog = ref(false);
const showLogDrawer = ref(false);
const showTrafficDialog = ref(false);
const activeLogTunnelId = ref<number | null>(null);
const activeTrafficTunnel = ref<FrpTunnel | null>(null);
const editingTunnel = ref<FrpTunnel | null>(null);

// Tab Filter: all / running / stopped / remote
const currentFilter = ref<'all' | 'running' | 'stopped' | 'remote'>('all');

const runningCount = computed(() => {
  return tunnelsStore.tunnels.filter(t => !!tunnelsStore.statusMap[t.id]?.running).length;
});

const remoteCount = computed(() => {
  return tunnelsStore.tunnels.filter(t => !tunnelsStore.statusMap[t.id]?.running && t.status === 1).length;
});

const stoppedCount = computed(() => {
  return tunnelsStore.tunnels.filter(t => !tunnelsStore.statusMap[t.id]?.running && t.status !== 1).length;
});

const filteredTunnels = computed(() => {
  const list = tunnelsStore.tunnels;
  if (currentFilter.value === 'running') {
    return list.filter(t => !!tunnelsStore.statusMap[t.id]?.running);
  }
  if (currentFilter.value === 'stopped') {
    return list.filter(t => !tunnelsStore.statusMap[t.id]?.running && t.status !== 1);
  }
  if (currentFilter.value === 'remote') {
    return list.filter(t => !tunnelsStore.statusMap[t.id]?.running && t.status === 1);
  }
  return list;
});

let statusTimer: any = null;
let pollTick = 0;

async function loadTunnelsData() {
  if (appStore.isLoggedIn) {
    await tunnelsStore.fetchTunnels();
    await tunnelsStore.fetchNodes();
    appStore.userInfo.usedTunnels = tunnelsStore.tunnels.length;
    if (!statusTimer) {
      statusTimer = setInterval(async () => {
        pollTick++;
        await tunnelsStore.fetchLiveStatuses();
        // Periodically refresh cloud tunnel status every 9s
        if (pollTick % 3 === 0) {
          await tunnelsStore.fetchTunnels();
        }
      }, 3000);
    }
  }
}

watch(
  () => appStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      loadTunnelsData();
    } else {
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
      }
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await loadTunnelsData();
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
});

function handleCreate() {
  editingTunnel.value = null;
  showCreateDialog.value = true;
}

function handleEdit(tunnel: FrpTunnel) {
  editingTunnel.value = tunnel;
  showCreateDialog.value = true;
}

function handleViewLogs(id: number) {
  activeLogTunnelId.value = id;
  showLogDrawer.value = true;
}

function handleViewTraffic(tunnel: FrpTunnel) {
  activeTrafficTunnel.value = tunnel;
  showTrafficDialog.value = true;
}

async function handleRefresh() {
  await tunnelsStore.fetchTunnels();
  appStore.userInfo.usedTunnels = tunnelsStore.tunnels.length;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-4 sm:p-6 md:p-8">
    <!-- Header (Matching Feiniu Native Style with Subtitle) -->
    <div class="flex items-start sm:items-center justify-between gap-3 mb-4 sm:mb-5">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2.5">
          <h1 class="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight m-0 truncate">全部隧道</h1>
          <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-semibold shrink-0">
            {{ tunnelsStore.tunnels.length }} 条
          </span>
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          管理与监控当前设备上的端口映射隧道，支持实时日志与用量统计分析。
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0 whitespace-nowrap">
        <button
          @click="handleRefresh"
          class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer shadow-sm transition-colors shrink-0"
          title="刷新列表"
        >
          <ArrowPathIcon class="w-4 h-4" />
        </button>

        <!-- Primary Action Button: Blue button with white + icon -->
        <button
          @click="handleCreate"
          class="px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer border-0 transition-all shrink-0 whitespace-nowrap"
        >
          <PlusIcon class="w-4 h-4 stroke-[2.5]" />
          <span>创建隧道</span>
        </button>
      </div>
    </div>

    <!-- Tabs Segmented Filter (全部 / 已启动 / 未启动 / 远端启动) -->
    <div v-if="tunnelsStore.tunnels.length > 0" class="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 w-fit mb-5 text-xs border border-zinc-200/60 dark:border-zinc-700/50 no-scrollbar">
      <button
        @click="currentFilter = 'all'"
        :class="[
          'h-8 px-3.5 rounded-xl font-semibold cursor-pointer border-0 transition-all flex items-center gap-1.5 whitespace-nowrap leading-none select-none',
          currentFilter === 'all'
            ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <span>全部</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none flex items-center justify-center" :class="currentFilter === 'all' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'">
          {{ tunnelsStore.tunnels.length }}
        </span>
      </button>

      <button
        @click="currentFilter = 'running'"
        :class="[
          'h-8 px-3.5 rounded-xl font-semibold cursor-pointer border-0 transition-all flex items-center gap-1.5 whitespace-nowrap leading-none select-none',
          currentFilter === 'running'
            ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span>已启动</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none flex items-center justify-center" :class="currentFilter === 'running' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'">
          {{ runningCount }}
        </span>
      </button>

      <button
        @click="currentFilter = 'stopped'"
        :class="[
          'h-8 px-3.5 rounded-xl font-semibold cursor-pointer border-0 transition-all flex items-center gap-1.5 whitespace-nowrap leading-none select-none',
          currentFilter === 'stopped'
            ? 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0"></span>
        <span>未启动</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none flex items-center justify-center" :class="currentFilter === 'stopped' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'">
          {{ stoppedCount }}
        </span>
      </button>

      <button
        @click="currentFilter = 'remote'"
        :class="[
          'h-8 px-3.5 rounded-xl font-semibold cursor-pointer border-0 transition-all flex items-center gap-1.5 whitespace-nowrap leading-none select-none',
          currentFilter === 'remote'
            ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
        <span>远端启动</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none flex items-center justify-center" :class="currentFilter === 'remote' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'">
          {{ remoteCount }}
        </span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="tunnelsStore.loading && tunnelsStore.tunnels.length === 0" class="flex flex-col items-center justify-center py-24 gap-3">
      <div class="w-8 h-8 border-3 border-zinc-200 dark:border-zinc-700 border-t-blue-600 rounded-full animate-spin"></div>
      <span class="text-xs text-zinc-400">正在拉取您的隧道列表...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="tunnelsStore.tunnels.length === 0" class="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
        <RocketLaunchIcon class="w-8 h-8 stroke-[1.5]" />
      </div>
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-bold text-zinc-800 dark:text-zinc-200 m-0">暂无任何穿透隧道</h3>
        <p class="text-xs text-zinc-400 m-0 max-w-sm">点击右上角“创建隧道”即可为您的 NAS 服务建立一条公网穿透隧道。</p>
      </div>
      <button
        @click="handleCreate"
        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold border-0 cursor-pointer shadow-sm transition-colors mt-2"
      >
        立即新建隧道
      </button>
    </div>

    <!-- Tunnel Cards Grid -->
    <div v-else-if="filteredTunnels.length > 0" class="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-12">
      <TunnelCard
        v-for="tunnel in filteredTunnels"
        :key="tunnel.id"
        :tunnel="tunnel"
        :live-status="tunnelsStore.statusMap[tunnel.id]"
        @refresh="handleRefresh"
        @view-logs="handleViewLogs"
        @view-traffic="handleViewTraffic"
        @edit="handleEdit"
      />
    </div>

    <!-- Filter Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 gap-2 text-zinc-400 text-xs text-center">
      <p class="m-0 font-medium">当前分类下暂无匹配的隧道</p>
      <button
        @click="currentFilter = 'all'"
        class="text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-0 cursor-pointer text-xs mt-1"
      >
        查看全部隧道
      </button>
    </div>

    <!-- Create / Edit Dialog -->
    <CreateTunnelDialog
      v-model:visible="showCreateDialog"
      :edit-tunnel="editingTunnel"
      @success="handleRefresh"
    />

    <!-- Live Logs Drawer -->
    <LogDrawer
      v-model:visible="showLogDrawer"
      :tunnel-id="activeLogTunnelId"
    />

    <!-- Tunnel Traffic Trend Dialog -->
    <TunnelTrafficDialog
      v-model:visible="showTrafficDialog"
      :tunnel="activeTrafficTunnel"
    />
  </div>
</template>
