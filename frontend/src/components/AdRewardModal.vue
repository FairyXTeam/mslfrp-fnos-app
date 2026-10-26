<script setup lang="ts">
import { ref, watch } from 'vue';
import { get } from '../api/client';
import { toast } from '../utils/toast';
import BaseModal from './common/BaseModal.vue';
import {
  GiftIcon,
  ClockIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const loading = ref(false);
const adRewardStatus = ref<any>(null);
const adQrCodeImage = ref('');
const urlLink = ref('');
const isMobile = ref(false);

function formatTimestamp(ts: number | string) {
  if (!ts) return '请稍后再试';
  const num = Number(ts);
  const date = new Date(num > 1e11 ? num : num * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

async function loadAdRewardData() {
  loading.value = true;
  adRewardStatus.value = null;
  adQrCodeImage.value = '';
  urlLink.value = '';

  try {
    const statusRes = await get('/api/user/ad-reward/status');
    if (statusRes && statusRes.code === 200 && statusRes.data) {
      adRewardStatus.value = statusRes.data;
      if (statusRes.data.watchedCount >= statusRes.data.maxDaily) {
        loading.value = false;
        return;
      }
    } else {
      toast.error(statusRes?.msg || '获取积分奖励状态失败');
      emit('update:modelValue', false);
      return;
    }

    isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile.value) {
      const res = await get('/api/user/ad-reward/qrcode?mode=url');
      if (res && res.code === 200 && res.data) {
        urlLink.value = res.data;
      } else {
        toast.error(res?.msg || '获取跳转链接失败');
      }
    } else {
      const res = await get('/api/user/ad-reward/qrcode?mode=qrcode');
      if (res && res.code === 200 && res.data) {
        adQrCodeImage.value = res.data;
      } else {
        toast.error(res?.msg || '获取二维码失败');
      }
    }
  } catch (err: any) {
    toast.error('网络请求失败，请稍后重试');
    emit('update:modelValue', false);
  } finally {
    loading.value = false;
  }
}

function handleOpenUrlLink() {
  if (urlLink.value) {
    window.location.href = urlLink.value;
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      loadAdRewardData();
    }
  }
);
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="获取积分"
    max-width="max-w-md"
  >
    <div class="flex flex-col items-center justify-center p-0.5 sm:p-1 select-none">
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-10 gap-3 text-zinc-400">
        <div class="w-8 h-8 border-3 border-zinc-200 dark:border-zinc-700 border-t-emerald-600 rounded-full animate-spin"></div>
        <span class="text-xs">正在查询今日奖励状态...</span>
      </div>

      <!-- Limit Reached State -->
      <div
        v-else-if="adRewardStatus && adRewardStatus.watchedCount >= adRewardStatus.maxDaily"
        class="flex flex-col items-center gap-2.5 py-4 w-full text-center"
      >
        <div class="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-0.5">
          <ClockIcon class="w-5 h-5 stroke-[2]" />
        </div>
        <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white m-0">今日获取次数已达上限</h3>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 m-0">
          今日剩余次数:
          <span class="font-bold text-amber-600 dark:text-amber-400">0 / {{ adRewardStatus.maxDaily }}</span> 次
        </p>

        <div class="mt-2.5 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40 w-full text-center">
          <div class="text-[10px] text-amber-700/80 dark:text-amber-400/80 mb-0.5">下次可用时间</div>
          <div class="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
            {{ formatTimestamp(adRewardStatus.nextAvailableTime) }}
          </div>
        </div>
      </div>

      <!-- Active QR Code or Mobile URL Link -->
      <div v-else-if="adQrCodeImage || urlLink" class="flex flex-col items-center w-full">
        <!-- Daily remaining quota badge -->
        <div class="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-700">
          今日可用次数:
          <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {{ adRewardStatus.maxDaily - adRewardStatus.watchedCount }} / {{ adRewardStatus.maxDaily }}
          </span>
          次
        </div>

        <!-- Mobile: Jump to WeChat Button -->
        <template v-if="isMobile">
          <button
            @click="handleOpenUrlLink"
            class="w-52 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer border-0 transition-all my-3"
          >
            <span>跳转微信赚积分</span>
            <ArrowTopRightOnSquareIcon class="w-4 h-4" />
          </button>
        </template>

        <!-- Desktop: QR Code Scanner -->
        <template v-else>
          <div class="relative p-2 bg-white rounded-2xl border border-zinc-200/80 dark:border-zinc-700 shadow-sm my-0.5">
            <img :src="adQrCodeImage" alt="小程序二维码" class="w-36 h-36 sm:w-40 sm:h-40 rounded-xl object-contain block" />
          </div>
        </template>

        <p class="mt-2 text-xs text-zinc-600 dark:text-zinc-300 text-center leading-relaxed m-0">
          请使用 <strong class="text-emerald-600 dark:text-emerald-400">微信{{ isMobile ? '打开' : '扫一扫' }}</strong> 观看视频广告<br />
          即可随机获得
          <strong class="text-emerald-600 dark:text-emerald-400">{{ adRewardStatus.minScore }} ~ {{ adRewardStatus.maxScore }}</strong>
          积分！
        </p>

        <!-- Binding Notice -->
        <div class="mt-2.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 p-2.5 rounded-xl text-[11px] sm:text-xs text-blue-700 dark:text-blue-300 text-left leading-relaxed w-full">
          <div class="flex items-start gap-1.5">
            <InformationCircleIcon class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <strong>重要提示：</strong>请务必使用当前本账号绑定的微信操作，否则发奖失败。<br />
              <span class="opacity-80 text-[10px] sm:text-[11px]">（若当前未绑定微信，本次扫码操作将自动完成绑定）</span>
            </div>
          </div>
        </div>

        <!-- Security Warning -->
        <div class="mt-2 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 p-2.5 rounded-xl text-[11px] sm:text-xs text-rose-700 dark:text-rose-300 text-left leading-relaxed w-full">
          <div class="flex items-start gap-1.5">
            <ExclamationTriangleIcon class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <strong>安全警告：</strong>此二维码与您的账号唯一绑定，<strong>请勿分享给他人</strong>，避免账号被冒领！
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2.5 w-full">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors border-0 cursor-pointer"
        >
          关闭
        </button>
      </div>
    </template>
  </BaseModal>
</template>
