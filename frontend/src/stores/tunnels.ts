import { defineStore } from 'pinia';
import { ref } from 'vue';
import { get, post } from '../api/client';
import { useAppStore } from './app';

export interface FrpNode {
  id: number;
  name: string;
  domain: string;
  ip: string;
  status: number;
  bandwidth: number;
  need_real_name: number;
  allow_user_group: number;
  udp_support: number;
  http_support: number;
  kcp_support: number;
  wss_support: number;
  min_open_port: number;
  max_open_port: number;
  remarks: string;
}

export interface FrpTunnel {
  id: number;
  name: string;
  type: string;
  local_ip: string;
  local_port: number;
  remote_port: number;
  remarks: string;
  bind_domain: string | null;
  node_id: number;
  node_name: string;
  node_ip: string;
  node_domain: string;
  addr_domain: string;
  addr_ip: string;
  ban: string | null;
  protocol: string;
  today_traffic: number;
  total_traffic: number;
  status: number; // 0 or 1 from cloud
}

export interface TunnelLiveStatus {
  running: boolean;
  pid: number | null;
  startTime: number | null;
  uptime: number;
}

export const useTunnelsStore = defineStore('tunnels', () => {
  const loading = ref(false);
  const nodes = ref<FrpNode[]>([]);
  const tunnels = ref<FrpTunnel[]>([]);
  const statusMap = ref<Record<number, TunnelLiveStatus>>({});
  const activeLogTunnelId = ref<number | null>(null);
  const autostartIds = ref<number[]>([]);
  const currentFilter = ref<'all' | 'running' | 'stopped' | 'remote'>('all');

  async function fetchAutostart() {
    try {
      const res = await get('/api/local/tunnel/autostart');
      if (res && res.code === 200 && Array.isArray(res.data)) {
        autostartIds.value = res.data;
      }
    } catch (e) {
      console.warn('Failed to fetch autostart tunnels:', e);
    }
  }

  async function toggleAutostart(tunnelId: number, enable?: boolean) {
    const isCurrently = autostartIds.value.includes(tunnelId);
    const targetState = enable !== undefined ? enable : !isCurrently;
    try {
      const res = await post('/api/local/tunnel/autostart', { id: tunnelId, autostart: targetState });
      if (res && res.code === 200 && Array.isArray(res.data)) {
        autostartIds.value = res.data;
        return targetState;
      }
    } catch (e: any) {
      throw new Error(e.message || '更新自启动状态失败');
    }
    return targetState;
  }

  async function fetchNodes() {
    try {
      const res = await get('/api/frp/nodeList');
      if (res && res.code === 200 && Array.isArray(res.data)) {
        nodes.value = res.data.map((item: any) => ({
          id: item.id,
          name: item.node,
          domain: item.domain || '',
          ip: item.ip || '',
          status: item.status,
          bandwidth: item.bandwidth || 0,
          need_real_name: item.need_real_name || 0,
          allow_user_group: item.allow_user_group || 0,
          udp_support: item.udp_support || 0,
          http_support: item.http_support || 0,
          kcp_support: item.kcp_support || 0,
          wss_support: item.wss_support || 0,
          min_open_port: item.min_open_port || 10000,
          max_open_port: item.max_open_port || 65535,
          remarks: item.remarks || ''
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch node list:', e);
    }
  }

  async function fetchTunnels(silent = false) {
    if (!silent && tunnels.value.length === 0) {
      loading.value = true;
    }
    try {
      if (nodes.value.length === 0) {
        await fetchNodes();
      }

      const res = await get('/api/frp/getTunnelList');
      if (res && res.code === 200 && Array.isArray(res.data)) {
        tunnels.value = res.data.map((item: any) => {
          const matchedNode = nodes.value.find(n => n.id === item.node_id);
          const isWeb = (item.type || '').toLowerCase() === 'http' || (item.type || '').toLowerCase() === 'https';
          const addrDomain = isWeb && item.bind_domain
            ? item.bind_domain
            : (matchedNode?.domain ? `${matchedNode.domain}:${item.remote_port}` : (matchedNode?.ip ? `${matchedNode.ip}:${item.remote_port}` : ''));
          const addrIp = matchedNode?.ip ? `${matchedNode.ip}:${item.remote_port}` : '';

          return {
            id: item.id,
            name: item.name,
            type: (item.type || 'TCP').toUpperCase(),
            local_ip: item.local_ip || '127.0.0.1',
            local_port: item.local_port || 25565,
            remote_port: item.remote_port,
            remarks: item.remarks || '',
            bind_domain: item.bind_domain || null,
            node_id: item.node_id,
            node_name: matchedNode?.name || `节点 #${item.node_id}`,
            node_ip: matchedNode?.ip || '',
            node_domain: matchedNode?.domain || '',
            addr_domain: addrDomain,
            addr_ip: addrIp,
            ban: item.ban || null,
            protocol: item.protocol || (item.use_kcp === 1 ? 'kcp' : 'tcp'),
            today_traffic: (item.today_traffic || 0) + (item.today_traffic_in || 0),
            total_traffic: (item.total_traffic || 0) + (item.total_traffic_in || 0),
            status: Number(item.status) || 0
          };
        });

        // Update total tunnels in appStore
        const appStore = useAppStore();
        appStore.userInfo.usedTunnels = tunnels.value.length;

        // Fetch live local running status
        await fetchLiveStatuses();
        await fetchAutostart();
      }
    } catch (e) {
      console.warn('Failed to fetch tunnel list:', e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchLiveStatuses() {
    if (tunnels.value.length === 0) return;
    try {
      const ids = tunnels.value.map(t => t.id);
      const res = await post('/api/local/tunnel/status', { ids });
      if (res && res.code === 200 && res.data) {
        statusMap.value = res.data;
      }
    } catch (e) {
      // Backend might be offline or socket connecting
    }
  }

  async function startTunnel(tunnelId: number) {
    const res = await post('/api/local/tunnel/start', { id: tunnelId });
    if (res && res.code === 200) {
      statusMap.value[tunnelId] = {
        running: true,
        pid: res.data?.pid || null,
        startTime: Date.now(),
        uptime: 0
      };
      await fetchLiveStatuses();
      await fetchTunnels();
      return res;
    }
    throw new Error(res?.msg || '启动隧道失败');
  }

  async function stopTunnel(tunnelId: number) {
    const res = await post('/api/local/tunnel/stop', { id: tunnelId });
    if (res && res.code === 200) {
      statusMap.value[tunnelId] = {
        running: false,
        pid: null,
        startTime: null,
        uptime: 0
      };
      await fetchLiveStatuses();
      await fetchTunnels();
      return res;
    }
    throw new Error(res?.msg || '停止隧道失败');
  }

  async function deleteTunnel(tunnelId: number) {
    // Stop locally first if running
    try { await stopTunnel(tunnelId); } catch {}
    const res = await post('/api/frp/deleteTunnel', { id: tunnelId });
    if (res && res.code === 200) {
      await fetchTunnels();
      return res;
    }
    throw new Error(res?.msg || '删除隧道失败');
  }

  return {
    loading,
    nodes,
    tunnels,
    statusMap,
    activeLogTunnelId,
    autostartIds,
    currentFilter,
    fetchNodes,
    fetchTunnels,
    fetchLiveStatuses,
    fetchAutostart,
    toggleAutostart,
    startTunnel,
    stopTunnel,
    deleteTunnel
  };
});
