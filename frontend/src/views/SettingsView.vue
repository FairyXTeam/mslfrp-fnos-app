<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from '../utils/toast';
import { get, post, getAuthToken } from '../api/client';
import { useAppStore } from '../stores/app';
import { useTunnelsStore } from '../stores/tunnels';
import {
  Cog6ToothIcon,
  KeyIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();
const tunnelsStore = useTunnelsStore();

const frpcInfo = ref<{ installed: boolean; arch: string; path: string }>({
  installed: false,
  arch: 'amd64',
  path: ''
});
const checkingFrpc = ref(false);
const downloadingFrpc = ref(false);

onMounted(async () => {
  await fetchFrpcInfo();
  if (tunnelsStore.tunnels.length === 0) {
    await tunnelsStore.fetchTunnels();
  } else {
    await tunnelsStore.fetchAutostart();
  }
});

async function handleToggleAutostart(id: number) {
  try {
    const newState = await tunnelsStore.toggleAutostart(id);
    toast.success(newState ? '已开启开机自启动' : '已关闭开机自启动');
  } catch (err: any) {
    toast.error(err.message || '设置自启动失败');
  }
}

async function fetchFrpcInfo() {
  checkingFrpc.value = true;
  try {
    const res = await get('/api/local/frpc/info');
    if (res && res.code === 200 && res.data) {
      frpcInfo.value = res.data;
    }
  } catch {}
  finally {
    checkingFrpc.value = false;
  }
}

async function handleDownloadFrpc() {
  downloadingFrpc.value = true;
  try {
    const res = await post('/api/local/frpc/ensure');
    if (res && res.code === 200) {
      toast.success('frpc 客户端核心下载完成！');
      await fetchFrpcInfo();
    } else {
      toast.error(res?.msg || '下载失败');
    }
  } catch (err: any) {
    toast.error(err.message || '下载请求异常');
  } finally {
    downloadingFrpc.value = false;
  }
}

function handleReLogin() {
  appStore.showLoginDialog = true;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-3.5 sm:p-6 md:p-8">
    <!-- Header -->
    <div class="flex items-start sm:items-center justify-between gap-3 mb-5 sm:mb-6">
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight m-0">客户端与系统设置</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          管理本地 frpc 核心运行时、飞牛网关集成以及 MSL 账户凭证。
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
      <!-- 1. frpc Core Status -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between gap-5">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Cog6ToothIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">frpc 穿透核心</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">负责在飞牛系统后台执行端口映射穿透的底层组件</p>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">检测到宿主架构:</span>
              <span class="font-mono font-bold text-zinc-900 dark:text-white uppercase">{{ frpcInfo.arch }} (Linux)</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">核心就绪状态:</span>
              <span :class="['font-bold flex items-center gap-1.5', frpcInfo.installed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500']">
                <span :class="['w-2 h-2 rounded-full inline-block', frpcInfo.installed ? 'bg-emerald-500' : 'bg-amber-500']"></span>
                <span>{{ frpcInfo.installed ? '已就绪' : '未安装 (启动时自动下载)' }}</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">程序存储路径:</span>
              <span class="font-mono text-[11px] text-zinc-400 truncate max-w-[240px]">{{ frpcInfo.path || 'bin/frpc' }}</span>
            </div>
          </div>
        </div>

        <button
          @click="handleDownloadFrpc"
          :disabled="downloadingFrpc"
          class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer border-0 shadow-sm transition-colors text-center disabled:opacity-50"
        >
          {{ downloadingFrpc ? '正在从 MSL 下载核心...' : (frpcInfo.installed ? '重新下载 / 强制更新核心' : '立即下载 frpc 核心') }}
        </button>
      </div>

      <!-- 2. Account & Token Management -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between gap-5">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <KeyIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">账户凭证与授权</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">采用 MSL 统一授权登录，凭证持久化于本地 NAS</p>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">关联账户:</span>
              <div class="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                <span>{{ appStore.userInfo.username }}</span>
                <span v-if="appStore.userInfo.uid" class="font-mono text-zinc-400 dark:text-zinc-500 font-normal">(UID: {{ appStore.userInfo.uid }})</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">用户 UID:</span>
              <span class="font-mono font-bold text-zinc-900 dark:text-white">#{{ appStore.userInfo.uid || '未获取' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">实名认证状态:</span>
              <span :class="['font-semibold', appStore.isRealNamed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500']">
                {{ appStore.isRealNamed ? '已通过实名' : '未实名认证' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">登录状态:</span>
              <span class="font-mono text-[11px] text-zinc-400 truncate max-w-[200px]">
                {{ getAuthToken() ? '已授权登录' : '未登录' }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="handleReLogin"
            class="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-center"
          >
            重新授权登录
          </button>
          <button
            @click="appStore.logout"
            class="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer hover:bg-rose-100 transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>

      <!-- 3. Tunnel Autostart Management -->
      <div class="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <BoltIcon class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">开机自启动隧道</h3>
              <p class="text-xs text-zinc-400 m-0 mt-0.5">当飞牛 NAS 或本应用后台启动时，自动唤醒并运行选中的穿透隧道</p>
            </div>
          </div>
          <span class="text-xs font-medium text-zinc-500">
            已启用 {{ tunnelsStore.autostartIds.length }} / {{ tunnelsStore.tunnels.length }} 条
          </span>
        </div>

        <div v-if="tunnelsStore.tunnels.length === 0" class="py-8 text-center text-xs text-zinc-400">
          暂无已创建的隧道，请先在“全部隧道”中新建隧道。
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          <div
            v-for="tun in tunnelsStore.tunnels"
            :key="tun.id"
            class="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between gap-3"
          >
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">{{ tun.name }}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 shrink-0">
                  {{ tun.type }}
                </span>
              </div>
              <span class="text-[11px] text-zinc-400 truncate mt-0.5">节点: {{ tun.node_name }}</span>
            </div>

            <button
              type="button"
              @click="handleToggleAutostart(tun.id)"
              :class="[
                'w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer border-0 shrink-0',
                tunnelsStore.autostartIds.includes(tun.id)
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700/80 dark:hover:bg-zinc-600 text-transparent'
              ]"
              :title="tunnelsStore.autostartIds.includes(tun.id) ? '已配置开机自启' : '未开启开机自启'"
            >
              <CheckIcon class="w-4 h-4 stroke-[3] text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
