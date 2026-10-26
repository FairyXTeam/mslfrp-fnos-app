<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/app';
import {
  RocketLaunchIcon,
  GlobeAltIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  UserIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ArrowRightOnRectangleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();

const navItems = [
  { id: 'tunnels', label: '全部隧道', icon: RocketLaunchIcon },
  { id: 'domains', label: '免费子域名', icon: GlobeAltIcon },
  { id: 'shop', label: '增值服务', icon: ShoppingBagIcon },
  { id: 'profile', label: '个人中心', icon: UserIcon },
  { id: 'settings', label: '客户端设置', icon: Cog6ToothIcon },
];

function handleNav(id: string) {
  appStore.currentTab = id as any;
}
</script>

<template>
  <aside class="w-60 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between h-full select-none transition-colors">
    <!-- Top: Logo & Title -->
    <div>
      <div class="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center gap-3">
        <img src="../assets/logo.png" onerror="this.src='./images/icon_64.png'" alt="MSL FRP" class="w-8 h-8 rounded-xl object-contain drop-shadow-sm" />
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">MSLFrp 内网映射</span>
            <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20">fnOS</span>
          </div>
          <span class="text-[11px] text-zinc-400 dark:text-zinc-500">原生穿透服务</span>
        </div>
      </div>

      <!-- Navigation Menu (fnOS native sidebar style) -->
      <nav class="p-3 flex flex-col gap-1">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="handleNav(item.id)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border-0 cursor-pointer',
            appStore.currentTab === item.id
              ? 'bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0 stroke-[1.8]" />
          <span>{{ item.label }}</span>
        </button>

        <div class="h-px bg-zinc-100 dark:bg-zinc-800 my-1 mx-2"></div>

        <a
          href="https://user.mslmc.net/user/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-blue-600 dark:hover:text-blue-400 transition-all no-underline group"
          title="在新窗口打开 MSL 用户中心官网"
        >
          <div class="flex items-center gap-3">
            <GlobeAltIcon class="w-5 h-5 shrink-0 stroke-[1.8]" />
            <span>MSL 用户中心</span>
          </div>
          <ArrowTopRightOnSquareIcon class="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors shrink-0" />
        </a>
      </nav>
    </div>

    <!-- Bottom: User Profile & Actions (fnOS Native Style) -->
    <div class="p-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-2.5">
      <!-- User card -->
      <div
        v-if="appStore.isLoggedIn"
        @click="handleNav('profile')"
        class="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-2 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
        title="点击进入个人中心"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <img
              :src="appStore.userInfo.avatar"
              alt="Avatar"
              class="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 shrink-0 bg-white"
              onerror="this.src='https://www.mslmc.cn/logo.png'"
            />
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{{ appStore.userInfo.username }}</span>
                <span v-if="appStore.userInfo.uid" class="text-[10px] font-mono text-zinc-400 shrink-0">#{{ appStore.userInfo.uid }}</span>
              </div>
              <div class="flex items-center gap-1 mt-0.5">
                <span
                  v-if="appStore.userInfo.userGroupNum > 0"
                  class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                >
                  {{ appStore.userInfo.userGroupName }}
                </span>
                <span v-else class="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {{ appStore.userInfo.userGroupName || '普通用户' }}
                </span>
                <span
                  v-if="appStore.isRealNamed"
                  class="text-[9px] font-medium px-1 py-0.2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  已实名
                </span>
              </div>
            </div>
          </div>
          <button
            @click="appStore.logout"
            title="退出登录"
            class="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border-0 bg-transparent cursor-pointer transition-colors"
          >
            <ArrowRightOnRectangleIcon class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/50">
          <span>积分: <strong class="text-zinc-700 dark:text-zinc-300">{{ appStore.userInfo.score }}</strong></span>
          <span>隧道: <strong class="text-zinc-700 dark:text-zinc-300">{{ appStore.userInfo.usedTunnels }}/{{ appStore.userInfo.maxTunnels || '∞' }}</strong></span>
        </div>
      </div>

      <!-- Not logged in prompt -->
      <button
        v-else
        @click="appStore.showLoginDialog = true"
        class="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold cursor-pointer border-0 shadow-sm transition-all text-center"
      >
        登录 MSL 账号
      </button>

      <!-- Utility bar (Dark mode toggle with 3 states cycle) -->
      <div class="flex items-center justify-between px-1">
        <button
          @click="appStore.cycleThemeMode"
          class="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 bg-transparent border-0 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          :title="`当前: ${appStore.themeMode === 'auto' ? '自动 (跟随系统)' : appStore.themeMode === 'dark' ? '深色模式' : '浅色模式'} (点击切换)`"
        >
          <ComputerDesktopIcon v-if="appStore.themeMode === 'auto'" class="w-4 h-4 text-blue-500" />
          <MoonIcon v-else-if="appStore.themeMode === 'dark'" class="w-4 h-4 text-blue-400" />
          <SunIcon v-else class="w-4 h-4 text-amber-500" />
          <span>{{ appStore.themeMode === 'auto' ? '跟随系统' : appStore.themeMode === 'dark' ? '暗黑模式' : '亮白模式' }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>
