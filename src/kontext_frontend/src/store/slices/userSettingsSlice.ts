// ============================================================================
// UserSettingsSlice.ts - Store for user settings including LLM API keys
// ============================================================================

import { StateCreator } from 'zustand';

export interface UserSettingsSlice {
  // LLM API Keys
  claudeApiKey: string | null;
  geminiApiKey: string | null;
  kimiApiKey: string | null;
  openaiApiKey: string | null;
  
  // Selected model for chat
  selectedChatModel: 'claude' | 'gemini' | 'kimi' | 'openai';
  
  // Actions
  setClaudeApiKey: (key: string | null) => void;
  setGeminiApiKey: (key: string | null) => void;
  setKimiApiKey: (key: string | null) => void;
  setOpenaiApiKey: (key: string | null) => void;
  setSelectedChatModel: (model: 'claude' | 'gemini' | 'kimi' | 'openai') => void;
  loadSettingsFromStorage: () => void;
  saveSettingsToStorage: () => void;
}

const STORAGE_KEY = 'kontext_user_settings';

export const createUserSettingsSlice: StateCreator<UserSettingsSlice> = (set, get) => ({
  // Initial state
  claudeApiKey: null,
  geminiApiKey: null,
  kimiApiKey: null,
  openaiApiKey: null,
  selectedChatModel: 'claude', // Default to Claude

  // Actions
  setClaudeApiKey: (key: string | null) => {
    set({ claudeApiKey: key });
    get().saveSettingsToStorage();
  },

  setGeminiApiKey: (key: string | null) => {
    set({ geminiApiKey: key });
    get().saveSettingsToStorage();
  },

  setKimiApiKey: (key: string | null) => {
    set({ kimiApiKey: key });
    get().saveSettingsToStorage();
  },

  setOpenaiApiKey: (key: string | null) => {
    set({ openaiApiKey: key });
    get().saveSettingsToStorage();
  },

  setSelectedChatModel: (model: 'claude' | 'gemini' | 'kimi' | 'openai') => {
    set({ selectedChatModel: model });
    get().saveSettingsToStorage();
  },

  loadSettingsFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        set({
          claudeApiKey: settings.claudeApiKey || null,
          geminiApiKey: settings.geminiApiKey || null,
          kimiApiKey: settings.kimiApiKey || null,
          openaiApiKey: settings.openaiApiKey || null,
          selectedChatModel: settings.selectedChatModel || 'claude'
        });
        console.log('✅ [UserSettings] Loaded settings from storage');
      }
    } catch (error) {
      console.warn('⚠️ [UserSettings] Failed to load settings from storage:', error);
    }
  },

  saveSettingsToStorage: () => {
    try {
      const state = get();
      const settings = {
        claudeApiKey: state.claudeApiKey,
        geminiApiKey: state.geminiApiKey,
        kimiApiKey: state.kimiApiKey,
        openaiApiKey: state.openaiApiKey,
        selectedChatModel: state.selectedChatModel
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      console.log('✅ [UserSettings] Saved settings to storage');
    } catch (error) {
      console.warn('⚠️ [UserSettings] Failed to save settings to storage:', error);
    }
  }
});

