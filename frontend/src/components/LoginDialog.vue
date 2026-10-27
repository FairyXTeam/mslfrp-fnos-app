<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { toast } from '../utils/toast';
import { useAppStore } from '../stores/app';
import { get, post } from '../api/client';
import QRCode from 'qrcode';
import BaseModal from './common/BaseModal.vue';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  QrCodeIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();

const activeTab = ref<'popup' | 'wechat' | 'qrcode'>('popup');

// Tab 1 & Tab 3: MSL Device OAuth state
const loading = ref(false);
const authUrl = ref('');
const currentSessionId = ref('');
const qrCodeDataUrl = ref('');
let pollTimer: any = null;
const authStatus = ref<'idle' | 'waiting' | 'success' | 'expired'>('idle');
let authWindowRef: Window | null = null;

// Tab 2: WeChat Mini-Program Login state
const wechatLoading = ref(false);
const wechatQrCode = ref('');
const wechatSessionId = ref('');
const wechatStatus = ref<'pending' | 'scanned' | 'expired'>('pending');
let wechatPollTimer: any = null;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function stopWechatPolling() {
  if (wechatPollTimer) {
    clearInterval(wechatPollTimer);
    wechatPollTimer = null;
  }
}

// 1. Device Flow (Tab 1 & 3)
async function startOAuthFlow() {
  stopPolling();
  loading.value = true;
  authStatus.value = 'idle';
  authUrl.value = '';
  qrCodeDataUrl.value = '';

  try {
    const res = await post('/api/local/auth/oauth/start');

    if (res && res.code === 200 && res.data && res.data.url) {
      authUrl.value = res.data.url;
      currentSessionId.value = res.data.sessionId;
      authStatus.value = 'waiting';

      // Generate QR Code for Tab 3
      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(res.data.url, {
          width: 220,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
      } catch (qrErr) {
        console.error('Failed to generate QR code', qrErr);
      }

      // Start polling
      startPolling(res.data.sessionId);
    } else {
      toast.error(res?.msg || '创建授权会话失败');
    }
  } catch (err: any) {
    toast.error(err.message || '请求后端授权接口异常');
  } finally {
    loading.value = false;
  }
}

function startPolling(sessionId: string) {
  stopPolling();
  let attempts = 0;
  const maxAttempts = 200; // 5 minutes

  pollTimer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      stopPolling();
      authStatus.value = 'expired';
      return;
    }

    try {
      const res = await get('/api/local/auth/oauth/poll', { sessionId });
      if (res && res.code === 200 && res.data) {
        if (res.data.status === 'success' && res.data.token) {
          stopPolling();
          authStatus.value = 'success';

          // Auto-close popup authorization window
          if (authWindowRef) {
            try {
              authWindowRef.close();
            } catch {}
            authWindowRef = null;
          }

          await appStore.saveTokenAndLogin(res.data.token);
          toast.success(`欢迎回来，${res.data.username || '用户'}`);
          appStore.showLoginDialog = false;
        } else if (res.data.status === 'expired') {
          stopPolling();
          authStatus.value = 'expired';
        }
      } else if (res && res.code !== 200) {
        stopPolling();
        authStatus.value = 'expired';
      }
    } catch {
      // Continue polling
    }
  }, 1500);
}

// Open dedicated small window
function openAuthPopup() {
  if (!authUrl.value) return;
  const width = 520;
  const height = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  authWindowRef = window.open(
    authUrl.value,
    'MSL_Auth_Popup',
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
  );
}

function copyAuthUrl() {
  if (!authUrl.value) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(authUrl.value).then(() => {
      toast.success('授权链接已复制到剪贴板');
    }).catch(() => fallbackCopy(authUrl.value));
  } else {
    fallbackCopy(authUrl.value);
  }
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    toast.success('授权链接已复制到剪贴板');
  } catch {
    toast.error('复制失败，请手动打开链接');
  }
  document.body.removeChild(ta);
}

