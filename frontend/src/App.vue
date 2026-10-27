<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAppStore } from './stores/app';
import Sidebar from './components/Sidebar.vue';
import LoginDialog from './components/LoginDialog.vue';
import DashboardView from './views/DashboardView.vue';
import TunnelsView from './views/TunnelsView.vue';
import DomainsView from './views/DomainsView.vue';
import ShopView from './views/ShopView.vue';
import SettingsView from './views/SettingsView.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import ConfirmModal from './components/common/ConfirmModal.vue';

import {
  Squares2X2Icon,
  RocketLaunchIcon,
  GlobeAltIcon,
  ShoppingBagIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();

const currentViewComponent = computed(() => {
  switch (appStore.currentTab) {
    case 'dashboard': return DashboardView;
    case 'tunnels': return TunnelsView;
    case 'domains': return DomainsView;
    case 'shop': return ShopView;
    case 'settings': return SettingsView;
    default: return DashboardView;
  }
});

onMounted(() => {
  appStore.initAuth();
});
</script>

<template>
  <!-- Outer Window Container (Adapts based on layoutTheme: fnOS vs MSLFrp Native) -->
  <div
    :class="[
      'flex h-screen w-screen overflow-hidden text-zinc-900 dark:text-zinc-100 select-none',
      appStore.layoutTheme === 'fnos'
        ? 'bg-[#f3f3f3] dark:bg-[#0c0c0d]'
        : 'bg-[#f8fafc] dark:bg-[#09090b]'
    ]"
  >
    <!-- Desktop Left Sidebar -->
    <Sidebar class="hidden md:flex" />

    <!-- Main Content Area Wrapper -->
    <main
      :class="[
        'flex-1 flex flex-col h-full min-w-0 overflow-hidden box-border',
        appStore.layoutTheme === 'fnos'
          ? 'md:pt-0 md:pr-2 md:pb-2 md:pl-0'
          : 'relative'
      ]"
    >
      <!-- If fnOS mode: Inset floating card container; if native mode: seamless full-bleed wrapper -->
      <div
        :class="[
          'flex-1 flex flex-col w-full min-h-0 overflow-hidden relative box-border',
          appStore.layoutTheme === 'fnos'
            ? 'bg-white dark:bg-[#232429] md:rounded-[12px] md:border md:border-zinc-200/80 md:dark:border-[#2e3038] shadow-xs'
            : ''
        ]"
      >
        <!-- Mobile Top Bar (Visible only on small screens) -->
        <header
          :class="[
            'md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0',
            appStore.layoutTheme === 'fnos' ? 'bg-white dark:bg-[#232429]' : 'bg-white dark:bg-zinc-900'
          ]"
        >
          <div class="flex items-center gap-2">
            <img src="./assets/logo.png" onerror="this.src='./images/icon_64.png'" alt="MSL" class="w-6 h-6 rounded-lg" />
            <span class="font-bold text-sm text-zinc-900 dark:text-white">MSLFrp 内网映射</span>
          </div>
          <button
            @click="appStore.cycleThemeMode"
            class="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
            :title="`当前模式: ${appStore.themeMode === 'auto' ? '自动 (跟随系统)' : appStore.themeMode === 'dark' ? '深色' : '浅色'} (点击切换)`"
          >
            <ComputerDesktopIcon v-if="appStore.themeMode === 'auto'" class="w-4 h-4 text-blue-500" />
            <MoonIcon v-else-if="appStore.themeMode === 'dark'" class="w-4 h-4 text-blue-400" />
            <SunIcon v-else class="w-4 h-4 text-amber-500" />
          </button>
        </header>

        <!-- View Component Container with KeepAlive -->
        <div :class="['flex-1 overflow-hidden relative', appStore.layoutTheme === 'fnos' ? 'fnos-content-scroll' : '']">
          <KeepAlive>
            <component :is="currentViewComponent" :key="appStore.currentTab" />
          </KeepAlive>
        </div>

        <!-- Mobile Bottom Navigation Bar -->
        <nav
          :class="[
            'md:hidden flex items-center justify-around py-2 border-t border-zinc-200 dark:border-zinc-800 shrink-0 text-[10px]',
            appStore.layoutTheme === 'fnos' ? 'bg-white dark:bg-[#232429]' : 'bg-white dark:bg-zinc-900'
          ]"
        >
          <button
            @click="appStore.currentTab = 'dashboard'"
            :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'dashboard' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
          >
            <Squares2X2Icon class="w-5 h-5 stroke-[1.8]" />
            <span>仪表盘</span>
          </button>
          <button
            @click="appStore.currentTab = 'tunnels'"
            :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'tunnels' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
          >
            <RocketLaunchIcon class="w-5 h-5 stroke-[1.8]" />
            <span>隧道</span>
          </button>
          <button
            @click="appStore.currentTab = 'domains'"
            :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'domains' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
          >
            <GlobeAltIcon class="w-5 h-5 stroke-[1.8]" />
            <span>域名</span>
          </button>
          <button
            @click="appStore.currentTab = 'shop'"
            :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'shop' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
          >
            <ShoppingBagIcon class="w-5 h-5 stroke-[1.8]" />
            <span>服务</span>
          </button>
          <button
            @click="appStore.currentTab = 'settings'"
            :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
          >
            <Cog6ToothIcon class="w-5 h-5 stroke-[1.8]" />
            <span>设置</span>
          </button>
        </nav>
      </div>
    </main>

    <!-- Global Account Login Dialog -->
    <LoginDialog />

    <!-- Global Toast Notifications & Confirm Modals -->
    <ToastContainer />
    <ConfirmModal />
  </div>
</template>
