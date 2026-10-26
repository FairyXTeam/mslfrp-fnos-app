<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from '../utils/toast';
import { confirmModal } from '../utils/confirm';
import { get, post } from '../api/client';
import { useTunnelsStore } from '../stores/tunnels';
import BaseModal from '../components/common/BaseModal.vue';
import BaseSelect, { SelectOption } from '../components/common/BaseSelect.vue';
import {
  GlobeAltIcon,
  CubeIcon,
  LinkIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/vue/24/outline';

const tunnelsStore = useTunnelsStore();

interface DomainSuffix {
  id: number;
  domain: string;
}

interface DnsRecord {
  id: number;
  domain: string;
  name: string;
  type: string;
  record: string;
  ttl?: number;
}

const loading = ref(false);
const subdomains = ref<DomainSuffix[]>([]);
const records = ref<DnsRecord[]>([]);
const dialogVisible = ref(false);

const addMode = ref<'mc_srv' | 'custom'>('mc_srv');
const selectedTunnelId = ref<number | null>(null);

const form = ref({
  domain_id: null as number | null,
  name: '',
  type: 'A',
  record: '',
  ttl: 600
});

const tunnelOptions = computed<SelectOption[]>(() => {
  return tunnelsStore.tunnels
    .filter((tun) => tun.type === 'TCP')
    .map((t) => ({
      label: `${t.name} (端口: ${t.remote_port})`,
      value: t.id,
      description: `节点: ${t.node_name}`
    }));
});

const suffixOptions = computed<SelectOption[]>(() => {
  return subdomains.value.map((d) => ({
    label: d.domain,
    value: d.id
  }));
});

const recordTypeOptions: SelectOption[] = [
  { label: 'A 记录 (指向 IPv4 地址)', value: 'A' },
  { label: 'CNAME 记录 (指向别名域名)', value: 'CNAME' },
  { label: 'AAAA 记录 (指向 IPv6 地址)', value: 'AAAA' },
  { label: 'TXT 记录 (文本验证)', value: 'TXT' }
];

onMounted(async () => {
  await fetchAll();
});

async function fetchAll() {
  loading.value = true;
  try {
    const [subRes, recRes] = await Promise.all([
      get('/api/domain/list'),
      get('/api/domain/dns/list')
    ]);

    if (subRes && subRes.code === 200 && Array.isArray(subRes.data)) {
      subdomains.value = subRes.data;
      if (subdomains.value.length > 0 && !form.value.domain_id) {
        form.value.domain_id = subdomains.value[0].id;
      }
    }

    if (recRes && recRes.code === 200 && Array.isArray(recRes.data)) {
      records.value = recRes.data;
    }
  } catch (err: any) {
    toast.error(err.message || '获取子域名数据失败');
  } finally {
    loading.value = false;
  }
}

function handleTunnelSelect(tunnelId: number) {
  selectedTunnelId.value = tunnelId;
  const tunnel = tunnelsStore.tunnels.find((t) => t.id === tunnelId);
  if (!tunnel) return;

  const nodeHost = tunnel.node_domain || tunnel.node_ip || 'node.mslmc.net';
  form.value.type = 'SRV';
  form.value.record = `0 5 ${tunnel.remote_port} ${nodeHost}`;
}

async function handleCreateRecord() {
  if (!form.value.domain_id) {
    toast.warning('请选择主域名后缀');
    return;
  }
  if (!form.value.name.trim()) {
    toast.warning('请输入前缀主机记录');
    return;
  }
  if (!form.value.record.trim()) {
    toast.warning('请输入指向记录值');
    return;
  }

  let finalName = form.value.name.trim();
  if (addMode.value === 'mc_srv' && !finalName.startsWith('_minecraft._tcp.')) {
    finalName = `_minecraft._tcp.${finalName}`;
  }

  try {
    const payload = {
      domain_id: form.value.domain_id,
      name: finalName,
      type: addMode.value === 'mc_srv' ? 'SRV' : form.value.type,
      record: form.value.record.trim(),
      ttl: form.value.ttl || 600
    };

    const res = await post('/api/domain/dns/add', payload);
    if (res && res.code === 200) {
      toast.success('子域名解析添加成功！');
      dialogVisible.value = false;
      form.value.name = '';
      form.value.record = '';
      await fetchAll();
    } else {
      toast.error(res?.msg || '添加失败');
    }
  } catch (err: any) {
    toast.error(err.message || '网络请求错误');
  }
}

async function handleDeleteRecord(id: number) {
  const confirmed = await confirmModal({
    title: '确认删除解析',
    message: '确定要删除此解析记录吗？删除后玩家或访客将无法解析。',
    confirmText: '确定删除',
    cancelText: '取消',
    type: 'danger'
  });

  if (!confirmed) return;

  try {
    const res = await post('/api/domain/dns/delete', { id });
    if (res && res.code === 200) {
      toast.success('删除成功');
      await fetchAll();
    } else {
      toast.error(res?.msg || '删除失败');
    }
  } catch (err: any) {
    toast.error(err.message || '删除失败');
  }
}

function formatSrvDisplay(name: string, domain: string) {
  const clean = name.replace('_minecraft._tcp.', '');
  return `${clean}.${domain}`;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto p-2 sm:p-3 md:p-4">
    <!-- Header Card (Matching Reference Card Style) -->
    <div class="shrink-0 p-4 sm:p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h1 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight m-0">免费子域名管理</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 m-0 leading-relaxed">
          绑定公网免费子域名，支持我的世界 SRV 免填端口直连与通用 A/CNAME 解析。
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="dialogVisible = true"
          class="px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer border-0 transition-all shrink-0 whitespace-nowrap"
        >
          <PlusIcon class="w-4 h-4 stroke-[2.5]" />
          <span>添加子域名</span>
        </button>
      </div>
    </div>

    <!-- Records List -->
    <div v-if="loading && records.length === 0" class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-8 h-8 border-3 border-zinc-200 dark:border-zinc-700 border-t-blue-600 rounded-full animate-spin"></div>
      <span class="text-xs text-zinc-400">正在查询您的子域名记录...</span>
    </div>

    <div v-else-if="records.length === 0" class="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
        <GlobeAltIcon class="w-8 h-8 stroke-[1.5]" />
      </div>
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-bold text-zinc-800 dark:text-zinc-200 m-0">暂无子域名记录</h3>
        <p class="text-xs text-zinc-400 m-0">点击上方“添加子域名”，一键将隧道关联至个性化域名。</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-12">
      <div
        v-for="record in records"
        :key="record.id"
        class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CubeIcon v-if="record.type === 'SRV'" class="w-5 h-5 stroke-[1.8]" />
              <LinkIcon v-else class="w-5 h-5 stroke-[1.8]" />
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-zinc-900 dark:text-white">
                  {{ record.type === 'SRV' ? formatSrvDisplay(record.name, record.domain) : `${record.name}.${record.domain}` }}
                </span>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {{ record.type }}
                </span>
              </div>
              <span class="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 break-all">
                指向: {{ record.record }}
              </span>
            </div>
          </div>

          <button
            @click="handleDeleteRecord(record.id)"
            class="text-zinc-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-0 cursor-pointer"
            title="删除此解析记录"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Dialog (BaseModal with BaseSelect) -->
    <BaseModal
      v-model="dialogVisible"
      title="添加免费子域名解析"
      maxWidth="max-w-lg"
    >
      <div class="p-6 flex flex-col gap-4">
        <!-- Segmented Mode Tabs -->
        <div class="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
          <button
            type="button"
            @click="addMode = 'mc_srv'"
            :class="[
              'py-2 text-xs font-semibold rounded-lg transition-all border-0 cursor-pointer',
              addMode === 'mc_srv'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                : 'bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            ]"
          >
            我的世界 SRV 免端口直连
          </button>
          <button
            type="button"
            @click="addMode = 'custom'"
            :class="[
              'py-2 text-xs font-semibold rounded-lg transition-all border-0 cursor-pointer',
              addMode === 'custom'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                : 'bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            ]"
          >
            自定义通用解析 (A/CNAME)
          </button>
        </div>

        <!-- MC SRV Mode Info Box -->
        <div v-if="addMode === 'mc_srv'" class="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
          自动生成 SRV 解析，玩家只需在游戏服务端地址中输入生成的子域名，即可免输入远程端口直接进服！
        </div>

        <!-- Select Tunnel (BaseSelect) -->
        <div v-if="addMode === 'mc_srv'" class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">选择要绑定的 TCP 隧道</label>
          <BaseSelect
            :model-value="selectedTunnelId"
            :options="tunnelOptions"
            placeholder="请选择一条正在运行的 Minecraft 隧道"
            @change="handleTunnelSelect"
          />
        </div>

        <!-- Suffix Domain (BaseSelect) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">可用免费域名后缀</label>
          <BaseSelect
            v-model="form.domain_id"
            :options="suffixOptions"
            placeholder="选择域名后缀"
          />
        </div>

        <!-- Subdomain Prefix -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {{ addMode === 'mc_srv' ? '游戏前缀主机记录' : '主机记录 (Host Prefix)' }}
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="例如: play, mc, nas, app"
            class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
          />
          <span class="text-[11px] text-zinc-400">
            {{ addMode === 'mc_srv' ? '系统将自动补齐 _minecraft._tcp. 前缀' : '访问地址即为: 前缀.域名后缀' }}
          </span>
        </div>

        <!-- Custom Mode Fields -->
        <template v-if="addMode === 'custom'">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">记录类型</label>
            <BaseSelect
              v-model="form.type"
              :options="recordTypeOptions"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">指向记录值 (Target)</label>
            <input
              v-model="form.record"
              type="text"
              placeholder="例如: 1.2.3.4 或 node.mslmc.net"
              class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </template>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            @click="dialogVisible = false"
            class="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
          >
            取消
          </button>
          <button
            @click="handleCreateRecord"
            class="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0055ee] text-white border-0 shadow-sm cursor-pointer transition-colors"
          >
            立即添加
          </button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
