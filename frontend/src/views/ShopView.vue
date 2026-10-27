<script setup lang="ts">
import { ref, onMounted, onUnmounted, onDeactivated, computed } from 'vue';
import QRCode from 'qrcode';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { get, post } from '../api/client';
import { useAppStore } from '../stores/app';
import BaseModal from '../components/common/BaseModal.vue';
import {
  SparklesIcon,
  CreditCardIcon,
  TicketIcon,
  ShoppingBagIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();

// Sub tabs: 'services' | 'recharge'
const subTab = ref<'services' | 'recharge'>('services');

// --- 1. Services / Goods State ---
interface GoodItem {
  id: number;
  name: string;
  price: number;
  originPrice?: number;
  description: string;
  type: string;
  memberDay?: number;
}

const goods = ref<GoodItem[]>([]);
const loading = ref(false);
const buying = ref(false);

const selectedGood = ref<GoodItem | null>(null);
const buyCount = ref(1);
const buyDialogVisible = ref(false);

// --- 2. Recharge & CDK State ---
const exchangeCode = ref('');
const selectedAmount = ref<number>(10);
const customAmount = ref<number | null>(null);
const payMethod = ref<'alipay' | 'wxpay'>('alipay');
const presetAmounts = [5, 10, 20, 50, 100];

const exchanging = ref(false);
const paying = ref(false);

// Payment Dialog & Polling
const payDialogVisible = ref(false);
const qrDataUrl = ref('');
const rawPayUrl = ref('');
const currentOrderNo = ref('');
const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);
let pollTimer: any = null;

onMounted(async () => {
  await fetchGoods();
});

onUnmounted(() => {
  stopPolling();
});

onDeactivated(() => {
  stopPolling();
});

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchGoods() {
  loading.value = true;
  try {
    const res = await get('/api/shop/getGoods');
    if (res && res.code === 200 && Array.isArray(res.data)) {
      // Filter out ai_tokens goods
      goods.value = res.data.filter((item: GoodItem) => item.type !== 'ai_tokens');
    }
  } catch (err: any) {
    toast.error(err.message || '获取增值服务列表失败');
  } finally {
    loading.value = false;
  }
}

function handleBuyClick(good: GoodItem) {
  if (good.price === 0) return;
  selectedGood.value = good;
  buyCount.value = 1;
  buyDialogVisible.value = true;
}

const totalPrice = computed(() => {
  if (!selectedGood.value) return 0;
  return selectedGood.value.price * buyCount.value;
});

async function handleConfirmBuy() {
  if (!selectedGood.value) return;
  if (appStore.userInfo.score < totalPrice.value) {
    toast.error('积分余额不足，请先充值或兑换卡密');
    buyDialogVisible.value = false;
    subTab.value = 'recharge';
    return;
  }

  buying.value = true;
  try {
    const res = await post('/api/shop/buy', {
      good: selectedGood.value.id,
      count: buyCount.value
    });

    if (res && res.code === 200) {
      toast.success(res.msg || '兑换成功！');
      buyDialogVisible.value = false;
      await appStore.fetchUserInfo();
    } else {
      toast.error(res?.msg || '兑换失败');
    }
  } catch (err: any) {
    toast.error(err.message || '兑换失败');
  } finally {
    buying.value = false;
  }
}

// --- Recharge & CDK Actions ---
async function handleExchange() {
  const code = exchangeCode.value.trim();
  if (!code) {
    toast.warning('请输入卡密兑换码');
    return;
  }

  exchanging.value = true;
  try {
    const res = await post('/api/shop/exchange', { code });
    if (res && res.code === 200) {
      toast.success(res.msg || '卡密兑换成功！');
      exchangeCode.value = '';
      await appStore.fetchUserInfo();
    } else {
      toast.error(res?.msg || '兑换失败，卡密无效或已被使用');
    }
  } catch (err: any) {
    toast.error(err.message || '网络请求错误');
  } finally {
    exchanging.value = false;
  }
}

