// 🔥 FIX: Direct export without React.memo to prevent initialization errors
// Static styles component doesn't need memoization as it never changes
export const StaticStyles = () => (
    <style>{`
        :root {
            --primary-black: #0a0a0a;
            --secondary-black: #111111;
            --tertiary-black: #1a1a1a;
            --accent-orange: #ff6b35;
            --accent-orange-light: #ff8c5a;
            --accent-green: #10b981;
            --accent-green-light: #34d399;
            --text-gray: #9ca3af;
            --text-light-gray: #e5e7eb;
            --border-color: rgba(255, 255, 255, 0.1);
            --hover-bg: rgba(255, 255, 255, 0.05);
            --tab-transition-duration: 0.25s;
            --tab-stagger-delay: 0.1s;
            --smooth-easing: cubic-bezier(0.4, 0, 0.2, 1);
            --bounce-easing: cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .chat-scrollbar::-webkit-scrollbar {
            width: 8px;
        }

        .chat-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .chat-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 107, 53, 0.3);
            border-radius: 4px;
            transition: background-color 0.3s var(--smooth-easing);
        }

        .chat-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 107, 53, 0.5);
        }

        .chat-sidebar-scrollbar::-webkit-scrollbar {
            width: 6px;
        }

        .chat-sidebar-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .chat-sidebar-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 107, 53, 0.3);
            border-radius: 3px;
            transition: background-color 0.3s var(--smooth-easing);
        }

        .chat-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 107, 53, 0.5);
        }

        .main-layout {
            display: flex;
            height: 100vh;
            background: var(--primary-black);
        }

        .main-content {
            flex: 1;
            display: flex;
            transition: all 0.3s var(--smooth-easing);
        }

        /* FIX #1: The missing with-side-pane CSS class */
        .main-content.with-side-pane {
            /* Desktop: Fixed width to prevent flex recalculation during generation */
            width: 50%;
            flex: none;
            transition: width 0.3s var(--smooth-easing);
        }

        @media (max-width: 768px) {
            /* Mobile: Side pane is full width overlay, so no width adjustment needed */
            .main-content.with-side-pane {
                width: 100%;
                flex: 1;
            }
        }

        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--primary-black);
            position: relative;
            min-width: 0;
        }

        .side-pane {
            position: fixed;
            top: 0;
            right: 0;
            width: 50%;
            height: 100vh;
            background: var(--secondary-black);
            border-left: 1px solid var(--border-color);
            transform: translateX(100%);
            transition: transform 0.3s var(--smooth-easing);
            z-index: 1001;
            display: flex;
            flex-direction: column;
        }

        .side-pane.open {
            transform: translateX(0);
        }

        .side-pane-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.02);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .side-pane-content {
            flex: 1;
            overflow: auto;
            min-height: 0;
        }

        .side-pane-close {
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 8px;
            color: var(--text-gray);
            cursor: pointer;
            transition: all 0.3s var(--smooth-easing);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .side-pane-close:hover {
            background: var(--accent-orange);
            color: #ffffff;
        }

        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .message-bubble {
            background: transparent;
            border-radius: 18px;
            padding: 1.25rem 1.5rem;
            position: relative;
            backdrop-filter: blur(10px);
            line-height: 1.6;
            max-height: 60vh;
            overflow-y: auto;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .message-bubble pre {
            max-height: 300px;
            overflow-y: auto;
            border-radius: 8px;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            margin: 0.5rem 0;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .message-bubble code {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9em;
        }

        .tab-bar {
            position: relative;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
            -ms-overflow-style: auto;
            scroll-behavior: smooth;
            border-bottom: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.02);
            flex-shrink: 0;
        }

        .tab-bar::-webkit-scrollbar {
            height: 6px;
        }

        .tab-bar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .tab-bar::-webkit-scrollbar-thumb {
            background: rgba(255, 107, 53, 0.3);
            border-radius: 3px;
            transition: background-color 0.3s var(--smooth-easing);
        }

        .tab-bar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 107, 53, 0.5);
        }

        .tab-container {
            display: flex;
            gap: 0.5rem;
            padding: 0.5rem;
            min-height: 48px;
            align-items: center;
        }

        .tab-container::-webkit-scrollbar {
            height: 4px;
        }

        .tab-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .tab-container::-webkit-scrollbar-thumb {
            background: rgba(255, 107, 53, 0.3);
            border-radius: 2px;
        }

        .tab-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 107, 53, 0.5);
        }

        .tab-group > div::-webkit-scrollbar {
            display: none;
        }

        .tab-group {
            display: flex;
            gap: 0.25rem;
            align-items: center;
            position: relative;
        }

        .tab-group-separator {
            width: 1px;
            height: 24px;
            background: var(--border-color);
            margin: 0 0.5rem;
            opacity: 0.5;
        }

        .tab-group-label {
            font-size: 0.7rem;
            color: var(--text-gray);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-right: 0.5rem;
            opacity: 0.7;
            white-space: nowrap;
        }

        .tab-item {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1rem;
            border-radius: 10px;
            border: 1px solid transparent;
            background: transparent;
            color: var(--text-gray);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            user-select: none;
            transition: all var(--tab-transition-duration) var(--smooth-easing);
            opacity: 1;
            transform: translateY(0);
            overflow: hidden;
            animation: tabSlideIn 0.4s var(--bounce-easing);
        }

        @keyframes tabSlideIn {
            from {
                opacity: 0;
                transform: translateY(-10px) scale(0.8);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        /* ENHANCED: Progressive file states with beautiful animations */
        .tab-item.detected {
            background: rgba(16, 185, 129, 0.08);
            border-color: rgba(16, 185, 129, 0.2);
            animation: pulseDetected 2s ease-in-out infinite;
        }

        .tab-item.writing {
            background: rgba(255, 107, 53, 0.12);
            border-color: rgba(255, 107, 53, 0.4);
            animation: pulseWriting 1.5s ease-in-out infinite;
            position: relative;
            box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.2);
        }

        .tab-item.writing::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 3px;
            height: 100%;
            background: linear-gradient(180deg, var(--accent-orange), transparent, var(--accent-orange));
            border-radius: 0 2px 2px 0;
            animation: writingIndicator 2s ease-in-out infinite;
        }

        .tab-item.complete {
            background: rgba(16, 185, 129, 0.15);
            border-color: rgba(16, 185, 129, 0.4);
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
        }

        @keyframes pulseDetected {
            0%, 100% { 
                opacity: 0.7; 
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2);
                transform: scale(1);
            }
            50% { 
                opacity: 1; 
                box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
                transform: scale(1.02);
            }
        }

        @keyframes pulseWriting {
            0%, 100% { 
                opacity: 0.8; 
                box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.3);
                transform: scale(1);
            }
            50% { 
                opacity: 1; 
                transform: scale(1.05);
                box-shadow: 0 0 0 6px rgba(255, 107, 53, 0.15);
            }
        }

        @keyframes writingIndicator {
            0% { 
                height: 0%; 
                top: 50%;
                opacity: 0.5;
            }
            50% { 
                height: 100%; 
                top: 0%;
                opacity: 1;
            }
            100% { 
                height: 0%; 
                top: 50%;
                opacity: 0.5;
            }
        }

        /* ENHANCED: Writing progress animation */
        @keyframes writingProgress {
            0% {
                width: 0%;
                opacity: 0.8;
            }
            50% {
                width: 70%;
                opacity: 1;
            }
            100% {
                width: 100%;
                opacity: 0.6;
            }
        }

        .tab-item:hover {
            background: var(--hover-bg);
            border-color: rgba(255, 107, 53, 0.2);
            color: var(--text-light-gray);
            transform: translateY(-1px);
        }

        .tab-item.active {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.05));
            border-color: var(--accent-orange);
            color: #ffffff;
            box-shadow: 
                0 4px 12px rgba(255, 107, 53, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .tab-item.active::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
            border-radius: 1px;
        }

        .tab-icon {
            font-size: 0.9rem;
            opacity: 0.8;
            transition: all 0.2s var(--smooth-easing);
            position: relative;
        }

        .tab-item.active .tab-icon {
            opacity: 1;
            transform: scale(1.1);
        }

        .tab-item:hover .tab-icon {
            opacity: 1;
            transform: scale(1.05);
        }

        /* ENHANCED: Writing tab icon animation */
        .tab-item.writing .tab-icon {
            animation: iconPulse 1.5s ease-in-out infinite;
        }

        @keyframes iconPulse {
            0%, 100% { 
                transform: scale(1);
                opacity: 0.8;
            }
            50% { 
                transform: scale(1.2);
                opacity: 1;
                filter: drop-shadow(0 0 4px var(--accent-orange));
            }
        }

        .tab-name {
            font-weight: 500;
            transition: font-weight 0.2s var(--smooth-easing);
        }

        .tab-item.active .tab-name {
            font-weight: 600;
        }

        .file-display {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .file-header {
            background: rgba(255, 255, 255, 0.05);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.9rem;
            font-weight: 600;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-shrink: 0;
        }

        .file-content {
            flex: 1;
            overflow: auto;
            min-height: 0;
        }

        .file-content pre {
            padding: 1.5rem;
            margin: 0;
            background: #000000;
            color: #ffffff;
            font-size: 0.85rem;
            line-height: 1.6;
            font-family: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            height: 100%;
            box-sizing: border-box;
            min-height: 100%;
        }

        .file-content code {
            font-family: inherit;
        }

        .chat-icon-analytics {
            background: linear-gradient(135deg, #ff6b35 0%, #f59e0b 100%);
            box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
        }

        .chat-icon-ecommerce {
            background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
        }

        .chat-icon-mobile {
            background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
        }

        .chat-icon-saas {
            background: linear-gradient(135deg, #ec4899 0%, #f59e0b 100%);
            box-shadow: 0 4px 20px rgba(236, 72, 153, 0.4);
        }

        .chat-icon-portfolio {
            background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
            box-shadow: 0 4px 20px rgba(20, 184, 166, 0.4);
        }

        .chat-icon-template {
            background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
            box-shadow: 0 4px 20px rgba(107, 114, 128, 0.4);
        }

        .chat-icon-generic {
            background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
            box-shadow: 0 4px 20px rgba(75, 85, 99, 0.4);
        }

        @keyframes slideIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes typing {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }

        @keyframes orb-pulse {
            0% {
                box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4), 0 0 0 0 rgba(255, 107, 53, 0.3);
            }
            100% {
                box-shadow: 0 6px 25px rgba(255, 107, 53, 0.5), 0 0 0 4px rgba(255, 107, 53, 0.2);
            }
        }

        .project-active .chat-icon-analytics,
        .project-active .chat-icon-ecommerce,
        .project-active .chat-icon-mobile,
        .project-active .chat-icon-saas,
        .project-active .chat-icon-portfolio,
        .project-active .chat-icon-template,
        .project-active .chat-icon-generic {
            animation: orb-pulse 2s ease-in-out infinite alternate;
        }

        button, a, .clickable {
            transition: all 0.2s var(--smooth-easing);
        }

        button:focus-visible, a:focus-visible {
            outline: 2px solid var(--accent-orange);
            outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        @media (max-width: 768px) {
            .tab-item {
                padding: 0.5rem 0.75rem !important;
                font-size: 0.8rem !important;
                max-width: 120px !important;
            }
            
            .tab-group-label {
                font-size: 0.65rem !important;
            }
        }

        @media (max-width: 768px) {
            .sidebar-mobile {
                position: fixed;
                top: 0;
                left: 0;
                width: 85vw;
                max-width: 320px;
                height: 100vh;
                z-index: 1000;
                transform: translateX(-100%);
                transition: transform 0.3s var(--smooth-easing);
            }
            
            .sidebar-mobile.open {
                transform: translateX(0);
            }
            
            .side-pane {
                width: 100vw !important;
                z-index: 1002;
            }
            
            .main-content.with-side-pane {
                margin-right: 0;
            }
            
            .messages-container {
                padding: 1rem !important;
            }
            
            .message-bubble {
                padding: 1rem !important;
                font-size: 0.9rem !important;
                max-width: 85% !important;
            }
            
            .tab-container {
                gap: 0.25rem !important;
                padding: 0.25rem !important;
            }
            
            .tab-item {
                padding: 0.5rem 0.75rem !important;
                font-size: 0.75rem !important;
                max-width: 120px !important;
            }
        }

        @media (max-width: 480px) {
            .message-bubble {
                max-width: 90% !important;
                padding: 0.75rem !important;
            }
            
            .tab-item {
                max-width: 80px !important;
                font-size: 0.7rem !important;
            }
        }
    `}</style>
);