<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/outline';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  description?: string;
  badge?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: '请选择...',
    disabled: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void;
  (e: 'change', value: any): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() => {
  return props.options.find((opt) => opt.value === props.modelValue);
});

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function selectOption(option: SelectOption) {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  isOpen.value = false;
}

function handleOutsideClick(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick);
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="relative w-full select-none" ref="containerRef">
    <!-- Trigger Button -->
    <button
      type="button"
      @click.stop="toggle"
      :disabled="disabled"
      class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs text-left transition-all bg-white dark:bg-zinc-800 focus:outline-hidden"
      :class="[
        isOpen
          ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400'
          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
        disabled ? 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/50' : 'cursor-pointer'
      ]"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span
          v-if="selectedOption"
          class="font-medium text-zinc-900 dark:text-zinc-100 truncate"
        >
          {{ selectedOption.label }}
        </span>
        <span v-else class="text-zinc-400 dark:text-zinc-500 truncate">
          {{ placeholder }}
        </span>

        <span
          v-if="selectedOption?.badge"
          class="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
        >
          {{ selectedOption.badge }}
        </span>
      </div>

      <ChevronDownIcon
        class="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ml-2"
        :class="{ 'rotate-180 text-blue-500 dark:text-blue-400': isOpen }"
      />
    </button>

    <!-- Dropdown Menu Popover -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-98"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-98"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl py-1 text-xs backdrop-blur-md"
        @click.stop
      >
        <div v-if="options.length === 0" class="py-3 px-4 text-center text-zinc-400 text-xs">
          暂无可用选项
        </div>

        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          @click="selectOption(opt)"
          :disabled="opt.disabled"
          class="w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors border-0 bg-transparent"
          :class="[
            opt.disabled
              ? 'opacity-40 cursor-not-allowed bg-zinc-50/50 dark:bg-zinc-900/30'
              : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40',
            opt.value === modelValue
              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/30'
              : 'text-zinc-700 dark:text-zinc-300'
          ]"
        >
          <div class="flex flex-col min-w-0 pr-2">
            <div class="flex items-center gap-2">
              <span class="truncate">{{ opt.label }}</span>
              <span
                v-if="opt.badge"
                class="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0"
              >
                {{ opt.badge }}
              </span>
            </div>
            <span v-if="opt.description" class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
              {{ opt.description }}
            </span>
          </div>

          <CheckIcon
            v-if="opt.value === modelValue"
            class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 stroke-[2.5]"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>
