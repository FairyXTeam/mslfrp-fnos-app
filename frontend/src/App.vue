<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAppStore } from './stores/app';
import Sidebar from './components/Sidebar.vue';
import LoginDialog from './components/LoginDialog.vue';
import TunnelsView from './views/TunnelsView.vue';
import DomainsView from './views/DomainsView.vue';
import ShopView from './views/ShopView.vue';
import ProfileView from './views/ProfileView.vue';
import SettingsView from './views/SettingsView.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import ConfirmModal from './components/common/ConfirmModal.vue';

import {
  RocketLaunchIcon,
  GlobeAltIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  UserIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/vue/24/outline';

const appStore = useAppStore();

const currentViewComponent = computed(() => {
  switch (appStore.currentTab) {
    case 'tunnels': return TunnelsView;
    case 'domains': return DomainsView;
    case 'shop': return ShopView;
    case 'profile': return ProfileView;
    case 'settings': return SettingsView;
    default: return TunnelsView;
  }
});

onMounted(() => {
  appStore.initAuth();
});
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-[#f8fafc] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 select-none">
    <!-- Desktop Left Sidebar -->
    <Sidebar class="hidden md:flex" />

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
      <!-- Mobile Top Bar (Visible only on small screens) -->
      <header class="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div class="flex items-center gap-2">
          <img src="./assets/logo.png" onerror="this.src='./images/icon_64.png'" alt="MSL" class="w-6 h-6 rounded-lg" />
          <span class="font-bold text-sm text-zinc-900 dark:text-white">MSLFrp 内网映射</span>
        </div>
        <button
          @click="appStore.toggleTheme"
          class="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
        >
          <MoonIcon v-if="appStore.isDarkMode" class="w-4 h-4" />
          <SunIcon v-else class="w-4 h-4" />
        </button>
      </header>

      <!-- View Component Container with KeepAlive -->
      <div class="flex-1 overflow-hidden">
        <KeepAlive>
          <component :is="currentViewComponent" :key="appStore.currentTab" />
        </KeepAlive>
      </div>

      <!-- Mobile Bottom Navigation Bar -->
      <nav class="md:hidden flex items-center justify-around py-2 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 text-[10px]">
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
          @click="appStore.currentTab = 'profile'"
          :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'profile' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
        >
          <UserIcon class="w-5 h-5 stroke-[1.8]" />
          <span>我的</span>
        </button>
        <button
          @click="appStore.currentTab = 'settings'"
          :class="['flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer p-1', appStore.currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-zinc-500']"
        >
          <Cog6ToothIcon class="w-5 h-5 stroke-[1.8]" />
          <span>设置</span>
        </button>
      </nav>
    </main>

    <!-- Global Account Login Dialog -->
    <LoginDialog />

    <!-- Global Toast Notifications & Confirm Modals (Pure Tailwind / fnOS Native) -->
    <ToastContainer />
    <ConfirmModal />
  </div>
</template>
