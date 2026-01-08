import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../store/appStore';

interface UserDropdownProps {
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
  onOpenUniversity?: () => void;
  onOpenMarketplace?: () => void;
  onOpenForum?: () => void;
  onLogout: () => void;
}

export function UserDropdown({ onOpenProfile, onOpenAdmin, onOpenUniversity, onOpenMarketplace, onOpenForum, onLogout }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { principal } = useAuth();

  // Check if user is admin
  const ADMIN_PRINCIPALS = [
    "li46q-ibtpp-tv7ld-kbpqz-x6tra-qwarp-b4g4o-gzam2-jaxig-qeuwa-xqe",
    "bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe"
  ];
  const isAdmin = principal ? ADMIN_PRINCIPALS.includes(principal.toString()) : false;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: '#ffffff',
          padding: '0.75rem 1rem',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.95rem'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        👤 Profile
        <span style={{
          marginLeft: '0.25rem',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '0.5rem',
          background: 'rgba(17, 17, 17, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          minWidth: '200px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 107, 53, 0.1)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#ff6b35',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Signed in as:
            </div>
            <div 
              onClick={async (e) => {
                if (principal) {
                  try {
                    await navigator.clipboard.writeText(principal.toString());
                    // Show temporary feedback
                    const target = e.currentTarget;
                    const originalText = target.textContent;
                    target.textContent = '✓ Copied!';
                    target.style.color = '#10b981';
                    setTimeout(() => {
                      if (target.textContent === '✓ Copied!') {
                        target.textContent = originalText;
                        target.style.color = '#e5e7eb';
                      }
                    }, 2000);
                  } catch (err) {
                    console.error('Failed to copy:', err);
                  }
                }
              }}
              style={{
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#e5e7eb',
                wordBreak: 'break-all',
                lineHeight: '1.4',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '4px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#e5e7eb';
              }}
              title="Click to copy Principal ID"
            >
              {principal?.toString()}
            </div>
          </div>

          <div style={{ padding: '0.5rem 0' }}>
            <button
              onClick={() => handleItemClick(onOpenProfile)}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ⚙️ Account & Billing
            </button>

            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => handleItemClick(onOpenAdmin)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🔐 Admin Panel
              </button>
            )}

            {onOpenUniversity && (
              <button
                onClick={() => handleItemClick(onOpenUniversity)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🎓 University
              </button>
            )}

            {onOpenMarketplace && (
              <button
                onClick={() => handleItemClick(onOpenMarketplace)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🛒 Marketplace
              </button>
            )}

            {onOpenForum && (
              <button
                onClick={() => handleItemClick(onOpenForum)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#E5E7EB',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                💬 Forum
              </button>
            )}

            <div style={{
              height: '1px',
              background: 'rgba(255, 255, 255, 0.1)',
              margin: '0.5rem 0'
            }} />

            <button
              onClick={() => handleItemClick(onLogout)}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}