async function handlePay() {
  const amount = customAmount.value || selectedAmount.value;
  if (!amount || amount <= 0) {
    toast.warning('请输入有效的充值金额');
    return;
  }

  const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
  isMobile.value = isMob;

  // Mobile WeChat Pay prompt
  if (isMob && payMethod.value === 'wxpay') {
    const confirmed = await confirmModal({
      title: '微信支付提示',
      message: '移动端暂不支持直接拉起微信支付，请前往 PC 端客户端或 MSL 用户中心 (user.mslmc.net) 使用微信支付充值，或选用支付宝支付。',
      confirmText: '前往 MSL 用户中心',
      cancelText: '改用支付宝支付',
      type: 'warning'
    });

    if (confirmed) {
      window.open('https://user.mslmc.net/user/shop', '_blank');
    } else {
      payMethod.value = 'alipay';
    }
    return;
  }

  paying.value = true;
  stopPolling();

  try {
    const res = await post('/api/shop/pay', {
      price: amount,
      pay: payMethod.value,
      device: isMob ? 'mobile' : 'pc'
    });

    if (res && res.code === 200 && res.data) {
      currentOrderNo.value = res.data.out_trade_no;
      const payUrl = res.data.payUrl;
      rawPayUrl.value = payUrl || '';

      if (payUrl) {
        try {
          qrDataUrl.value = await QRCode.toDataURL(payUrl, {
            width: 220,
            margin: 1
          });
        } catch {}

        payDialogVisible.value = true;
        startPollingOrder(currentOrderNo.value);
      } else {
        toast.error('未能获取支付链接');
      }
    } else {
      toast.error(res?.msg || '发起充值订单失败');
    }
  } catch (err: any) {
    toast.error(err.message || '网络请求失败');
  } finally {
    paying.value = false;
  }
}

function redirectMobilePay() {
  if (rawPayUrl.value) {
    window.location.href = rawPayUrl.value;
  }
}

async function checkOrderStatusManual() {
  if (!currentOrderNo.value) return;
  try {
    const res = await get(`/api/shop/getPayResult?order=${currentOrderNo.value}`);
    if (res && res.code === 200) {
      stopPolling();
      payDialogVisible.value = false;
      toast.success('支付成功，积分已实时到账！');
      await appStore.fetchUserInfo();
    } else {
      toast.warning(res?.msg || '未检测到支付成功，请确认是否已完成付款');
    }
  } catch {
    toast.error('查询订单状态失败');
  }
}

