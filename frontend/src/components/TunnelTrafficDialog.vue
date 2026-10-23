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
    <div v-if="tunnel" class="p-6 flex flex-col gap-5">
      <!-- Tunnel Quick Meta -->
      <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-zinc-500">穿透节点:</span>
          <span class="font-bold text-zinc-800 dark:text-zinc-200">{{ tunnel.node_name || '穿透节点' }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-zinc-500">今日: <strong class="text-zinc-800 dark:text-zinc-200">{{ formatTraffic(tunnel.today_traffic) }}</strong></span>
          <span class="text-zinc-300 dark:text-zinc-700">|</span>
          <span class="text-zinc-500">累计: <strong class="text-zinc-800 dark:text-zinc-200">{{ formatTraffic(tunnel.total_traffic) }}</strong></span>
        </div>
      </div>

      <!-- Traffic Chart -->
      <TrafficChart
        :api-url="`/api/frp/traffic/tunnel?id=${tunnel.id}`"
        :title="`隧道 [${tunnel.name}] 流量分析`"
        :subtitle="`ID: #${tunnel.id}`"
        :compact="true"
        :height="200"
      />

      <div class="flex justify-end pt-2">
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
