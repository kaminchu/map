import { create } from "zustand";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  message: string;
}
interface UiState {
  toasts: Toast[];
  dialog?: string;
  addToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  setDialog: (dialog?: string) => void;
}
export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }] })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setDialog: (dialog) => set({ dialog }),
}));
