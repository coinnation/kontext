import { StateCreator } from 'zustand';
import { projectImportService, ImportProgress, ImportResult, ImportValidationResult, ImportedProjectData } from '../../services/ProjectImportService';

export interface ProjectImportState {
  // Dialog state
  isImportDialogOpen: boolean;
  importStep: 'choice' | 'upload' | 'preview' | 'importing' | 'complete' | 'error';
  
  // File upload state
  selectedFile: File | null;
  isDragOver: boolean;
  
  // Validation state
  validationResult: ImportValidationResult | null;
  isValidating: boolean;
  
  // Import progress
  importProgress: ImportProgress | null;
  isImporting: boolean;
  
  // Results
  importResult: ImportResult | null;
  importedProjectData: ImportedProjectData | null;
  
  // Error state
  error: string | null;
  warnings: string[];
}

export interface ProjectImportActions {
  // Dialog management
  openImportDialog: () => void;
  closeImportDialog: () => void;
  setImportStep: (step: ProjectImportState['importStep']) => void;
  
  // File upload
  setSelectedFile: (file: File | null) => void;
  setDragOver: (isDragOver: boolean) => void;
  handleFileSelect: (file: File) => void;
  
  // Validation
  validateProject: (file: File) => Promise<void>;
  clearValidation: () => void;
  
  // Import execution
  importProject: (importData: ImportedProjectData, newProjectName?: string) => Promise<void>;
  
  // State management
  setError: (error: string | null) => void;
  setWarnings: (warnings: string[]) => void;
  resetImportState: () => void;
  
  // Utility actions
  retryImport: () => Promise<void>;
  startNewImport: () => void;
}

export type ProjectImportSlice = ProjectImportState & ProjectImportActions;

const initialState: ProjectImportState = {
  isImportDialogOpen: false,
  importStep: 'choice',
  selectedFile: null,
  isDragOver: false,
  validationResult: null,
  isValidating: false,
  importProgress: null,
  isImporting: false,
  importResult: null,
  importedProjectData: null,
  error: null,
  warnings: []
};