function startPollingOrder(orderNo: string) {
  let count = 0;
  pollTimer = setInterval(async () => {
    count++;
    if (count > 60) {
      stopPolling();
      return;
    }

    try {
      const res = await get(`/api/shop/getPayResult?order=${orderNo}`);
      if (res && res.code === 200) {
        stopPolling();
        payDialogVisible.value = false;
        toast.success('支付成功，积分已实时到账！');
        await appStore.fetchUserInfo();
      }
    } catch {}
  }, 2500);
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-2 sm:p-3 md:p-4">
    <!-- Header Card (Matching Reference Card Style) -->
    <div class="shrink-0 p-4 sm:p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h1 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight m-0">增值服务</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          升级服务特权、扩增隧道上限、增加高速流量额度及在线账户充值。
        </p>
      </div>

      <!-- Live Balance Card with Quick Action -->
      <div class="flex items-center self-start sm:self-auto gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs shrink-0 whitespace-nowrap">
        <span>当前余额:</span>
        <span class="font-bold text-sm">{{ appStore.userInfo.score }}</span>
        <span class="text-xs opacity-75">积分</span>
        <button
          v-if="subTab !== 'recharge'"
          @click="subTab = 'recharge'"
          class="ml-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] border-0 cursor-pointer shadow-xs transition-colors"
        >
          充值
        </button>
      </div>
    </div>

    <!-- fnOS Native Pill Segmented Control -->
    <div class="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl mb-6 w-full sm:max-w-xs shrink-0">
      <button
        type="button"
        @click="subTab = 'services'"
        :class="[
          'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer',
          subTab === 'services'
            ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <SparklesIcon class="w-4 h-4" />
        <span>服务项目</span>
      </button>

      <button
        type="button"
        @click="subTab = 'recharge'"
        :class="[
          'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer',
          subTab === 'recharge'
            ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
        ]"
      >
        <CreditCardIcon class="w-4 h-4" />
        <span>充值与卡密</span>
      </button>
    </div>

    <!-- ======================================= -->
    <!-- TAB 1: Services & Goods Cards -->
    <!-- ======================================= -->
    <div v-if="subTab === 'services'" class="flex-1">
      <div v-if="loading && goods.length === 0" class="flex flex-col items-center justify-center py-20 gap-3">
        <div class="w-8 h-8 border-3 border-zinc-200 dark:border-zinc-700 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="text-xs text-zinc-400">正在拉取增值服务...</span>
      </div>

      <div v-else-if="goods.length === 0" class="flex flex-col items-center justify-center py-20 text-zinc-400 text-xs">
        暂无可兑换的增值服务
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-12">
        <div
          v-for="item in goods"
          :key="item.id"
          class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-base text-zinc-900 dark:text-white truncate">{{ item.name }}</span>
                <span class="text-xs text-zinc-400 mt-0.5">编号: #{{ item.id }}</span>
              </div>
              <div class="flex flex-col items-end shrink-0">
                <span
                  v-if="item.price === 0"
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                >
                  完全免费
                </span>
                <span
                  v-else-if="item.originPrice && item.originPrice > item.price"
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                >
                  限时特惠 {{ Math.round((1 - item.price / item.originPrice) * 100) }}% OFF
                </span>
                <div class="flex items-baseline gap-1 mt-1">
                  <span
                    v-if="item.originPrice && item.originPrice > item.price"
                    class="text-xs text-zinc-400 dark:text-zinc-500 line-through font-mono"
                  >
                    {{ item.originPrice }}
                  </span>
                  <span class="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">{{ item.price }}</span>
                  <span class="text-xs text-zinc-400">积分</span>
                </div>
              </div>
            </div>

            <p
              class="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 m-0"
              v-html="item.description.replace(/\n/g, '<br>')"
            >
            </p>
          </div>

          <!-- Action Button -->
          <button
            v-if="item.price === 0"
            disabled
            class="mt-4 w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-semibold cursor-not-allowed border border-zinc-200/60 dark:border-zinc-700/50 shadow-none text-center"
          >
            无需兑换
          </button>
          <button
            v-else-if="appStore.userInfo.score < item.price"
            @click="subTab = 'recharge'"
            class="mt-4 w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50 text-xs font-semibold cursor-pointer shadow-xs transition-all text-center flex items-center justify-center gap-1"
          >
            <span>积分不足 (去充值)</span>
          </button>
          <button
            v-else
            @click="handleBuyClick(item)"
            class="mt-4 w-full py-2.5 rounded-xl text-xs font-semibold border-0 shadow-sm transition-all text-center bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white cursor-pointer"
          >
            立即兑换
          </button>
        </div>
      </div>
    </div>

    <!-- ======================================= -->
    <!-- TAB 2: Recharge & CDK Exchange -->
    <!-- ======================================= -->
    <div v-else class="flex flex-col gap-6 pb-12 max-w-4xl">
      <!-- 1. 在线快捷扫码充值 -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CreditCardIcon class="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">在线扫码充值</h3>
            <p class="text-xs text-zinc-400 m-0 mt-0.5">选择金额与支付渠道，扫码即可自动完成积分充值 (1元 = 100积分)</p>
          </div>
        </div>

        <!-- Amount selector pills -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">充值金额 (元)</label>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <button
              v-for="amt in presetAmounts"
              :key="amt"
              type="button"
              @click="selectedAmount = amt; customAmount = null"
              :class="[
                'py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer',
                selectedAmount === amt && customAmount === null
                  ? 'bg-blue-50 border-blue-600 text-blue-600 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              ]"
            >
              ¥{{ amt }}
            </button>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">支付渠道</label>
          <div class="flex items-center gap-3">
            <button
              type="button"
              @click="payMethod = 'alipay'"
              :class="[
                'flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2',
                payMethod === 'alipay'
                  ? 'bg-blue-50 border-blue-600 text-blue-600 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-300'
                  : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              ]"
            >
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>支付宝支付</span>
            </button>
            <button
              type="button"
              @click="payMethod = 'wxpay'"
              :class="[
                'flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2',
                payMethod === 'wxpay'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-400 dark:text-emerald-300'
                  : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              ]"
            >
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>微信支付</span>
            </button>
          </div>
          <!-- Mobile WeChat Pay Prompt -->
          <p v-if="isMobile && payMethod === 'wxpay'" class="text-[11px] text-amber-600 dark:text-amber-400 m-0 leading-relaxed">
            提示：移动端暂无法直接拉起微信支付，请前往 PC 端客户端或 MSL 用户中心充值，或改用支付宝支付。
          </p>
        </div>

        <button
          @click="handlePay"
          :disabled="paying"
          class="w-full py-3 rounded-xl bg-[#0066ff] hover:bg-[#0055ee] active:scale-[0.99] text-white text-sm font-semibold cursor-pointer border-0 shadow-sm transition-all text-center disabled:opacity-50 mt-2"
        >
          {{ paying ? '正在发起订单...' : `立即充值 ¥${customAmount || selectedAmount}` }}
        </button>
      </div>

      <!-- 2. 卡密 / 兑换码快速兑换 -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <TicketIcon class="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">卡密 / 兑换码激活</h3>
            <p class="text-xs text-zinc-400 m-0 mt-0.5">输入群内活动或第三方购买的 16 位卡密兑换码</p>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model="exchangeCode"
            type="text"
            placeholder="请输入 16 位卡密兑换码..."
            class="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            @click="handleExchange"
            :disabled="exchanging"
            class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold cursor-pointer border-0 shadow-sm transition-all text-center disabled:opacity-50 shrink-0"
          >
            {{ exchanging ? '正在核销...' : '立即兑换卡密' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Buy Confirm Modal -->
    <BaseModal
      v-model="buyDialogVisible"
      title="确认兑换服务"
      maxWidth="max-w-sm"
    >
      <div v-if="selectedGood" class="p-6 flex flex-col gap-4 text-zinc-800 dark:text-zinc-200 text-xs">
        <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col gap-1">
          <span class="font-bold text-sm text-zinc-900 dark:text-white">{{ selectedGood.name }}</span>
          <span class="text-zinc-400">单价: {{ selectedGood.price }} 积分</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="font-medium text-zinc-700 dark:text-zinc-300">购买数量 / 时长:</span>
          <!-- Clean Tailwind Stepper -->
          <div class="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800">
            <button
              type="button"
              @click="buyCount = Math.max(1, buyCount - 1)"
              class="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer border-0 bg-transparent text-sm font-bold"
            >
              -
            </button>
            <span class="w-10 text-center text-xs font-bold text-zinc-900 dark:text-white">{{ buyCount }}</span>
            <button
              type="button"
              @click="buyCount = Math.min(12, buyCount + 1)"
              class="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer border-0 bg-transparent text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span class="font-medium">应付总计:</span>
          <span class="text-base font-bold text-blue-600 dark:text-blue-400">{{ totalPrice }} 积分</span>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            @click="buyDialogVisible = false"
            class="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
          >
            取消
          </button>
          <button
            @click="handleConfirmBuy"
            :disabled="buying"
            class="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0055ee] active:scale-[0.99] text-white border-0 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
          >
            {{ buying ? '正在兑换...' : '确认扣除积分兑换' }}
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- Pay Modal (BaseModal) -->
    <BaseModal
      v-model="payDialogVisible"
      :title="isMobile ? '收银台 (移动端支付)' : '收银台 (扫码支付)'"
      maxWidth="max-w-sm"
      @close="stopPolling"
    >
      <div class="p-6 flex flex-col items-center gap-4 text-center">
        <!-- Target Amount -->
        <div class="flex flex-col items-center gap-1">
          <span class="text-xs text-zinc-400">充值金额</span>
          <div class="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            ¥ {{ customAmount || selectedAmount }}
          </div>
          <span class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full mt-0.5">
            获得 {{ (customAmount || selectedAmount) * 100 }} 积分
          </span>
        </div>

        <!-- Payment Display: Desktop QR Code or Mobile Alipay Button -->
        <div class="p-3 bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="支付二维码" class="w-44 h-44 block" />
          <div v-else class="w-44 h-44 flex items-center justify-center text-xs text-zinc-400">
            二维码生成中...
          </div>
        </div>

        <!-- Mobile Alipay Direct Jump Button -->
        <button
          v-if="isMobile && payMethod === 'alipay' && rawPayUrl"
          type="button"
          @click="redirectMobilePay"
          class="w-full py-2.5 px-4 rounded-xl bg-[#1677FF] hover:bg-[#1260cc] active:scale-[0.99] text-white text-xs font-bold border-0 shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
        >
          <span>一键拉起支付宝 App 支付</span>
        </button>

        <span v-else class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          请使用 {{ payMethod === 'alipay' ? '支付宝' : '微信' }} App 扫一扫完成支付
        </span>

        <!-- Check payment status button -->
        <button
          type="button"
          @click="checkOrderStatusManual"
          class="w-full py-2.5 rounded-xl border border-blue-600/30 text-blue-600 dark:text-blue-400 bg-blue-50/60 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-xs font-semibold cursor-pointer transition-colors"
        >
          我已付款，查收积分
        </button>

        <span class="text-[10px] text-zinc-400 font-mono">
          订单号: {{ currentOrderNo }}
        </span>
      </div>
    </BaseModal>
  </div>
</template>
