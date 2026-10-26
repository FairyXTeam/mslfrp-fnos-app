<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { useTunnelsStore } from '../stores/tunnels';
import {
  CommandLineIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  ComputerDesktopIcon,
  CheckIcon,
  EllipsisHorizontalIcon,
  BoltIcon,
  ArrowTrendingUpIcon
} from '@heroicons/vue/24/outline';
import { PlayIcon, StopIcon } from '@heroicons/vue/24/solid';

const props = defineProps<{
  tunnel: {
    id: number;
    name: string;
    node_id: number;
    node_name: string;
    node_domain?: string;
    node_ip?: string;
    addr_domain?: string;
    addr_ip?: string;
    protocol: string;
    local_ip: string;
    local_port: number;
    remote_port: number;
    type: string;
    today_traffic: number;
    total_traffic: number;
    status: number;
    ban?: string | null;
  };
  liveStatus?: {
    running: boolean;
    pid?: number | null;
    uptime?: number;
    startedAt?: string;
  };
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'view-logs', id: number): void;
  (e: 'view-traffic', tunnel: any): void;
  (e: 'edit', tunnel: any): void;
}>();

const tunnelsStore = useTunnelsStore();

const starting = ref(false);
const stopping = ref(false);
const menuOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// Status checks
const isLocalRunning = computed(() => !!props.liveStatus?.running);
const isCloudRunning = computed(() => !isLocalRunning.value && props.tunnel.status === 1);
const isRunning = computed(() => isLocalRunning.value || isCloudRunning.value);
const isBanned = computed(() => props.tunnel.ban !== null && props.tunnel.ban !== undefined);
const isAutostart = computed(() => tunnelsStore.autostartIds.includes(props.tunnel.id));

async function handleToggleAutostart() {
  try {
    const newState = await tunnelsStore.toggleAutostart(props.tunnel.id);
    toast.success(newState ? `已开启隧道 [${props.tunnel.name}] 开机自启动` : `已关闭隧道 [${props.tunnel.name}] 开机自启动`);
  } catch (err: any) {
    toast.error(err.message || '设置自启动失败');
  }
}

// Addresses formatted accurately matching msluserpanel
const primaryAddr = computed(() => {
  if (props.tunnel.addr_domain) return props.tunnel.addr_domain;
  if (props.tunnel.node_domain) return `${props.tunnel.node_domain}:${props.tunnel.remote_port}`;
  return '';
});

const secondaryAddr = computed(() => {
  if (props.tunnel.addr_ip) return props.tunnel.addr_ip;
  if (props.tunnel.node_ip) return `${props.tunnel.node_ip}:${props.tunnel.remote_port}`;
  return '';
});

function handleOutsideClick(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick);
});

async function toggleTunnel() {
  if (isLocalRunning.value) {
    stopping.value = true;
    try {
      await tunnelsStore.stopTunnel(props.tunnel.id);
      toast.success(`隧道 [${props.tunnel.name}] 已停止`);
      emit('refresh');
    } catch (err: any) {
      toast.error(err.message || '停止失败');
    } finally {
      stopping.value = false;
    }
  } else {
    starting.value = true;
    try {
      await tunnelsStore.startTunnel(props.tunnel.id);
      toast.success(`隧道 [${props.tunnel.name}] 启动成功！`);
      emit('refresh');
    } catch (err: any) {
      toast.error(err.message || '启动失败');
    } finally {
      starting.value = false;
    }
  }
}

async function handleDelete() {
  const confirmed = await confirmModal({
    title: '确认删除隧道',
    message: `确定要删除隧道 "${props.tunnel.name}" 吗？此操作不可恢复。`,
    confirmText: '删除',
    cancelText: '取消',
    type: 'danger'
  });

  if (!confirmed) return;

  try {
    await tunnelsStore.deleteTunnel(props.tunnel.id);
    toast.success('隧道已删除');
    emit('refresh');
  } catch (err: any) {
    toast.error(err.message || '删除失败');
  }
}

function copyToClipboard(text: string, label: string) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success(`${label}已复制到剪贴板`);
}

function formatTraffic(mb: number) {
  if (!mb || mb <= 0) return '0 MB';
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  if (mb < 1024 * 1024) return (mb / 1024).toFixed(2) + ' GB';
  return (mb / (1024 * 1024)).toFixed(2) + ' TB';
}
</script>