export const createProjectImportSlice: StateCreator<any, [], [], ProjectImportSlice> = (set, get) => ({
  ...initialState,

  // Dialog management
  openImportDialog: () => {
    console.log('🎬 [ImportSlice] Opening import dialog');
    set((state: any) => {
      state.isImportDialogOpen = true;
      state.importStep = 'choice';
      // Reset previous state
      state.selectedFile = null;
      state.validationResult = null;
      state.importResult = null;
      state.importedProjectData = null;
      state.error = null;
      state.warnings = [];
    });
  },

  closeImportDialog: () => {
    console.log('🚪 [ImportSlice] Closing import dialog');
    set((state: any) => {
      state.isImportDialogOpen = false;
      state.importStep = 'choice';
      // Clean up state
      state.selectedFile = null;
      state.validationResult = null;
      state.importProgress = null;
      state.isValidating = false;
      state.isImporting = false;
      state.importResult = null;
      state.importedProjectData = null;
      state.error = null;
      state.warnings = [];
    });
  },

  setImportStep: (step: ProjectImportState['importStep']) => {
    console.log(`📍 [ImportSlice] Setting import step: ${step}`);
    set((state: any) => {
      state.importStep = step;
    });
  },

  // File upload
  setSelectedFile: (file: File | null) => {
    console.log('📁 [ImportSlice] Setting selected file:', file?.name || 'null');
    set((state: any) => {
      state.selectedFile = file;
      if (!file) {
        state.validationResult = null;
        state.importedProjectData = null;
        state.error = null;
      }
    });
  },

  setDragOver: (isDragOver: boolean) => {
    set((state: any) => {
      state.isDragOver = isDragOver;
    });
  },

  handleFileSelect: async (file: File) => {
    console.log('📂 [ImportSlice] Handling file selection:', file.name);
    const { setSelectedFile, validateProject } = get() as ProjectImportSlice;
    
    setSelectedFile(file);
    
    // Automatically validate the file
    await validateProject(file);
  },

  // Validation
  validateProject: async (file: File) => {
    console.log('🔍 [ImportSlice] Starting project validation for:', file.name);
    
    set((state: any) => {
      state.isValidating = true;
      state.validationResult = null;
      state.error = null;
      state.importStep = 'upload';
    });

    try {
      const result = await projectImportService.validateAndExtractProject(
        file,
        (progress) => {
          console.log('📊 [ImportSlice] Validation progress:', progress);
          set((state: any) => {
            state.importProgress = progress;
          });
        }
      );

      console.log('✅ [ImportSlice] Validation completed:', { isValid: result.isValid, errors: result.errors.length });

      set((state: any) => {
        state.isValidating = false;
        state.validationResult = result;
        state.importedProjectData = result.projectData || null;
        state.warnings = result.warnings;
        state.importProgress = null;

        if (result.isValid) {
          state.importStep = 'preview';
        } else {
          state.importStep = 'error';
          state.error = result.errors.join('\n');
        }
      });

    } catch (error) {
      console.error('❌ [ImportSlice] Validation failed:', error);
      
      set((state: any) => {
        state.isValidating = false;
        state.importStep = 'error';
        state.error = error instanceof Error ? error.message : 'Validation failed';
        state.importProgress = null;
      });
    }
  },

  clearValidation: () => {
    console.log('🧹 [ImportSlice] Clearing validation state');
    set((state: any) => {
      state.validationResult = null;
      state.importedProjectData = null;
      state.error = null;
      state.warnings = [];
    });
  },

  // Import execution
  importProject: async (importData: ImportedProjectData, newProjectName?: string) => {
    console.log('🚀 [ImportSlice] Starting project import:', {
      originalName: importData.project.name,
      newName: newProjectName,
      fileCount: Object.keys(importData.files).length
    });

    set((state: any) => {
      state.isImporting = true;
      state.importStep = 'importing';
      state.importProgress = null;
      state.error = null;
    });

    try {
      const result = await projectImportService.createProjectFromImport(
        importData,
        newProjectName,
        (progress) => {
          console.log('📈 [ImportSlice] Import progress:', progress);
          set((state: any) => {
            state.importProgress = progress;
          });
        }
      );

      console.log('🎯 [ImportSlice] Import completed:', { success: result.success, projectId: result.projectId });

      set((state: any) => {
        state.isImporting = false;
        state.importResult = result;
        state.warnings = [...state.warnings, ...(result.warnings || [])];

        if (result.success) {
          state.importStep = 'complete';
        } else {
          state.importStep = 'error';
          state.error = result.error || 'Import failed';
        }
      });

      // If successful, switch to the new project
      if (result.success && result.projectId) {
        console.log('🔄 [ImportSlice] Switching to imported project:', result.projectId);
        
        // Get fresh projects list and switch to imported project
        const { loadProjects, switchToProject } = get() as any;
        await loadProjects();
        await switchToProject(result.projectId);
      }

    } catch (error) {
      console.error('💥 [ImportSlice] Import failed:', error);
      
      set((state: any) => {
        state.isImporting = false;
        state.importStep = 'error';
        state.error = error instanceof Error ? error.message : 'Import failed';
      });
    }
  },

  // State management
  setError: (error: string | null) => {
    set((state: any) => {
      state.error = error;
    });
  },

  setWarnings: (warnings: string[]) => {
    set((state: any) => {
      state.warnings = warnings;
    });
  },

  resetImportState: () => {
    console.log('🔄 [ImportSlice] Resetting import state');
    set((state: any) => {
      Object.assign(state, initialState);
    });
  },

  // Utility actions
  retryImport: async () => {
    console.log('🔄 [ImportSlice] Retrying import');
    
    const { selectedFile } = get() as ProjectImportSlice;
    
    if (selectedFile) {
      const { validateProject } = get() as ProjectImportSlice;
      await validateProject(selectedFile);
    } else {
      set((state: any) => {
        state.importStep = 'upload';
        state.error = null;
      });
    }
  },

  startNewImport: () => {
    console.log('✨ [ImportSlice] Starting new import');
    
    const { resetImportState, openImportDialog } = get() as ProjectImportSlice;
    resetImportState();
    openImportDialog();
  }
});