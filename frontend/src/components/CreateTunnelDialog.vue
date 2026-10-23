<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { toast } from '../utils/toast';
import { post } from '../api/client';
import { useTunnelsStore, FrpNode, FrpTunnel } from '../stores/tunnels';
import { useAppStore } from '../stores/app';
import BaseModal from './common/BaseModal.vue';
import BaseSelect, { SelectOption } from './common/BaseSelect.vue';
import { SparklesIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  visible: boolean;
  editTunnel?: FrpTunnel | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}>();

const tunnelsStore = useTunnelsStore();
const appStore = useAppStore();
const submitting = ref(false);

const form = reactive({
  id: 0,
  nodeId: null as number | null,
  name: '',
  type: 'tcp',
  protocol: 'tcp',
  local_ip: '127.0.0.1',
  local_port: 25565,
  remote_port: '' as number | string,
  bind_domain: '',
  remarks: '无',
  extra_config: ''
});

const selectedNode = computed<FrpNode | undefined>(() => {
  return tunnelsStore.nodes.find((n) => n.id === form.nodeId);
});

// Dynamic type options filtered by node capability
const typeOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [
    { label: 'TCP 隧道 (游戏联机/SSH/RDP)', value: 'tcp' }
  ];
  if (selectedNode.value?.udp_support === 1) {
    opts.push({ label: 'UDP 隧道 (语音/游戏DNS)', value: 'udp' });
  }
  if (selectedNode.value?.http_support === 1) {
    opts.push({ label: 'HTTP 网页服务 (80端口)', value: 'http' });
    opts.push({ label: 'HTTPS 安全网页 (443端口)', value: 'https' });
  }
  return opts;
});

// Dynamic protocol options filtered by node capability (No "伪装")
const protocolOptions = computed<SelectOption[]>(() => {
  const kcpSupported = selectedNode.value?.kcp_support === 1;
  const wssSupported = selectedNode.value?.wss_support === 1;

  return [
    {
      label: 'TCP (标准传输协议)',
      value: 'tcp',
      description: '通用稳定，默认传输方式'
    },
    {
      label: 'KCP 加速 (UDP抗丢包)',
      value: 'kcp',
      disabled: !kcpSupported,
      description: kcpSupported ? '高抗丢包加速，降低恶劣网络延迟' : '当前节点不支持 KCP'
    },
    {
      label: 'WSS 加速 (WebSocket)',
      value: 'wss',
      disabled: !wssSupported,
      description: wssSupported ? '基于 WebSocket 传输协议加速' : '当前节点不支持 WSS'
    }
  ];
});

function generateRandomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'tun_';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  form.name = result;
}

function generateRandomPort() {
  if (!selectedNode.value) return;
  const min = selectedNode.value.min_open_port || 10000;
  const max = selectedNode.value.max_open_port || 65535;
  form.remote_port = Math.floor(Math.random() * (max - min + 1)) + min;
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.editTunnel) {
        form.id = props.editTunnel.id;
        form.nodeId = props.editTunnel.node_id;
        form.name = props.editTunnel.name;
        form.type = props.editTunnel.type.toLowerCase();
        form.protocol = props.editTunnel.protocol || 'tcp';
        form.local_ip = props.editTunnel.local_ip;
        form.local_port = props.editTunnel.local_port;
        form.remote_port = props.editTunnel.remote_port;
        form.bind_domain = props.editTunnel.bind_domain || '';
        form.remarks = props.editTunnel.remarks || '';
      } else {
        form.id = 0;
        form.name = '';
        form.type = 'tcp';
        form.protocol = 'tcp';
        form.local_ip = '127.0.0.1';
        form.local_port = 25565;
        form.remote_port = '';
        form.bind_domain = '';
        form.remarks = '无';
        form.extra_config = '';
        generateRandomName();
        if (tunnelsStore.nodes.length > 0) {
          form.nodeId = tunnelsStore.nodes[0].id;
          generateRandomPort();
        }
      }
    }
  }
);

watch(
  () => form.nodeId,
  () => {
    if (!props.editTunnel) {
      generateRandomPort();
    }
    // Auto-adjust if selected protocol/type is not supported by current node
    if (form.protocol === 'kcp' && selectedNode.value?.kcp_support !== 1) {
      form.protocol = 'tcp';
    }
    if (form.protocol === 'wss' && selectedNode.value?.wss_support !== 1) {
      form.protocol = 'tcp';
    }
    if (form.type === 'udp' && selectedNode.value?.udp_support !== 1) {
      form.type = 'tcp';
    }
    if ((form.type === 'http' || form.type === 'https') && selectedNode.value?.http_support !== 1) {
      form.type = 'tcp';
    }
  }
);