<template>
  <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-blue-500/50 dark:hover:border-blue-500/40 shadow-xs hover:shadow-md transition-all select-none flex flex-col justify-between gap-3.5">
    <!-- Row 1: Header (Icon + Name + Type + Status + More Menu) -->
    <div class="flex items-center justify-between gap-3">
      <!-- Left: Icon & Service Name & Type -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Icon Container with Real-time Status Dot Badge -->
        <div class="relative w-10 h-10 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ComputerDesktopIcon class="w-5 h-5 stroke-[1.8]" />

          <!-- Real-time Status Dot Badge -->
          <span
            v-if="isLocalRunning"
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-2xs flex items-center justify-center text-white"
            title="本机运行中"
          >
            <CheckIcon class="w-2 h-2 stroke-[3]" />
          </span>
          <span
            v-else-if="isCloudRunning"
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-2xs flex items-center justify-center"
            title="远端在线"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          </span>
          <span
            v-else-if="starting"
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ring-2 ring-white dark:ring-zinc-900"
          ></span>
          <span
            v-else-if="isBanned"
            class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-600 ring-2 ring-white dark:ring-zinc-900"
            title="隧道已封禁"
          ></span>
          <span
            v-else
            class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 ring-2 ring-white dark:ring-zinc-900"
            title="未运行"
          ></span>
        </div>

        <div class="flex items-center gap-2 min-w-0 flex-1">
          <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate m-0" :title="tunnel.name">
            {{ tunnel.name }}
          </h3>
          <span class="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
            {{ tunnel.type }}
          </span>
        </div>
      </div>

      <!-- Right: Status Badge & More Options Menu -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Status Badge Pill -->
        <span
          v-if="isLocalRunning"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/40"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>本机运行中</span>
        </span>
        <span
          v-else-if="isCloudRunning"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-200/60 dark:border-blue-800/40"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span>远端在线</span>
        </span>
        <span
          v-else-if="isBanned"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200/60 dark:border-purple-800/40"
        >
          <span>已封禁</span>
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600"></span>
          <span>未运行</span>
        </span>

        <!-- Dropdown Menu Popover -->
        <div class="relative" ref="dropdownRef">
          <button
            @click.stop="menuOpen = !menuOpen"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors border-0 bg-transparent cursor-pointer"
            title="更多操作"
          >
            <EllipsisHorizontalIcon class="w-4 h-4 stroke-[2]" />
          </button>

          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl py-1 z-30 flex flex-col overflow-hidden"
              @click.stop
            >
              <button
                @click="menuOpen = false; emit('view-logs', tunnel.id)"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <CommandLineIcon class="w-4 h-4 text-zinc-400" />
                <span>查看实时日志</span>
              </button>
              <button
                @click="menuOpen = false; emit('view-traffic', tunnel)"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <ArrowTrendingUpIcon class="w-4 h-4 text-emerald-500" />
                <span>查看流量统计</span>
              </button>
              <button
                v-if="secondaryAddr && secondaryAddr !== primaryAddr"
                @click="menuOpen = false; copyToClipboard(secondaryAddr, '备用IP地址')"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <ClipboardDocumentIcon class="w-4 h-4 text-zinc-400" />
                <span>复制备用直连IP</span>
              </button>
              <button
                @click="menuOpen = false; handleToggleAutostart()"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center justify-between border-0 bg-transparent cursor-pointer transition-colors"
              >
                <div class="flex items-center gap-2">
                  <BoltIcon class="w-4 h-4 text-amber-500" />
                  <span>开机自启动</span>
                </div>
                <span
                  :class="isAutostart ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'"
                  class="text-[10px] px-1.5 py-0.5 rounded"
                >
                  {{ isAutostart ? '已开启' : '已关闭' }}
                </span>
              </button>
              <div class="h-px bg-zinc-100 dark:bg-zinc-700 my-1"></div>
              <button
                @click="menuOpen = false; handleDelete()"
                class="w-full px-3 py-2 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <TrashIcon class="w-4 h-4" />
                <span>删除隧道</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Row 2: Clean Public Address Hero (Unboxed, fluid & prominent) -->
    <div
      class="group flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
      @click="copyToClipboard(primaryAddr, '连接地址')"
      title="点击直接复制公网连接地址"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">公网:</span>
        <span class="text-xs sm:text-sm font-bold font-mono text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate select-all">
          {{ primaryAddr || '暂未分配端口' }}
        </span>
      </div>

      <div class="flex items-center gap-1 shrink-0 text-xs font-medium text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        <ClipboardDocumentIcon class="w-3.5 h-3.5" />
        <span>复制</span>
      </div>
    </div>

    <!-- Row 3: Metadata Line (Local & Node) + Traffic + Start/Stop Action -->
    <div class="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/70 text-xs">
      <!-- Left: Local Target & Node & Traffic in one clean line -->
      <div class="flex items-center gap-2 min-w-0 flex-1 text-zinc-500 dark:text-zinc-400 text-xs flex-wrap">
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-zinc-400 dark:text-zinc-500">本地:</span>
          <span class="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{{ tunnel.local_ip }}:{{ tunnel.local_port }}</span>
        </div>
        <span class="opacity-25 shrink-0">·</span>
        <span class="truncate text-zinc-400 dark:text-zinc-500 shrink-0" :title="tunnel.node_name">{{ tunnel.node_name }}</span>
        <span class="opacity-25 shrink-0">·</span>
        <button
          @click="emit('view-traffic', tunnel)"
          class="inline-flex items-center gap-1 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 bg-transparent border-0 cursor-pointer p-0 transition-colors shrink-0"
          title="点击查看详细流量走势"
        >
          <span>今日 <strong class="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{{ formatTraffic(tunnel.today_traffic) }}</strong></span>
        </button>
      </div>

      <!-- Right: Start / Stop Button -->
      <button
        @click="toggleTunnel"
        :disabled="starting || stopping || isBanned"
        :class="[
          'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-0 cursor-pointer disabled:opacity-40 select-none shadow-2xs shrink-0',
          isLocalRunning
            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
            : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm'
        ]"
      >
        <StopIcon v-if="isLocalRunning" class="w-3.5 h-3.5 fill-current" />
        <PlayIcon v-else class="w-3.5 h-3.5 fill-current" />
        <span>{{ isLocalRunning ? '停止' : '启动' }}</span>
      </button>
    </div>
  </div>
</template>
