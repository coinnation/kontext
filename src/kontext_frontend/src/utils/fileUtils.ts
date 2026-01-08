export const getLanguageFromFileName = (fileName: string): string => {
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileName.includes('.tsx') || lowerFileName.endsWith('.tsx')) return 'tsx';
    if (lowerFileName.includes('.jsx') || lowerFileName.endsWith('.jsx')) return 'jsx';
    if (lowerFileName.includes('.ts') || lowerFileName.endsWith('.ts')) return 'typescript';
    if (lowerFileName.includes('.js') || lowerFileName.endsWith('.js')) return 'javascript';
    if (lowerFileName.includes('.mo') || lowerFileName.endsWith('.mo')) return 'motoko';
    if (lowerFileName.includes('.css') || lowerFileName.endsWith('.css')) return 'css';
    if (lowerFileName.includes('.scss') || lowerFileName.endsWith('.scss')) return 'scss';
    if (lowerFileName.includes('.json') || lowerFileName.endsWith('.json')) return 'json';
    if (lowerFileName.includes('.html') || lowerFileName.endsWith('.html')) return 'html';
    if (lowerFileName.includes('.md') || lowerFileName.endsWith('.md')) return 'markdown';
    if (lowerFileName.includes('.yml') || lowerFileName.includes('.yaml')) return 'yaml';
    if (lowerFileName.includes('.toml') || lowerFileName.endsWith('.toml')) return 'toml';
    if (lowerFileName.includes('.did') || lowerFileName.endsWith('.did')) return 'candid';
    
    return 'text';
};

export const getFileType = (fileName: string): 'backend' | 'component' | 'style' | 'config' => {
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileName.includes('/backend/') || 
        lowerFileName.includes('.mo') || 
        lowerFileName.includes('.did') ||
        lowerFileName.includes('main.mo') ||
        lowerFileName.includes('actor')) {
        return 'backend';
    }
    
    if (lowerFileName.includes('.css') || 
        lowerFileName.includes('.scss') ||
        lowerFileName.includes('styles') ||
        lowerFileName.includes('style.')) {
        return 'style';
    }
    
    if (lowerFileName.includes('package.json') || 
        lowerFileName.includes('config') || 
        lowerFileName.includes('.config.') || 
        lowerFileName.includes('.toml') || 
        lowerFileName.includes('.yml') || 
        lowerFileName.includes('.yaml') ||
        lowerFileName.includes('postcss') ||
        lowerFileName.includes('tailwind')) {
        return 'config';
    }
    
    return 'component';
};

export const getFileIcon = (fileName: string): string => {
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileName.includes('.tsx')) return '⚛️';
    if (lowerFileName.includes('.jsx')) return '⚛️';
    if (lowerFileName.includes('.ts')) return '🔷';
    if (lowerFileName.includes('.js')) return '🟨';
    if (lowerFileName.includes('.mo')) return '🔺';
    if (lowerFileName.includes('.css')) return '🎨';
    if (lowerFileName.includes('.scss')) return '🎨';
    if (lowerFileName.includes('.json')) return '📋';
    if (lowerFileName.includes('.html')) return '🌐';
    if (lowerFileName.includes('.md')) return '📝';
    if (lowerFileName.includes('.yml') || lowerFileName.includes('.yaml')) return '⚙️';
    if (lowerFileName.includes('.toml')) return '⚙️';
    if (lowerFileName.includes('.did')) return '🔗';
    
    const fileType = getFileType(fileName);
    switch (fileType) {
        case 'backend': return '🔧';
        case 'style': return '🎨';
        case 'config': return '⚙️';
        default: return '📄';
    }
};

export const formatTimestamp = (timestamp: Date | string): string => {
    try {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleTimeString();
    } catch (error) {
        console.warn('Invalid timestamp format:', timestamp);
        return 'Invalid time';
    }
};