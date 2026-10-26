<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { useTunnelsStore } from '../stores/tunnels';
import {
  CommandLineIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  TrashIcon,
  ComputerDesktopIcon,
  CloudIcon,
  ArrowRightIcon,
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
  <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all select-none flex flex-col gap-3">
    <!-- Top Row: Icon + Title + Status Pill + Main Actions -->
    <div class="flex items-center justify-between gap-2.5">
      <!-- Left: Icon & Title -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Big Round Icon Container with Status Indicator -->
        <div class="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ComputerDesktopIcon class="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />

          <!-- Circular Overlay Badge -->
          <span
            v-if="isLocalRunning"
            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-zinc-900 shadow-xs"
            title="已在本机连接并运行"
          >
            <CheckIcon class="w-2.5 h-2.5 stroke-[3]" />
          </span>
          <span
            v-else-if="isCloudRunning"
            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-zinc-900 shadow-xs"
            title="在其他设备/云端在线运行"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          </span>
          <span
            v-else-if="starting"
            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ring-2 ring-white dark:ring-zinc-900"
          ></span>
          <span
            v-else-if="isBanned"
            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-purple-600 ring-2 ring-white dark:ring-zinc-900"
            title="隧道已封禁"
          ></span>
          <span
            v-else
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600 ring-2 ring-white dark:ring-zinc-900"
            title="已停止"
          ></span>
        </div>

        <!-- Name & Status Badges -->
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate m-0" :title="tunnel.name">
              {{ tunnel.name }}
            </h3>
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {{ tunnel.type }}
            </span>
            <span
              v-if="tunnel.protocol === 'wss'"
              class="text-[9px] font-semibold px-1 py-0.2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
            >
              WSS
            </span>
            <span
              v-else-if="tunnel.protocol === 'kcp'"
              class="text-[9px] font-semibold px-1 py-0.2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40"
            >
              KCP
            </span>
          </div>

          <!-- Status Pill -->
          <div class="flex items-center gap-1.5 mt-1 text-[11px] font-medium flex-wrap">
            <span
              v-if="isLocalRunning"
              class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/50"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>本机运行中</span>
              <span v-if="liveStatus?.pid" class="text-[9px] font-mono opacity-80">(PID:{{ liveStatus.pid }})</span>
            </span>
            <span
              v-else-if="isCloudRunning"
              class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/50"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>远端在线</span>
            </span>
            <span
              v-else-if="isBanned"
              class="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/50"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
              <span>已封禁</span>
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>
              <span>未运行</span>
            </span>

            <span
              v-if="isAutostart"
              class="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40 text-[10px]"
              title="已配置开机自启"
            >
              <BoltIcon class="w-2.5 h-2.5 text-amber-500 stroke-[2.5]" />
              <span>自启</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Right: Play/Stop Button + More Options Dropdown -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Start/Stop Play Button -->
        <button
          @click="toggleTunnel"
          :disabled="starting || stopping || isBanned"
          :class="[
            'h-8 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border-0 cursor-pointer disabled:opacity-40 select-none shadow-2xs',
            isLocalRunning
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/40'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
          ]"
          :title="isLocalRunning ? '点击停止本机隧道' : '点击在本机启动隧道'"
        >
          <StopIcon v-if="isLocalRunning" class="w-3.5 h-3.5 fill-current" />
          <PlayIcon v-else class="w-3.5 h-3.5 fill-current" />
          <span class="hidden sm:inline">{{ isLocalRunning ? '停止' : '启动' }}</span>
        </button>

        <!-- Dropdown Menu Popover -->
        <div class="relative" ref="dropdownRef">
          <button
            @click.stop="menuOpen = !menuOpen"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors border-0 cursor-pointer"
            title="更多操作"
          >
            <EllipsisHorizontalIcon class="w-5 h-5 stroke-[2]" />
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
                @click="menuOpen = false; emit('edit', tunnel)"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <PencilSquareIcon class="w-4 h-4 text-zinc-400" />
                <span>编辑配置</span>
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

    <!-- Middle: Prominent Public Connection Box (Core Effective Information) -->
    <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/70 flex flex-col gap-2">
      <!-- Row 1: Remote Address & Quick Copy Button -->
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div class="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CloudIcon class="w-3.5 h-3.5" />
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-none mb-0.5">远程连接地址</span>
            <span class="text-xs sm:text-sm font-bold font-mono text-blue-600 dark:text-blue-400 truncate select-all">
              {{ primaryAddr || '暂未分配端口' }}
            </span>
          </div>
        </div>

        <button
          v-if="primaryAddr"
          @click="copyToClipboard(primaryAddr, '连接地址')"
          class="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
          title="点击复制完整连接地址"
        >
          <ClipboardDocumentIcon class="w-3.5 h-3.5 text-zinc-400" />
          <span>复制</span>
        </button>
      </div>

      <!-- Row 2: Secondary / Backup IP Address (if available) -->
      <div
        v-if="secondaryAddr && secondaryAddr !== primaryAddr"
        class="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/50 dark:border-zinc-700/40 text-[11px]"
      >
        <span class="text-zinc-400 shrink-0 font-medium">备用IP:</span>
        <span class="font-mono text-zinc-600 dark:text-zinc-300 truncate flex-1 select-all">{{ secondaryAddr }}</span>
        <button
          @click="copyToClipboard(secondaryAddr, '备用IP地址')"
          class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-0 bg-transparent p-0 text-[11px] font-medium shrink-0"
        >
          复制
        </button>
      </div>

      <!-- Row 3: Local Target Mapping -->
      <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/50 dark:border-zinc-700/40 text-[11px]">
        <div class="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 min-w-0">
          <ComputerDesktopIcon class="w-3.5 h-3.5 shrink-0" />
          <span class="shrink-0 font-medium">本地目标:</span>
          <span class="font-mono text-zinc-800 dark:text-zinc-200 font-semibold truncate">{{ tunnel.local_ip }}:{{ tunnel.local_port }}</span>
        </div>
        <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
          节点: {{ tunnel.node_name }}
        </span>
      </div>
    </div>

    <!-- Bottom Meta & Quick Shortcuts Bar -->
    <div class="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
      <!-- Traffic Stats Pill (Clickable) -->
      <button
        @click="emit('view-traffic', tunnel)"
        class="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 bg-transparent border-0 cursor-pointer p-0 transition-colors"
        title="点击查看详细流量走势"
      >
        <ArrowTrendingUpIcon class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>今日: <strong class="text-zinc-800 dark:text-zinc-200 font-mono">{{ formatTraffic(tunnel.today_traffic) }}</strong></span>
        <span class="opacity-40">·</span>
        <span>累计: <strong class="text-zinc-800 dark:text-zinc-200 font-mono">{{ formatTraffic(tunnel.total_traffic) }}</strong></span>
      </button>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 shrink-0">
        <button
          @click="emit('view-logs', tunnel.id)"
          class="px-2 py-1 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer flex items-center gap-1 transition-colors"
          title="查看实时控制台日志"
        >
          <CommandLineIcon class="w-3.5 h-3.5 text-zinc-400" />
          <span class="hidden sm:inline">日志</span>
        </button>

        <button
          @click="emit('view-traffic', tunnel)"
          class="px-2 py-1 rounded-lg text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-0 bg-transparent cursor-pointer flex items-center gap-1 transition-colors"
          title="查看流量统计分析"
        >
          <ArrowTrendingUpIcon class="w-3.5 h-3.5 text-emerald-500" />
          <span class="hidden sm:inline">趋势</span>
        </button>
      </div>
    </div>
  </div>
</template>