async function handleSubmit() {
  if (!form.nodeId) {
    toast.warning('请选择一个穿透节点');
    return;
  }
  if (!form.name || !/^[a-zA-Z0-9_]+$/.test(form.name)) {
    toast.warning('隧道名称只能包含英文字母、数字和下划线');
    return;
  }
  if (!form.local_ip || !form.local_port) {
    toast.warning('请正确填写本地目标 IP 与端口');
    return;
  }
  if (!form.remote_port && form.type !== 'http' && form.type !== 'https') {
    toast.warning('请填写远程端口');
    return;
  }

  // Real-name check for node
  if (selectedNode.value?.need_real_name === 1 && !appStore.isRealNamed) {
    toast.error('该节点要求实名认证后方可使用！');
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      id: form.nodeId,
      name: form.name,
      local_ip: form.local_ip,
      local_port: Number(form.local_port),
      remote_port: Number(form.remote_port) || 80,
      type: form.type,
      protocol: form.protocol,
      use_kcp: form.protocol === 'kcp',
      bind_domain: form.bind_domain || null,
      remarks: form.remarks || '无',
      extra_config: form.extra_config || null
    };

    const res = await post('/api/frp/addTunnel', payload);
    if (res && res.code === 200) {
      toast.success('隧道创建成功！');
      emit('update:visible', false);
      emit('success');
      await tunnelsStore.fetchTunnels();
    } else {
      toast.error(res?.msg || '创建失败');
    }
  } catch (err: any) {
    toast.error(err.message || '网络请求错误');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="editTunnel ? '编辑隧道配置' : '新建穿透隧道'"
    maxWidth="max-w-xl"
  >
    <div class="flex flex-col gap-5 p-6">
      <!-- 1. Node Selection Grid (fnOS Native Card Style) -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-zinc-700 dark:text-zinc-300">选择穿透节点</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-0.5">
          <div
            v-for="node in tunnelsStore.nodes"
            :key="node.id"
            @click="form.nodeId = node.id"
            :class="[
              'p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1',
              form.nodeId === node.id
                ? 'bg-blue-50/80 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-100 ring-2 ring-blue-500/20'
                : 'bg-zinc-50/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600'
            ]"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs truncate">{{ node.name }}</span>
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.2 rounded-full font-semibold',
                  node.status === 1
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-zinc-200 text-zinc-600'
                ]"
              >
                {{ node.status === 1 ? '在线' : '离线' }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>带宽: {{ node.bandwidth }}M</span>
              <span v-if="node.need_real_name === 1" class="text-amber-500">需实名</span>
              <span v-else class="text-emerald-500">免实名</span>
              <span v-if="node.kcp_support === 1" class="text-indigo-400 font-mono">KCP</span>
              <span v-if="node.wss_support === 1" class="text-emerald-400 font-mono">WSS</span>
            </div>
            <p v-if="node.remarks" class="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 m-0" :title="node.remarks">
              {{ node.remarks }}
            </p>
          </div>
        </div>

        <!-- Selected Node Detail & Remarks Callout -->
        <div v-if="selectedNode" class="mt-1 p-2.5 rounded-xl bg-blue-50/70 dark:bg-zinc-800/60 border border-blue-100 dark:border-zinc-700/60 flex flex-col gap-1.5 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
              <span class="font-bold text-zinc-800 dark:text-zinc-100">{{ selectedNode.name }}</span>
              <span class="text-[11px] text-zinc-400">开放端口: {{ selectedNode.min_open_port }} ~ {{ selectedNode.max_open_port }}</span>
            </div>
            <span class="text-[11px] font-semibold text-blue-600 dark:text-blue-400">带宽: {{ selectedNode.bandwidth }}M</span>
          </div>
          <div v-if="selectedNode.remarks" class="text-zinc-600 dark:text-zinc-300 text-[11px] leading-relaxed bg-white/80 dark:bg-zinc-900/60 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50 whitespace-pre-line max-h-24 overflow-y-auto">
            <span class="font-semibold text-zinc-500 dark:text-zinc-400">节点说明：</span>{{ selectedNode.remarks }}
          </div>
        </div>
      </div>

      <!-- 2. Basic Configuration (shadcn style form with BaseSelect) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <!-- Tunnel Name -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">隧道名称</label>
            <button
              @click="generateRandomName"
              type="button"
              class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-0 cursor-pointer flex items-center gap-1"
            >
              <SparklesIcon class="w-3.5 h-3.5" />
              <span>随机</span>
            </button>
          </div>
          <input
            v-model="form.name"
            type="text"
            placeholder="例如: mc_server"
            class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <!-- Protocol & Type (Pure shadcn BaseSelect) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">穿透类型</label>
          <BaseSelect
            v-model="form.type"
            :options="typeOptions"
          />
        </div>

        <!-- Local IP & Port -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">本地服务 IP</label>
          <input
            v-model="form.local_ip"
            type="text"
            placeholder="127.0.0.1"
            class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">本地服务端口</label>
          <input
            v-model.number="form.local_port"
            type="number"
            min="1"
            max="65535"
            placeholder="25565"
            class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <!-- Remote Port -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">远程映射端口</label>
            <button
              @click="generateRandomPort"
              type="button"
              class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-0 cursor-pointer flex items-center gap-1"
            >
              <SparklesIcon class="w-3.5 h-3.5" />
              <span>随机端口</span>
            </button>
          </div>
          <input
            v-model="form.remote_port"
            type="text"
            placeholder="节点分配端口"
            class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <!-- Acceleration Protocol (Pure shadcn BaseSelect) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">传输加速协议</label>
          <BaseSelect
            v-model="form.protocol"
            :options="protocolOptions"
          />
        </div>
      </div>

      <!-- HTTP Bind Domain (if HTTP/HTTPS) -->
      <div v-if="form.type === 'http' || form.type === 'https'" class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">绑定自定义域名</label>
        <input
          v-model="form.bind_domain"
          type="text"
          placeholder="例如: nas.mycustomdomain.com"
          class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <!-- Remarks -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-zinc-700 dark:text-zinc-300">备注说明</label>
        <input
          v-model="form.remarks"
          type="text"
          placeholder="可选备注信息"
          class="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          @click="emit('update:visible', false)"
          class="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="submitting"
          class="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
        >
          {{ submitting ? '正在创建...' : '确认创建' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
