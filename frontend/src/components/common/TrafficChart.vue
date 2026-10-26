<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { get } from '../../api/client';
import {
  ArrowTrendingUpIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/vue/24/outline';

interface TrafficPoint {
  time: string;
  total_in: number; // in MB
  total_out: number; // in MB
}

const props = withDefaults(
  defineProps<{
    apiUrl: string;
    title?: string;
    subtitle?: string;
    height?: number;
    compact?: boolean;
    hideHeader?: boolean;
  }>(),
  {
    title: '流量趋势分析',
    subtitle: '实时与历史网络传输量监控',
    height: 220,
    compact: false,
    hideHeader: false
  }
);

const trafficDays = ref<number>(7);
const trafficPoints = ref<TrafficPoint[]>([]);
const loading = ref(false);
const activeCoord = ref<{ x: number; yIn: number; yOut: number; point: TrafficPoint } | null>(null);

function formatTraffic(mb: number) {
  if (!mb || mb <= 0) return '0 MB';
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  if (mb < 1024 * 1024) return (mb / 1024).toFixed(2) + ' GB';
  return (mb / (1024 * 1024)).toFixed(2) + ' TB';
}

const totalInboundMB = computed(() => {
  return trafficPoints.value.reduce((acc, p) => acc + (Number(p.total_in) || 0), 0);
});

const totalOutboundMB = computed(() => {
  return trafficPoints.value.reduce((acc, p) => acc + (Number(p.total_out) || 0), 0);
});

const maxTrafficValue = computed(() => {
  if (trafficPoints.value.length === 0) return 10;
  let max = 0;
  for (const p of trafficPoints.value) {
    if (p.total_in > max) max = p.total_in;
    if (p.total_out > max) max = p.total_out;
  }
  return max <= 0 ? 10 : max * 1.15;
});

// SVG Chart Geometry
const svgWidth = 800;
const svgHeight = computed(() => props.height);
const paddingX = 40;
const paddingY = 25;

const chartCoords = computed(() => {
  const n = trafficPoints.value.length;
  if (n === 0) return [];
  const max = maxTrafficValue.value;
  const usableW = svgWidth - paddingX * 2;
  const usableH = svgHeight.value - paddingY * 2;

  return trafficPoints.value.map((p, i) => {
    const x = paddingX + (n > 1 ? (i / (n - 1)) * usableW : usableW / 2);
    const yIn = svgHeight.value - paddingY - (p.total_in / max) * usableH;
    const yOut = svgHeight.value - paddingY - (p.total_out / max) * usableH;
    return { x, yIn, yOut, point: p };
  });
});

const inboundAreaPath = computed(() => {
  const coords = chartCoords.value;
  if (coords.length === 0) return '';
  const baseY = svgHeight.value - paddingY;
  let d = `M ${coords[0].x} ${baseY} L ${coords[0].x} ${coords[0].yIn}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i].x} ${coords[i].yIn}`;
  }
  d += ` L ${coords[coords.length - 1].x} ${baseY} Z`;
  return d;
});

const inboundLinePath = computed(() => {
  const coords = chartCoords.value;
  if (coords.length === 0) return '';
  let d = `M ${coords[0].x} ${coords[0].yIn}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i].x} ${coords[i].yIn}`;
  }
  return d;
});

const outboundAreaPath = computed(() => {
  const coords = chartCoords.value;
  if (coords.length === 0) return '';
  const baseY = svgHeight.value - paddingY;
  let d = `M ${coords[0].x} ${baseY} L ${coords[0].x} ${coords[0].yOut}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i].x} ${coords[i].yOut}`;
  }
  d += ` L ${coords[coords.length - 1].x} ${baseY} Z`;
  return d;
});

const outboundLinePath = computed(() => {
  const coords = chartCoords.value;
  if (coords.length === 0) return '';
  let d = `M ${coords[0].x} ${coords[0].yOut}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i].x} ${coords[i].yOut}`;
  }
  return d;
});

