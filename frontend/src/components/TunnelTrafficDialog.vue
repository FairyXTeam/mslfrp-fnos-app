<script setup lang="ts">
import BaseModal from './common/BaseModal.vue';
import TrafficChart from './common/TrafficChart.vue';
import { ArrowTrendingUpIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  visible: boolean;
  tunnel: {
    id: number;
    name: string;
    node_name?: string;
    today_traffic?: number;
    total_traffic?: number;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

function formatTraffic(mb?: number) {
  if (!mb || mb <= 0) return '0 MB';
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  if (mb < 1024 * 1024) return (mb / 1024).toFixed(2) + ' GB';
  return (mb / (1024 * 1024)).toFixed(2) + ' TB';
}
</script>

<template>
  <BaseModal
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="tunnel ? `隧道 [${tunnel.name}] 流量趋势` : '隧道流量趋势'"
    maxWidth="max-w-2xl"
  >
    <div v-if="tunnel" class="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
      <!-- Tunnel Quick Meta Bar -->
      <div class="p-3 sm:p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
          <span class="text-zinc-400 shrink-0">节点:</span>
          <span class="font-bold text-zinc-800 dark:text-zinc-200 truncate">{{ tunnel.node_name || '穿透节点' }}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0">#{{ tunnel.id }}</span>
        </div>

        <div class="flex items-center gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
          <span>今日: <strong class="font-mono text-zinc-800 dark:text-zinc-200">{{ formatTraffic(tunnel.today_traffic) }}</strong></span>
          <span class="opacity-30">|</span>
          <span>累计: <strong class="font-mono text-zinc-800 dark:text-zinc-200">{{ formatTraffic(tunnel.total_traffic) }}</strong></span>
        </div>
      </div>

      <!-- Traffic Chart (Cleanly embeds without redundant nested header) -->
      <TrafficChart
        :api-url="`/api/frp/traffic/tunnel?id=${tunnel.id}`"
        :hide-header="true"
        :compact="true"
        :height="180"
      />

      <div class="flex justify-end pt-1">
        <button
          @click="emit('update:visible', false)"
          class="px-5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0 cursor-pointer transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  </BaseModal>
</template>
