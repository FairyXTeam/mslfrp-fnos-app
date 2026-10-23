import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
}

export const confirmState = ref<{
  visible: boolean;
  options: ConfirmOptions;
  resolve?: (value: boolean) => void;
}>({
  visible: false,
  options: { message: '' }
});

export function confirmModal(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    confirmState.value = {
      visible: true,
      options: opts,
      resolve
    };
  });
}

export function handleConfirmChoice(confirmed: boolean) {
  if (confirmState.value.resolve) {
    confirmState.value.resolve(confirmed);
  }
  confirmState.value.visible = false;
}