async function fetchTrafficData() {
  if (!props.apiUrl) return;
  loading.value = true;
  activeCoord.value = null;
  try {
    const separator = props.apiUrl.includes('?') ? '&' : '?';
    const targetUrl = `${props.apiUrl}${separator}days=${trafficDays.value}`;
    const res = await get(targetUrl);
    if (res && res.code === 200 && Array.isArray(res.data)) {
      trafficPoints.value = res.data.map((item: any) => ({
        time: item.time || item.date || item.time_point || '',
        total_in: Number(item.total_in) || 0,
        total_out: Number(item.total_out) || 0
      }));
    } else {
      trafficPoints.value = [];
    }
  } catch (e) {
    console.warn('Failed to load traffic chart data:', e);
    trafficPoints.value = [];
  } finally {
    loading.value = false;
  }
}

function handleMouseMove(e: MouseEvent) {
  const coords = chartCoords.value;
  if (coords.length === 0) return;

  const svg = e.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const svgX = (mouseX / rect.width) * svgWidth;

  const usableW = svgWidth - paddingX * 2;
  const n = coords.length;
  if (n === 1) {
    activeCoord.value = coords[0];
    return;
  }

  const rawIdx = ((svgX - paddingX) / usableW) * (n - 1);
  const clampedIdx = Math.max(0, Math.min(n - 1, Math.round(rawIdx)));
  activeCoord.value = coords[clampedIdx];
}

function handleMouseLeave() {
  activeCoord.value = null;
}

watch(
  () => props.apiUrl,
  () => {
    fetchTrafficData();
  }
);

