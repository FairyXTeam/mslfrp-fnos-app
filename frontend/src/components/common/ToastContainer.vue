<script setup lang="ts">
import { toasts, removeToast } from '../../utils/toast';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
</script>

<template>
  <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none select-none">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg border backdrop-blur-md text-xs font-medium max-w-md transition-all"
        :class="[
          t.type === 'success'
            ? 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60 shadow-emerald-500/5'
            : t.type === 'error'
            ? 'bg-rose-50/95 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60 shadow-rose-500/5'
            : t.type === 'warning'
            ? 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60 shadow-amber-500/5'
            : 'bg-white/95 dark:bg-zinc-800/95 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700'
        ]"
      >
        <CheckCircleIcon v-if="t.type === 'success'" class="w-4 h-4 text-emerald-500 shrink-0 stroke-[2]" />
        <ExclamationCircleIcon v-else-if="t.type === 'error'" class="w-4 h-4 text-rose-500 shrink-0 stroke-[2]" />
        <ExclamationTriangleIcon v-else-if="t.type === 'warning'" class="w-4 h-4 text-amber-500 shrink-0 stroke-[2]" />
        <InformationCircleIcon v-else class="w-4 h-4 text-blue-500 shrink-0 stroke-[2]" />

        <span class="break-words leading-relaxed">{{ t.message }}</span>

        <button
          @click="removeToast(t.id)"
          class="ml-1 p-0.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 border-0 bg-transparent cursor-pointer transition-opacity"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
