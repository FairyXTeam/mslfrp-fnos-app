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
const isCloudRunning = computed(() => props.tunnel.status === 1);
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
  <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all select-none">
    <!-- Top Row: Icon + Title + Status + Action -->
    <div class="flex items-center justify-between gap-3">
      <!-- Left: Icon & Name block -->
      <div class="flex items-center gap-3.5 min-w-0">
        <!-- Big Round Icon Container with Status Badge -->
        <div class="relative w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ComputerDesktopIcon class="w-6 h-6 stroke-[1.8]" />

          <!-- Circular Overlay Badge -->
          <span
            v-if="isLocalRunning"
            class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-zinc-900 shadow-sm"
            title="已在本机连接并运行"
          >
            <CheckIcon class="w-2.5 h-2.5 stroke-[3]" />
          </span>
          <span
            v-else-if="isCloudRunning"
            class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-zinc-900 shadow-sm"
            title="在其他设备/云端在线运行"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          </span>
          <span
            v-else-if="starting"
            class="absolute -bottom-1 -right-1 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ring-2 ring-white dark:ring-zinc-900"
          ></span>
          <span
            v-else-if="isBanned"
            class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-600 ring-2 ring-white dark:ring-zinc-900"
            title="隧道已封禁"
          ></span>
          <span
            v-else
            class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-300 dark:bg-zinc-700 ring-2 ring-white dark:ring-zinc-900"
            title="已停止"
          ></span>
        </div>

        <!-- Middle: Title & Status Subtitle -->
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-zinc-900 dark:text-white truncate m-0">{{ tunnel.name }}</h3>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {{ tunnel.type }}
            </span>
            <span
              v-if="tunnel.protocol === 'wss'"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
            >
              WSS
            </span>
            <span
              v-else-if="tunnel.protocol === 'kcp'"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40"
            >
              KCP
            </span>
            <span
              v-if="isAutostart"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-0.5"
              title="开机自启动已开启"
            >
              <BoltIcon class="w-3 h-3 text-amber-500 stroke-[2.2]" />
              自启
            </span>
            <span
              v-if="isBanned"
              class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40"
            >
              封禁中
            </span>
          </div>

          <!-- Status description string -->
          <div class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            <span v-if="isBanned" class="text-purple-600 dark:text-purple-400 font-medium shrink-0 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block"></span>
              <span class="truncate">封禁: {{ tunnel.ban }}</span>
            </span>
            <span v-else-if="isLocalRunning" class="text-emerald-600 dark:text-emerald-400 font-medium shrink-0 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>已连接 (本机 PID: {{ liveStatus?.pid }})</span>
            </span>
            <span v-else-if="isCloudRunning" class="text-emerald-600 dark:text-emerald-400 font-medium shrink-0 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>在线 (远端设备)</span>
            </span>
            <span v-else class="text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 inline-block"></span>
              <span>已停止</span>
            </span>

            <span class="opacity-40">|</span>
            <span
              @click.stop="emit('view-traffic', tunnel)"
              class="truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1"
              title="点击查看此隧道用量统计走势"
            >
              <ArrowTrendingUpIcon class="w-3.5 h-3.5 text-emerald-500 inline-block shrink-0" />
              <span>今日流量: {{ formatTraffic(tunnel.today_traffic) }}</span>
            </span>
            <span class="opacity-40">|</span>
            <span class="truncate">节点: {{ tunnel.node_name }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Play/Stop Button + More Options -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Start/Stop Play Button -->
        <button
          @click="toggleTunnel"
          :disabled="starting || stopping || isBanned"
          class="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-600 hover:text-blue-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-blue-400 dark:hover:bg-zinc-800 transition-colors border-0 cursor-pointer disabled:opacity-40"
          :title="isLocalRunning ? '点击停止本机隧道' : '点击在本机启动隧道'"
        >
          <StopIcon v-if="isLocalRunning" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 hover:text-rose-500" />
          <PlayIcon v-else class="w-4 h-4 text-zinc-700 dark:text-zinc-300 hover:text-blue-600" />
        </button>

        <!-- Pure Tailwind Dropdown Popover -->
        <div class="relative" ref="dropdownRef">
          <button
            @click.stop="menuOpen = !menuOpen"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors border-0 cursor-pointer"
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
                v-if="primaryAddr"
                @click="menuOpen = false; copyToClipboard(primaryAddr, '连接地址(域名)')"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <ClipboardDocumentIcon class="w-4 h-4 text-zinc-400" />
                <span>复制连接地址(域名)</span>
              </button>
              <button
                v-if="secondaryAddr"
                @click="menuOpen = false; copyToClipboard(secondaryAddr, '备用地址(IP)')"
                class="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <ClipboardDocumentIcon class="w-4 h-4 text-zinc-400" />
                <span>复制备用地址(IP)</span>
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

    <!-- Bottom Row: Flow Mapping (Source -> Remote -> Protocol) -->
    <div class="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-7 items-center gap-2 text-xs">
      <!-- Local Source -->
      <div class="sm:col-span-3 flex items-center gap-2 min-w-0">
        <div class="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
          <ComputerDesktopIcon class="w-4 h-4" />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-medium text-zinc-700 dark:text-zinc-300 truncate">本地目标</span>
          <span class="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate">{{ tunnel.local_ip }}:{{ tunnel.local_port }}</span>
        </div>
      </div>

      <!-- Arrow Flow -->
      <div class="sm:col-span-1 hidden sm:flex items-center justify-center">
        <ArrowRightIcon class="w-4 h-4 text-blue-400 dark:text-blue-500/70" />
      </div>

      <!-- Remote Target (Alike MSLUserPanel) -->
      <div class="sm:col-span-3 flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div class="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <CloudIcon class="w-4 h-4" />
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium text-zinc-700 dark:text-zinc-300 truncate">{{ tunnel.node_name }}</span>

            <!-- Primary Address (Domain) -->
            <button
              v-if="primaryAddr"
              @click="copyToClipboard(primaryAddr, '连接地址(域名)')"
              class="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate hover:underline bg-transparent border-0 p-0 text-left cursor-pointer flex items-center gap-1"
              title="点击复制连接地址"
            >
              <span class="truncate">{{ primaryAddr }}</span>
              <ClipboardDocumentIcon class="w-3 h-3 shrink-0 opacity-60" />
            </button>

            <!-- Secondary Address (Backup IP) -->
            <button
              v-if="secondaryAddr && secondaryAddr !== primaryAddr"
              @click="copyToClipboard(secondaryAddr, '备用地址(IP)')"
              class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate hover:underline bg-transparent border-0 p-0 text-left cursor-pointer flex items-center gap-1"
              title="点击复制备用IP"
            >
              <span class="truncate">备用: {{ secondaryAddr }}</span>
              <ClipboardDocumentIcon class="w-2.5 h-2.5 shrink-0 opacity-50" />
            </button>
          </div>
        </div>

        <span class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
          {{ tunnel.protocol ? tunnel.protocol.toUpperCase() : tunnel.type }}
        </span>
      </div>
    </div>
  </div>
</template>