onMounted(() => {
  fetchTrafficData();
});
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <!-- Top Control Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <!-- Title Block (if not hidden) -->
      <div v-if="!hideHeader" class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <ArrowTrendingUpIcon class="w-5 h-5 stroke-[1.8]" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">{{ title }}</h3>
          <p class="text-[11px] text-zinc-400 m-0 mt-0.5">{{ subtitle }}</p>
        </div>
      </div>

      <!-- Days Switcher (Always available) -->
      <div class="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 self-start sm:self-auto shrink-0 border border-zinc-200/50 dark:border-zinc-700/50">
        <button
          @click="trafficDays = 1; fetchTrafficData()"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border-0 transition-all select-none',
            trafficDays === 1 ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : 'text-zinc-600 dark:text-zinc-400 bg-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
          ]"
        >
          今日 (24h)
        </button>
        <button
          @click="trafficDays = 7; fetchTrafficData()"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border-0 transition-all select-none',
            trafficDays === 7 ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : 'text-zinc-600 dark:text-zinc-400 bg-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
          ]"
        >
          近 7 天
        </button>
        <button
          @click="trafficDays = 30; fetchTrafficData()"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border-0 transition-all select-none',
            trafficDays === 30 ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : 'text-zinc-600 dark:text-zinc-400 bg-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
          ]"
        >
          近 30 天
        </button>
      </div>
    </div>

    <!-- Summary Metrics Cards (Clean Vertical Stack, Never Wrap Characters) -->
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <!-- 1. Inbound Card -->
      <div class="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between gap-1 select-none">
        <div class="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 min-w-0">
          <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <ArrowDownIcon class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
          </div>
          <span class="text-[11px] sm:text-xs font-medium truncate">入站</span>
        </div>
        <span class="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
          {{ formatTraffic(totalInboundMB) }}
        </span>
      </div>

      <!-- 2. Outbound Card -->
      <div class="p-2.5 sm:p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex flex-col justify-between gap-1 select-none">
        <div class="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 min-w-0">
          <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
            <ArrowUpIcon class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
          </div>
          <span class="text-[11px] sm:text-xs font-medium truncate">出站</span>
        </div>
        <span class="text-xs sm:text-sm font-bold font-mono text-blue-600 dark:text-blue-400 truncate">
          {{ formatTraffic(totalOutboundMB) }}
        </span>
      </div>

      <!-- 3. Total Card -->
      <div class="p-2.5 sm:p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col justify-between gap-1 select-none">
        <div class="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 min-w-0">
          <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
            <ArrowTrendingUpIcon class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
          </div>
          <span class="text-[11px] sm:text-xs font-medium truncate">总量</span>
        </div>
        <span class="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-white truncate">
          {{ formatTraffic(totalInboundMB + totalOutboundMB) }}
        </span>
      </div>
    </div>

    <!-- SVG Area Chart Container -->
    <div class="relative w-full border border-zinc-100 dark:border-zinc-800/80 rounded-xl bg-zinc-50/40 dark:bg-zinc-950/40 p-2 sm:p-4 select-none">
      <div v-if="loading" class="py-12 sm:py-16 text-center text-xs text-zinc-400">
        正在拉取流量数据...
      </div>

      <div v-else-if="trafficPoints.length === 0" class="py-10 sm:py-14 flex flex-col items-center justify-center gap-2 text-zinc-400 select-none">
        <ArrowTrendingUpIcon class="w-8 h-8 text-zinc-300 dark:text-zinc-600 stroke-[1.5]" />
        <span class="text-xs text-zinc-400 dark:text-zinc-500">所选时段内暂无网络流量记录</span>
      </div>

      <div v-else class="w-full flex flex-col gap-2">
        <!-- Legend & Active Inspector Bar -->
        <div class="flex items-center justify-between text-xs text-zinc-500 px-2 min-h-6">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
              <span>入站流量</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
              <span>出站流量</span>
            </div>
          </div>

          <!-- Dynamic Inspection Tooltip -->
          <div v-if="activeCoord" class="font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2.5 animate-fadeIn text-[11px] bg-white/90 dark:bg-zinc-800/90 px-2 py-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
            <span class="text-zinc-400">{{ activeCoord.point.time }}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">入: {{ formatTraffic(activeCoord.point.total_in) }}</span>
            <span class="text-blue-600 dark:text-blue-400 font-bold">出: {{ formatTraffic(activeCoord.point.total_out) }}</span>
          </div>
          <div v-else class="text-[11px] text-zinc-400 hidden sm:block">
            悬浮图表可查看对应时间点用量
          </div>
        </div>

        <!-- SVG Element -->
        <svg
          :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
          class="w-full overflow-visible cursor-crosshair"
          :style="{ height: `${height}px` }"
          preserveAspectRatio="none"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
        >
          <defs>
            <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Reference Grid Lines -->
          <line :x1="paddingX" :y1="paddingY" :x2="svgWidth - paddingX" :y2="paddingY" stroke="currentColor" class="text-zinc-200 dark:text-zinc-800/80 stroke-[1]" stroke-dasharray="3 3" />
          <line :x1="paddingX" :y1="svgHeight / 2" :x2="svgWidth - paddingX" :y2="svgHeight / 2" stroke="currentColor" class="text-zinc-200 dark:text-zinc-800/80 stroke-[1]" stroke-dasharray="3 3" />
          <line :x1="paddingX" :y1="svgHeight - paddingY" :x2="svgWidth - paddingX" :y2="svgHeight - paddingY" stroke="currentColor" class="text-zinc-300 dark:text-zinc-700 stroke-[1]" />

          <!-- Inbound Area & Smooth Line (No clutter dots!) -->
          <path :d="inboundAreaPath" fill="url(#inboundGradient)" />
          <path :d="inboundLinePath" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Outbound Area & Smooth Line (No clutter dots!) -->
          <path :d="outboundAreaPath" fill="url(#outboundGradient)" />
          <path :d="outboundLinePath" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Active Hover Inspection: Guideline & Single Clean Dots -->
          <g v-if="activeCoord">
            <!-- Vertical Guideline -->
            <line
              :x1="activeCoord.x"
              :y1="paddingY"
              :x2="activeCoord.x"
              :y2="svgHeight - paddingY"
              stroke="currentColor"
              class="text-zinc-400 dark:text-zinc-500 stroke-[1.5]"
              stroke-dasharray="3 3"
            />
            <!-- Single active dot for Inbound -->
            <circle
              :cx="activeCoord.x"
              :cy="activeCoord.yIn"
              r="5"
              fill="#10b981"
              stroke="#ffffff"
              stroke-width="2.5"
            />
            <!-- Single active dot for Outbound -->
            <circle
              :cx="activeCoord.x"
              :cy="activeCoord.yOut"
              r="5"
              fill="#3b82f6"
              stroke="#ffffff"
              stroke-width="2.5"
            />
          </g>
        </svg>

        <!-- X-Axis Timeline Labels -->
        <div class="flex items-center justify-between text-[10px] text-zinc-400 font-mono px-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
          <span v-if="trafficPoints.length > 0">{{ trafficPoints[0].time }}</span>
          <span v-if="trafficPoints.length > 2">{{ trafficPoints[Math.floor(trafficPoints.length / 2)].time }}</span>
          <span v-if="trafficPoints.length > 1">{{ trafficPoints[trafficPoints.length - 1].time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
