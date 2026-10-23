<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    width?: string;
  }>(),
  {
    title: '',
    width: 'max-w-2xl'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function close() {
  emit('update:modelValue', false);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
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
        class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs select-none"
        @click="close"
      ></div>
    </Transition>

    <Transition
      enter-active-class="transition transform duration-250 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="modelValue"
        :class="[
          'fixed inset-y-0 right-0 z-50 w-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col',
          width
        ]"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <h3 class="text-sm font-bold text-zinc-900 dark:text-white m-0">
            {{ title }}
          </h3>
          <div class="flex items-center gap-2">
            <slot name="header-actions" />
            <button
              @click="close"
              class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors"
            >
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
