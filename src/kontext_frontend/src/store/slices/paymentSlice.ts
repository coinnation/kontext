import { StateCreator } from 'zustand';

export interface PaymentSliceState {
  isProcessingPaymentReturn: boolean;
  paymentReturnError: string | null;
}

export interface PaymentSliceActions {
  setProcessingPaymentReturn: (isProcessing: boolean) => void;
  setPaymentReturnError: (error: string | null) => void;
  clearPaymentReturnError: () => void;
}

export type PaymentSlice = PaymentSliceState & PaymentSliceActions;

export const createPaymentSlice: StateCreator<any, [], [], PaymentSlice> = (set, get) => ({
  isProcessingPaymentReturn: false,
  paymentReturnError: null,

  setProcessingPaymentReturn: (isProcessing: boolean) => {
    set((state: any) => {
      state.isProcessingPaymentReturn = isProcessing;
    });
  },

  setPaymentReturnError: (error: string | null) => {
    set((state: any) => {
      state.paymentReturnError = error;
    });
  },

  clearPaymentReturnError: () => {
    set((state: any) => {
      state.paymentReturnError = null;
    });
  },
});