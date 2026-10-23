import { ref } from 'vue';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const toasts = ref<ToastItem[]>([]);
let nextId = 1;

function showToast(message: string, type: ToastItem['type'] = 'info', duration = 3000) {
  const id = nextId++;
  toasts.value.push({ id, type, message });
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

export function removeToast(id: number) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx !== -1) {
    toasts.value.splice(idx, 1);
  }
}

export const toast = {
  success(msg: string) {
    showToast(msg, 'success');
  },
  error(msg: string) {
    showToast(msg, 'error', 4000);
  },
  warning(msg: string) {
    showToast(msg, 'warning', 3500);
  },
  info(msg: string) {
    showToast(msg, 'info');
  }
};