// 2. WeChat Mini-Program Login (Tab 2)
async function startWechatFlow() {
  stopWechatPolling();
  wechatLoading.value = true;
  wechatQrCode.value = '';
  wechatSessionId.value = '';
  wechatStatus.value = 'pending';

  try {
    const res = await post('/api/local/auth/wechat/start', {
      type: 'qrcode'
    });
    if (res && res.code === 200 && res.data) {
      wechatQrCode.value = res.data.qrcode || '';
      wechatSessionId.value = res.data.sessionId || '';
      startWechatPolling(res.data.sessionId);
    } else {
      toast.error(res?.msg || '获取微信授权信息失败');
      wechatStatus.value = 'expired';
    }
  } catch (err: any) {
    toast.error('请求微信授权接口失败');
    wechatStatus.value = 'expired';
  } finally {
    wechatLoading.value = false;
  }
}

function startWechatPolling(sessionId: string) {
  stopWechatPolling();
  if (!sessionId) return;

  wechatPollTimer = setInterval(async () => {
    try {
      const res = await get('/api/local/auth/wechat/poll', { sessionId });
      if (res && res.code === 200 && res.data) {
        if (res.data.status === 'success' && res.data.token) {
          stopWechatPolling();
          wechatStatus.value = 'scanned';
          await appStore.saveTokenAndLogin(res.data.token);
          toast.success('微信登录成功！');
          appStore.showLoginDialog = false;
        } else if (res.data.status === 'expired' || res.data.status === 'failed') {
          stopWechatPolling();
          wechatStatus.value = 'expired';
          if (res.msg) toast.error(res.msg);
        }
      } else if (res && res.code !== 200) {
        stopWechatPolling();
        wechatStatus.value = 'expired';
      }
    } catch {
      // Continue polling
    }
  }, 2000);
}

watch(activeTab, (tab) => {
  if (tab === 'wechat') {
    if (!wechatQrCode.value) {
      startWechatFlow();
    }
  } else {
    if (!authUrl.value) {
      startOAuthFlow();
    }
  }
});

