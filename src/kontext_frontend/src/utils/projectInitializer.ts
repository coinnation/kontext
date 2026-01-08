import { Project } from '../types';

export class ProjectInitializer {
    private static hasInitialized = false;
    private static initializationPromise: Promise<boolean> | null = null;

    public static shouldCreateInitialProject(
        projects: Project[], 
        isReady: boolean, 
        isLoading: boolean,
        userCanisterId: string | null
    ): boolean {
        return (
            isReady &&
            !isLoading &&
            userCanisterId &&
            projects.length === 0 &&
            !ProjectInitializer.hasInitialized &&
            !ProjectInitializer.initializationPromise
        );
    }

    public static async createWelcomeProject(
        addProject: (project: Project, userCanisterId?: string) => Promise<boolean>,
        userCanisterId: string
    ): Promise<{ success: boolean; projectId?: string }> {
        if (ProjectInitializer.initializationPromise) {
            const success = await ProjectInitializer.initializationPromise;
            return { success };
        }

        ProjectInitializer.initializationPromise = (async () => {
            try {
                console.log('🆕 [ProjectInitializer] Creating welcome project...');
                ProjectInitializer.hasInitialized = true;

                const projectId = Date.now().toString();
                
                const welcomeProject: Project = {
                    // Required canister fields
                    id: projectId,
                    name: 'Welcome to Kontext',
                    description: 'Get started with your first AI-powered project. Ask me anything you\'d like to build!',
                    projectType: {
                        name: 'Frontend',
                        subType: 'React'
                    },
                    canisters: [],
                    created: Date.now(),
                    updated: Date.now(),
                    visibility: 'private',
                    status: 'active',
                    
                    // UI presentation fields
                    title: 'Welcome to Kontext',
                    icon: '🎉',
                    iconType: 'welcome',
                    preview: 'Get started with your first AI-powered project',
                    time: 'Just now',
                    isTemplate: false,
                    unreadCount: 0,
                    
                    // Chat and file data
                    messages: [{
                        id: Date.now().toString(),
                        type: 'system',
                        content: 'Welcome to Kontext! I\'m your AI development assistant. Describe what you\'d like to build, and I\'ll help you create it step by step. What would you like to create today?',
                        timestamp: new Date()
                    }],
                    files: {},
                    
                    // Optional fields
                    collaborators: undefined,
                    templateId: undefined,
                    workingCopyBaseVersion: undefined,
                    npmPackages: undefined,
                    motokoPackages: undefined
                };

                const success = await addProject(welcomeProject, userCanisterId);
                
                if (success) {
                    console.log('✅ [ProjectInitializer] Welcome project created successfully');
                    return true;
                } else {
                    console.error('❌ [ProjectInitializer] Failed to create welcome project');
                    ProjectInitializer.hasInitialized = false;
                    return false;
                }
            } catch (error) {
                console.error('❌ [ProjectInitializer] Error creating welcome project:', error);
                ProjectInitializer.hasInitialized = false;
                throw error;
            }
        })();

        const success = await ProjectInitializer.initializationPromise;
        return { success, projectId: success ? Date.now().toString() : undefined };
    }

    public static reset(): void {
        ProjectInitializer.hasInitialized = false;
        ProjectInitializer.initializationPromise = null;
    }
}