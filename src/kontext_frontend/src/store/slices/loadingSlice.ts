import { StateCreator } from 'zustand';

export interface LoadingSliceState {
  isLoading: boolean;
  isSaving: boolean;
  isMessagePending: boolean;
}

export interface LoadingSliceActions {
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setMessagePending: (pending: boolean) => void;
}

export type LoadingSlice = LoadingSliceState & LoadingSliceActions;

export const createLoadingSlice: StateCreator<any, [], [], LoadingSlice> = (set, get) => ({
  isLoading: false,
  isSaving: false,
  isMessagePending: false,

  setLoading: (isLoading: boolean) => {
    set((state: any) => {
      state.isLoading = isLoading;
    });
  },

  setSaving: (isSaving: boolean) => {
    set((state: any) => {
      state.isSaving = isSaving;
    });
  },

  setMessagePending: (pending: boolean) => {
    set((state: any) => {
      state.isMessagePending = pending;
    });
  },
});