<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick, computed } from 'vue';
import { toast } from '../utils/toast';
import { get } from '../api/client';
import { useTunnelsStore } from '../stores/tunnels';
import BaseDrawer from './common/BaseDrawer.vue';
import { ClipboardDocumentIcon, TrashIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  visible: boolean;
  tunnelId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const tunnelsStore = useTunnelsStore();
const logs = ref('');
const autoScroll = ref(true);
const logContainerRef = ref<HTMLElement | null>(null);
let pollTimer: any = null;

const currentTunnel = computed(() => {
  if (!props.tunnelId) return null;
  return tunnelsStore.tunnels.find(t => t.id === props.tunnelId);
});

async function fetchLogs() {
  if (!props.tunnelId) return;
  try {
    const res = await get('/api/local/tunnel/logs', { id: props.tunnelId, lines: 200 });
    if (res && res.code === 200) {
      logs.value = res.data?.logs || '暂无运行日志输出。';
      if (autoScroll.value) {
        nextTick(() => {
          if (logContainerRef.value) {
            logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
          }
        });
      }
    }
  } catch (err: any) {
    logs.value = `获取日志失败: ${err.message}`;
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal && props.tunnelId) {
    logs.value = '正在加载实时日志...';
    fetchLogs();
    pollTimer = setInterval(fetchLogs, 1500);
  } else {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

function copyLogs() {
  navigator.clipboard.writeText(logs.value).then(() => {
    toast.success('完整日志已复制到剪贴板');
  });
}

function clearLogs() {
  logs.value = '日志视图已清空';
}

const renderedLogs = computed(() => {
  return ansiToHtml(logs.value);
});

function ansiToHtml(text: string): string {
  if (!text) return '';

  // 1. Escape HTML
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Standard ANSI color styles
  const colorMap: Record<string, string> = {
    '30': 'color: #94a3b8;', // Slate
    '31': 'color: #f87171;', // Red
    '32': 'color: #34d399;', // Green
    '33': 'color: #fbbf24;', // Yellow
    '34': 'color: #60a5fa;', // Blue
    '35': 'color: #c084fc;', // Magenta
    '36': 'color: #38bdf8;', // Cyan
    '37': 'color: #f1f5f9;', // White
    '90': 'color: #64748b;', // Gray
    '91': 'color: #fb7185;', // Bright Red
    '92': 'color: #4ade80;', // Bright Green
    '93': 'color: #fde047;', // Bright Yellow
    '94': 'color: #93c5fd;', // Bright Blue
    '95': 'color: #e879f9;', // Bright Magenta
    '96': 'color: #67e8f9;', // Bright Cyan
    '97': 'color: #ffffff;'  // Bright White
  };

  let openSpans = 0;
  // Match ANSI escape sequences: either \u001b[...m, \x1b[...m, or bare [...m
  const ansiRegex = /(?:\u001b\[|\x1b\[|\[)([0-9;]+)m/g;

  escaped = escaped.replace(ansiRegex, (_, codesStr) => {
    const codes = codesStr.split(';');

    // Reset code: 0
    if (codes.includes('0') || codesStr === '0') {
      let closeHtml = '';
      while (openSpans > 0) {
        closeHtml += '</span>';
        openSpans--;
      }
      return closeHtml;
    }

    const styles: string[] = [];
    for (const code of codes) {
      if (code === '1') {
        styles.push('font-weight: 700;');
      } else if (code === '4') {
        styles.push('text-decoration: underline;');
      } else if (colorMap[code]) {
        styles.push(colorMap[code]);
      }
    }

    if (styles.length > 0) {
      openSpans++;
      return `<span style="${styles.join(' ')}">`;
    }

    return '';
  });

  while (openSpans > 0) {
    escaped += '</span>';
    openSpans--;
  }

  // Terminal keyword highlights
  escaped = escaped
    .replace(/(隧道已成功启动！)/g, '<span style="color: #34d399; font-weight: 700;">$1</span>')
    .replace(/(远程连接地址：\S+)/g, '<span style="color: #38bdf8; font-weight: 700;">$1</span>')
    .replace(/(=== Tunnel \d+ Starting ===)/g, '<span style="color: #60a5fa; font-weight: 700;">$1</span>')
    .replace(/(=== Tunnel \d+ Stopped ===)/g, '<span style="color: #f87171; font-weight: 700;">$1</span>');

  return escaped;
}
</script>

<template>
  <BaseDrawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="currentTunnel ? `[${currentTunnel.name}] 实时日志` : '运行日志'"
    width="max-w-2xl"
  >
    <template #header-actions>
      <div class="flex items-center gap-2">
        <button
          @click="copyLogs"
          class="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-1 transition-colors"
        >
          <ClipboardDocumentIcon class="w-3.5 h-3.5" />
          <span>复制</span>
        </button>
        <button
          @click="clearLogs"
          class="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-1 transition-colors"
        >
          <TrashIcon class="w-3.5 h-3.5" />
          <span>清屏</span>
        </button>
      </div>
    </template>

    <div class="flex flex-col h-full gap-2">
      <!-- Monospace Terminal Screen -->
      <div
        ref="logContainerRef"
        class="flex-1 min-h-[460px] bg-[#0c1017] text-[#c9d1d9] font-mono text-xs p-4 rounded-xl overflow-y-auto leading-relaxed border border-zinc-800 select-text whitespace-pre-wrap"
        v-html="renderedLogs"
      ></div>

      <div class="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" v-model="autoScroll" class="rounded text-blue-600" />
          <span>新日志自动滚动到底部</span>
        </label>
        <span>刷新频率: 1.5s</span>
      </div>
    </div>
  </BaseDrawer>
</template>