watch(
  () => appStore.showLoginDialog,
  (show) => {
    if (show) {
      if (activeTab.value === 'wechat') {
        startWechatFlow();
      } else {
        startOAuthFlow();
      }
    } else {
      stopPolling();
      stopWechatPolling();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  stopPolling();
  stopWechatPolling();
});
</script>

<template>
  <BaseModal
    v-model="appStore.showLoginDialog"
    title="登录 MSL 账户"
    maxWidth="max-w-[420px]"
    :showClose="appStore.isLoggedIn"
    :closeOnClickOverlay="appStore.isLoggedIn"
  >
    <div class="flex flex-col items-center p-6 select-none">
      <!-- 3-Way Tab Switcher (fnOS Native pill tabs) -->
      <div class="w-full flex p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl mb-6">
        <button
          type="button"
          @click="activeTab = 'popup'"
          :class="[
            'flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer',
            activeTab === 'popup'
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
          ]"
        >
          <SparklesIcon class="w-4 h-4" />
          <span>网页登录</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'wechat'"
          :class="[
            'flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer',
            activeTab === 'wechat'
              ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
          ]"
        >
          <ChatBubbleLeftRightIcon class="w-4 h-4" />
          <span>微信登录</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'qrcode'"
          :class="[
            'flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer',
            activeTab === 'qrcode'
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent'
          ]"
        >
          <QrCodeIcon class="w-4 h-4" />
          <span>扫码登录</span>
        </button>
      </div>

      <!-- ============================================ -->
      <!-- TAB 1: Web Popup Window (网页登录) -->
      <!-- ============================================ -->
      <div v-if="activeTab === 'popup'" class="w-full flex flex-col items-center">
        <!-- Loading -->
        <div v-if="loading" class="py-12 flex flex-col items-center gap-3 text-zinc-400">
          <ArrowPathIcon class="w-7 h-7 animate-spin text-blue-500" />
          <span class="text-xs">正在准备登录会话...</span>
        </div>

        <div v-else class="w-full flex flex-col items-center">
          <!-- Illustration & Title -->
          <div class="mb-6 flex flex-col items-center text-center">
            <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-xs">
              <ShieldCheckIcon class="w-6 h-6 stroke-[1.8]" />
            </div>
            <h4 class="text-base font-bold text-zinc-900 dark:text-white m-0 tracking-tight">MSL 账号快捷登录</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 m-0 max-w-xs leading-relaxed">
              在弹出窗口中登录或确认授权即可完成绑定
            </p>
          </div>

          <!-- Primary Action Button -->
          <button
            type="button"
            @click="openAuthPopup"
            class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer border-0 shadow-sm transition-all"
          >
            <span>打开登录窗口</span>
            <ArrowTopRightOnSquareIcon class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Fallback direct open -->
          <div class="mt-3.5 flex items-center justify-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <button
              type="button"
              @click="openAuthPopup"
              class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-transparent border-0 cursor-pointer p-0 text-xs"
            >
              若未自动弹出，点击打开登录窗口
            </button>
          </div>

          <!-- Live Status Indicator -->
          <div class="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 text-[11px]">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>等待授权中...</span>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- TAB 2: WeChat Mini-Program (微信小程序扫码登录) -->
      <!-- ============================================ -->
      <div v-else-if="activeTab === 'wechat'" class="w-full flex flex-col items-center text-center">
        <div v-if="wechatLoading" class="py-12 flex flex-col items-center gap-3 text-zinc-400">
          <ArrowPathIcon class="w-7 h-7 animate-spin text-emerald-500" />
          <span class="text-xs">正在生成小程序码...</span>
        </div>

        <div v-else class="flex flex-col items-center w-full">
          <div class="mb-4">
            <h4 class="text-base font-bold text-zinc-900 dark:text-white m-0 tracking-tight">
              微信扫码登录
            </h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0">
              请使用微信扫描下方小程序码
            </p>
          </div>

          <!-- Mini-Program QR Code Frame -->
          <div class="relative p-2.5 bg-white rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <img
              v-if="wechatQrCode"
              :src="wechatQrCode"
              alt="微信小程序码"
              class="w-48 h-48 block rounded-xl object-contain"
            />
            <div v-else class="w-48 h-48 flex items-center justify-center text-xs text-zinc-400">
              加载中...
            </div>

            <!-- Expired Mask -->
            <div
              v-if="wechatStatus === 'expired'"
              class="absolute inset-0 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-xs"
            >
              <span class="text-zinc-500 font-medium">二维码已失效</span>
              <button
                @click="startWechatFlow"
                class="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer border-0 shadow-sm"
              >
                刷新二维码
              </button>
            </div>
          </div>

          <!-- Status badge -->
          <div class="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>请使用绑定了 MSL 账号的微信授权</span>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- TAB 3: Device QR Code (手机扫码登录) -->
      <!-- ============================================ -->
      <div v-else class="w-full flex flex-col items-center text-center">
        <div v-if="loading" class="py-12 flex flex-col items-center gap-3 text-zinc-400">
          <ArrowPathIcon class="w-7 h-7 animate-spin text-blue-500" />
          <span class="text-xs">正在生成二维码...</span>
        </div>

        <div v-else class="flex flex-col items-center">
          <div class="mb-3">
            <h4 class="text-base font-bold text-zinc-900 dark:text-white m-0 tracking-tight">手机扫码登录</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0">使用手机相机或扫一扫完成授权</p>
          </div>

          <!-- Device QR Code Box -->
          <div class="relative p-2.5 bg-white rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <img
              v-if="qrCodeDataUrl"
              :src="qrCodeDataUrl"
              alt="授权二维码"
              class="w-48 h-48 block rounded-xl"
            />

            <!-- Expired Mask -->
            <div
              v-if="authStatus === 'expired'"
              class="absolute inset-0 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-xs"
            >
              <span class="text-zinc-500 font-medium">二维码已失效</span>
              <button
                @click="startOAuthFlow"
                class="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer border-0 shadow-sm"
              >
                刷新二维码
              </button>
            </div>
          </div>

          <!-- Copy Link Button -->
          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              @click="copyAuthUrl"
              class="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 border-0 cursor-pointer transition-colors"
            >
              <ClipboardDocumentIcon class="w-3.5 h-3.5" />
              <span>复制授权链接</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
