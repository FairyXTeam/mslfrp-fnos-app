import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, post, setAuthToken, getAuthToken } from '../api/client';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { useTunnelsStore } from './tunnels';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type LayoutTheme = 'native' | 'fnos';

function getSystemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export const useAppStore = defineStore('app', () => {
  const savedLayout = (typeof localStorage !== 'undefined' ? localStorage.getItem('msl_layout_theme') : null) as LayoutTheme | null;
  const initialLayout: LayoutTheme = (savedLayout === 'native' || savedLayout === 'fnos') ? savedLayout : 'fnos';

  const savedTheme = (typeof localStorage !== 'undefined' ? localStorage.getItem('msl_theme') : null) as ThemeMode | null;
  const initialTheme: ThemeMode = (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'auto') ? savedTheme : 'auto';

  const initialDark = (function () {
    if (initialTheme === 'dark') return true;
    if (initialTheme === 'light') return false;
    return getSystemPrefersDark();
  })();

  const currentTab = ref<'dashboard' | 'tunnels' | 'domains' | 'shop' | 'settings'>('dashboard');
  const themeMode = ref<ThemeMode>(initialTheme);
  const layoutTheme = ref<LayoutTheme>(initialLayout);
  const isDarkMode = ref(initialDark);
  const isLoggedIn = ref(false);
  const showLoginDialog = ref(false);
  const loadingUser = ref(false);

  const userInfo = ref({
    uid: 0,
    username: '未登录',
    email: '',
    avatar: 'https://www.mslmc.cn/logo.png',
    score: 0,
    vipOutdated: 0,
    vipLevel: 0,
    userGroupName: '普通用户',
    userGroupNum: 0,
    isVip: false,
    realName: false,
    permission: 0,
    maxTunnels: 3,
    usedTunnels: 0,
    frpToken: '',
    boundLimit: 0
  });

  const isVip = computed(() => {
    return userInfo.value.isVip || userInfo.value.vipOutdated > Math.floor(Date.now() / 1000);
  });

  const isRealNamed = computed(() => {
    return !!userInfo.value.realName;
  });

  function setLayoutTheme(theme: LayoutTheme, syncBackend = true) {
    layoutTheme.value = theme;
    try {
      localStorage.setItem('msl_layout_theme', theme);
    } catch {}
    if (syncBackend) {
      updateAppConfig({ layoutTheme: theme });
    }
  }

  function initLayoutTheme() {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('msl_layout_theme') : null) as LayoutTheme | null;
    if (saved === 'fnos' || saved === 'native') {
      layoutTheme.value = saved;
    }
  }

  function applyTheme(dark: boolean) {
    isDarkMode.value = dark;
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }

  function setThemeMode(mode: ThemeMode, syncBackend = true) {
    themeMode.value = mode;
    try {
      localStorage.setItem('msl_theme', mode);
    } catch {}
    if (mode === 'auto') {
      applyTheme(getSystemPrefersDark());
    } else if (mode === 'dark') {
      applyTheme(true);
    } else {
      applyTheme(false);
    }
    if (syncBackend) {
      updateAppConfig({ themeMode: mode });
    }
  }

  function cycleThemeMode() {
    if (themeMode.value === 'auto') {
      setThemeMode('light');
    } else if (themeMode.value === 'light') {
      setThemeMode('dark');
    } else {
      setThemeMode('auto');
    }
  }

  function setTheme(dark: boolean) {
    setThemeMode(dark ? 'dark' : 'light');
  }

  function toggleTheme() {
    cycleThemeMode();
  }

  function initTheme() {
    initLayoutTheme();
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('msl_theme') : null) as ThemeMode | null;
    const mode: ThemeMode = (saved === 'dark' || saved === 'light' || saved === 'auto') ? saved : 'auto';
    setThemeMode(mode, false);

    // Listen to Browser / OS Theme changes in real time
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (themeMode.value === 'auto') {
          applyTheme(e.matches);
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(listener);
      }
    }

    // Listen to parent fnOS desktop / iframe theme change events
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (!event.data) return;
        const msg = event.data;
        const targetTheme = msg.theme ?? msg.themeMode ?? msg.mode ?? msg.data;
        if (msg.type === 'theme-change' || msg.event === 'theme' || msg.action === 'theme' || msg.type === 'theme') {
          if (themeMode.value === 'auto') {
            if (targetTheme === 'dark' || targetTheme === 20) applyTheme(true);
            else if (targetTheme === 'light' || targetTheme === 10) applyTheme(false);
            else applyTheme(getSystemPrefersDark());
          }
        }
      });

      // Observe DOM class / attribute changes (e.g. if fnOS desktop or injected script mutates html or body)
      if (typeof MutationObserver !== 'undefined') {
        const domObserver = new MutationObserver(() => {
          if (themeMode.value === 'auto') {
            const isHtmlDark = document.documentElement.classList.contains('dark');
            const isBodyDark = document.body.classList.contains('dark') || document.body.getAttribute('theme-mode') === 'dark';
            const hasDark = isHtmlDark || isBodyDark;
            if (isDarkMode.value !== hasDark) {
              applyTheme(hasDark);
            }
          }
        });
        domObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        domObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'theme-mode', 'data-theme'] });
      }
    }
  }

  async function verifyAndFetchUserInfo(): Promise<boolean> {
    loadingUser.value = true;
    try {
      const res = await get('/api/local/auth/verify');
      if (res && res.code === 200 && res.data && res.data.userInfo) {
        const u = res.data.userInfo;
        userInfo.value.uid = u.uid;
        userInfo.value.username = u.username;
        userInfo.value.email = u.email;
        userInfo.value.score = u.score || 0;
        userInfo.value.avatar = u.avatar || (u.qq ? `https://q.qlogo.cn/g?b=qq&nk=${u.qq}&s=640` : 'https://www.mslmc.cn/logo.png');
        userInfo.value.realName = !!u.realName;
        userInfo.value.permission = u.permission || 0;

        if (res.data.frpInfo) {
          const f = res.data.frpInfo;
          userInfo.value.vipOutdated = f.outdated || 0;
          userInfo.value.vipLevel = f.user_group || 0;
          userInfo.value.maxTunnels = f.maxTunnelCount || 3;
          userInfo.value.frpToken = f.token || '';
          userInfo.value.boundLimit = Number((Number(f.boundLimit) / 128).toFixed(0));
          
          const nowSec = Math.floor(Date.now() / 1000);
          if (nowSec > (f.outdated || 0)) {
            userInfo.value.userGroupName = '普通用户';
            userInfo.value.userGroupNum = 0;
            userInfo.value.isVip = false;
          } else {
            userInfo.value.userGroupName = f.user_group_name || (f.user_group > 0 ? 'VIP 用户' : '普通用户');
            userInfo.value.userGroupNum = f.user_group || 0;
            userInfo.value.isVip = true;
          }
        }

        if (res.data.token) {
          setAuthToken(res.data.token);
        }

        isLoggedIn.value = true;

        // If backend detected an account switch, toast warning and sync tunnels store
        if (res.data.accountSwitched) {
          toast.warning('检测到切换登录账号，已自动停止前账号运行的隧道');
          try {
            const tunnelsStore = useTunnelsStore();
            tunnelsStore.fetchTunnels(true);
            tunnelsStore.fetchStatus();
          } catch {}
        }

        return true;
      } else {
        // Token invalid or expired. Do NOT wipe credentials or kill background tunnels!
        isLoggedIn.value = false;
        userInfo.value.username = '未登录';
        return false;
      }
    } catch (e) {
      console.warn('[Auth] Token validation failure:', e);
      isLoggedIn.value = false;
      userInfo.value.username = '未登录';
      return false;
    } finally {
      loadingUser.value = false;
    }
  }

  async function initAuth() {
    // 1. Theme initialization (Defaults to auto following system/browser)
    initTheme();

    // 2. Fetch app persistent configuration from backend (config.json)
    await fetchAppConfig();

    // 3. Always verify token with backend on startup
    const valid = await verifyAndFetchUserInfo();
    if (!valid) {
      isLoggedIn.value = false;
      showLoginDialog.value = true;
    }
  }

  async function saveTokenAndLogin(token: string) {
    setAuthToken(token);
    try {
      await post('/api/local/auth/token', { token });
    } catch {}
    isLoggedIn.value = true;
    showLoginDialog.value = false;
    await verifyAndFetchUserInfo();
  }

  async function logout(promptConfirm?: boolean | Event) {
    const shouldPrompt = promptConfirm !== false;
    if (shouldPrompt) {
      const confirmed = await confirmModal({
        title: '退出登录确认',
        message: '确定要退出当前登录账号吗？已启动的隧道将保持在后台运行，不会被关闭。',
        confirmText: '退出登录',
        cancelText: '取消',
        type: 'danger'
      });
      if (!confirmed) {
        return false;
      }
    }

    try {
      await get('/api/user/logout');
    } catch {}
    try {
      await post('/api/local/auth/logout');
    } catch {}
    setAuthToken('');
    isLoggedIn.value = false;
    userInfo.value = {
      uid: 0,
      username: '未登录',
      email: '',
      avatar: 'https://www.mslmc.cn/logo.png',
      score: 0,
      vipOutdated: 0,
      vipLevel: 0,
      userGroupName: '普通用户',
      userGroupNum: 0,
      isVip: false,
      realName: false,
      permission: 0,
      maxTunnels: 3,
      usedTunnels: 0,
      frpToken: '',
      boundLimit: 0
    };
    toast.info('已退出登录，后台隧道保持运行');
    showLoginDialog.value = true;
    return true;
  }

  async function refreshFrpInfo() {
    try {
      const res = await get('/api/frp/userInfo');
      if (res && res.code === 200 && res.data) {
        const f = res.data;
        userInfo.value.vipOutdated = f.outdated || 0;
        userInfo.value.vipLevel = f.user_group || 0;
        userInfo.value.maxTunnels = f.maxTunnelCount || 3;
        userInfo.value.frpToken = f.token || '';
        userInfo.value.boundLimit = Number((Number(f.boundLimit) / 128).toFixed(0));

        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > (f.outdated || 0)) {
          userInfo.value.userGroupName = '普通用户';
          userInfo.value.userGroupNum = 0;
          userInfo.value.isVip = false;
        } else {
          userInfo.value.userGroupName = f.user_group_name || (f.user_group > 0 ? 'VIP 用户' : '普通用户');
          userInfo.value.userGroupNum = f.user_group || 0;
          userInfo.value.isVip = true;
        }
      }
    } catch (e) {
      console.warn('Failed to refresh frp user info:', e);
    }
  }

  const appConfig = ref<Record<string, any>>({});

  async function fetchAppConfig(): Promise<Record<string, any>> {
    try {
      const res = await get('/api/local/config');
      if (res && res.code === 200 && res.data) {
        appConfig.value = res.data;

        // Dynamic update layout theme from backend config
        if (res.data.layoutTheme && (res.data.layoutTheme === 'fnos' || res.data.layoutTheme === 'native')) {
          if (layoutTheme.value !== res.data.layoutTheme) {
            setLayoutTheme(res.data.layoutTheme, false);
          }
        }

        // Dynamic update color theme mode from backend config
        if (res.data.themeMode && (res.data.themeMode === 'auto' || res.data.themeMode === 'dark' || res.data.themeMode === 'light')) {
          if (themeMode.value !== res.data.themeMode) {
            setThemeMode(res.data.themeMode, false);
          }
        }

        // If backend config is missing layout or theme settings, seed it with current local settings
        if (!res.data.layoutTheme || !res.data.themeMode) {
          const toSync: Record<string, any> = {};
          if (!res.data.layoutTheme) toSync.layoutTheme = layoutTheme.value;
          if (!res.data.themeMode) toSync.themeMode = themeMode.value;
          updateAppConfig(toSync);
        }

        return res.data;
      }
    } catch (err) {
      console.warn('Failed to fetch app config:', err);
    }
    return appConfig.value;
  }

  async function updateAppConfig(partial: Record<string, any>): Promise<Record<string, any>> {
    try {
      appConfig.value = { ...appConfig.value, ...partial };
      const res = await post('/api/local/config', partial);
      if (res && res.code === 200 && res.data) {
        appConfig.value = res.data;
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to update app config:', err);
    }
    return appConfig.value;
  }

  return {
    currentTab,
    themeMode,
    layoutTheme,
    setLayoutTheme,
    initLayoutTheme,
    isDarkMode,
    isLoggedIn,
    showLoginDialog,
    loadingUser,
    userInfo,
    isVip,
    isRealNamed,
    setThemeMode,
    cycleThemeMode,
    setTheme,
    toggleTheme,
    initAuth,
    saveTokenAndLogin,
    logout,
    refreshFrpInfo,
    fetchUserInfo: verifyAndFetchUserInfo,
    appConfig,
    fetchAppConfig,
    updateAppConfig
  };
});
