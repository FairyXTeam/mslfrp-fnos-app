import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, post, setAuthToken, getAuthToken } from '../api/client';

export const useAppStore = defineStore('app', () => {
  const currentTab = ref<'tunnels' | 'domains' | 'shop' | 'profile' | 'settings'>('tunnels');
  const isDarkMode = ref(false);
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

  function setTheme(dark: boolean) {
    isDarkMode.value = dark;
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('msl_theme', dark ? 'dark' : 'light');
  }

  function toggleTheme() {
    setTheme(!isDarkMode.value);
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
        return true;
      } else {
        await logout(false);
        return false;
      }
    } catch (e) {
      console.warn('[Auth] Token validation failure:', e);
      await logout(false);
      return false;
    } finally {
      loadingUser.value = false;
    }
  }

  async function initAuth() {
    // 1. Theme initialization
    const savedTheme = localStorage.getItem('msl_theme');
    if (savedTheme) {
      setTheme(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark);
    }

    // 2. Always verify token with backend on startup
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

  async function logout(promptDialog = true) {
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
    if (promptDialog) {
      showLoginDialog.value = true;
    }
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

  return {
    currentTab,
    isDarkMode,
    isLoggedIn,
    showLoginDialog,
    loadingUser,
    userInfo,
    isVip,
    isRealNamed,
    setTheme,
    toggleTheme,
    initAuth,
    saveTokenAndLogin,
    logout,
    refreshFrpInfo,
    fetchUserInfo: verifyAndFetchUserInfo
  };
});
