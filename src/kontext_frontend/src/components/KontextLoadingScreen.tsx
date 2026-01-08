import React from 'react';

interface KontextLoadingScreenProps {
  message?: string;
  subtitle?: string;
  isMobile?: boolean;
  fullScreen?: boolean;
}

/**
 * 🎯 STANDARDIZED KONTEXT LOADING SCREEN
 * 
 * Used across all transitions (ChatInterface, ProfileInterface, AdminInterface, etc.)
 * Matches the style used in SidePane and app refresh loading screens
 */
export const KontextLoadingScreen: React.FC<KontextLoadingScreenProps> = ({
  message = 'Loading...',
  subtitle,
  isMobile = false,
  fullScreen = true
}) => {
  const logoSize = isMobile ? 64 : 72;
  const titleSize = isMobile ? '1rem' : '1.1rem';
  const subtitleSize = isMobile ? '0.85rem' : '0.9rem';

  return (
    <div style={{
      position: fullScreen ? 'fixed' : 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(30, 30, 30, 0.98)',
      backdropFilter: 'blur(12px) saturate(150%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      transition: 'opacity 0.2s ease'
    }}>
      {/* Kontext Logo */}
      <div style={{
        width: `${logoSize}px`,
        height: `${logoSize}px`,
        marginBottom: '1.5rem',
        position: 'relative',
        animation: 'kontextPulse 2s ease-in-out infinite'
      }}>
        <img 
          src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png"
          alt="Kontext Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 12px rgba(255, 107, 53, 0.3))'
          }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
          animation: 'kontextShine 2s ease-in-out infinite',
          pointerEvents: 'none'
        }} />
      </div>
      
      {/* Main Message */}
      <div style={{
        color: '#ffffff',
        fontSize: titleSize,
        fontWeight: 600,
        marginBottom: subtitle ? '0.5rem' : '0',
        textAlign: 'center'
      }}>
        {message}
      </div>
      
      {/* Subtitle (optional) */}
      {subtitle && (
        <div style={{
          color: '#ff6b35',
          fontSize: subtitleSize,
          fontWeight: 500,
          textAlign: 'center',
          opacity: 0.8
        }}>
          {subtitle}
        </div>
      )}
      
      {/* Loading Dots */}
      <div style={{
        marginTop: '2rem',
        display: 'flex',
        gap: '6px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6b35, #10b981)',
              animation: `kontextDots 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes kontextPulse {
          0%, 100% { 
            transform: scale(1);
            filter: drop-shadow(0 4px 12px rgba(255, 107, 53, 0.3));
          }
          50% { 
            transform: scale(1.05);
            filter: drop-shadow(0 6px 16px rgba(255, 107, 53, 0.4));
          }
        }
        
        @keyframes kontextShine {
          0%, 100% { 
            transform: translateX(-100%) rotate(45deg);
            opacity: 0;
          }
          50% { 
            transform: translateX(100%) rotate(45deg);
            opacity: 1;
          }
        }
        
        @keyframes kontextDots {
          0%, 60%, 100% { 
            transform: scale(1);
            opacity: 0.7;
          }
          30% { 
            transform: scale(1.3);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
