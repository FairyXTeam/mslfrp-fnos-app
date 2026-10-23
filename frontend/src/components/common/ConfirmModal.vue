<script setup lang="ts">
import { confirmState, handleConfirmChoice } from '../../utils/confirm';
import BaseModal from './BaseModal.vue';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline';
</script>

<template>
  <BaseModal
    v-model="confirmState.visible"
    :title="confirmState.options.title || '操作确认'"
    maxWidth="max-w-md"
    @close="handleConfirmChoice(false)"
  >
    <div class="p-6 flex flex-col gap-4">
      <div class="flex items-start gap-3.5">
        <div
          class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          :class="[
            confirmState.options.type === 'danger'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              : confirmState.options.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
          ]"
        >
          <ExclamationTriangleIcon
            v-if="confirmState.options.type === 'danger' || confirmState.options.type === 'warning'"
            class="w-5 h-5 stroke-[2]"
          />
          <InformationCircleIcon v-else class="w-5 h-5 stroke-[2]" />
        </div>

        <div class="flex flex-col gap-1 min-w-0 pt-0.5">
          <p class="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed m-0 break-words">
            {{ confirmState.options.message }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          @click="handleConfirmChoice(false)"
          class="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
        >
          {{ confirmState.options.cancelText || '取消' }}
        </button>
        <button
          type="button"
          @click="handleConfirmChoice(true)"
          class="px-5 py-2 rounded-xl text-xs font-semibold text-white border-0 shadow-sm cursor-pointer transition-colors"
          :class="[
            confirmState.options.type === 'danger'
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-[#0066ff] hover:bg-[#0055ee]'
          ]"
        >
          {{ confirmState.options.confirmText || '确定' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
