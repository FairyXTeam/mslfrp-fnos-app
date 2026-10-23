<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    maxWidth?: string;
    showClose?: boolean;
    closeOnClickOverlay?: boolean;
  }>(),
  {
    title: '',
    maxWidth: 'max-w-lg',
    showClose: true,
    closeOnClickOverlay: true
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget && props.closeOnClickOverlay) {
    close();
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue && props.showClose) {
    close();
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
        @click="handleOverlayClick"
      >
        <div
          :class="[
            'w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-all',
            maxWidth
          ]"
          @click.stop
        >
          <!-- Header -->
          <div
            v-if="title || showClose"
            class="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0"
          >
            <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0 tracking-tight">
              {{ title }}
            </h3>
            <button
              v-if="showClose"
              @click="close"
              class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors"
            >
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 overflow-y-auto max-h-[calc(88vh-80px)]">
            <slot />
          </div>

          <!-- Footer (optional) -->
          <div
            v-if="$slots.footer"
            class="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-end gap-2.5 shrink-0"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
