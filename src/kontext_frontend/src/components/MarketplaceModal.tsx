/**
 * Marketplace Modal
 * 
 * Portal-based modal wrapper for MarketplaceItemCreator
 * Immune to flickering during AI code streaming
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { MarketplaceItemCreator } from './MarketplaceItemCreator';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import type { Project } from '../types';

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  userCanisterId: string;
  identity: Identity;
  principal: Principal;
}

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  isOpen,
  onClose,
  project,
  userCanisterId,
  identity,
  principal
}) => {
  const portalRoot = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const streamingCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Flicker immunity - check if AI is streaming
  useEffect(() => {
    const checkStreamingState = () => {
      try {
        const streamingState = (window as any).__KONTEXT_STREAMING_STATE__;
        setIsStreamingActive(!!streamingState?.isStreaming);
      } catch (e) {
        setIsStreamingActive(false);
      }
    };

    if (isOpen) {
      checkStreamingState();
      streamingCheckInterval.current = setInterval(checkStreamingState, 100);
    }

    return () => {
      if (streamingCheckInterval.current) {
        clearInterval(streamingCheckInterval.current);
      }
    };
  }, [isOpen]);

  // Ensure portal root exists
  useEffect(() => {
    if (!portalRoot.current) {
      let existingPortalRoot = document.getElementById('marketplace-modal-portal-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'marketplace-modal-portal-root';
        existingPortalRoot.style.position = 'fixed';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '100003'; // Higher than project editor
        document.body.appendChild(existingPortalRoot);
      }
      portalRoot.current = existingPortalRoot;
    }
    if (isOpen) {
      setMounted(true);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  if (!isOpen || !mounted || !portalRoot.current || !project) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 100003,
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          overflow: 'auto',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
          animation: 'modalSlideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '0.5rem',
            cursor: 'pointer',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <X size={20} />
        </button>

        {/* Marketplace Item Creator */}
        <MarketplaceItemCreator
          userCanisterId={userCanisterId}
          identity={identity}
          principal={principal}
          preSelectedProjectId={project.id}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95) translateZ(0);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1) translateZ(0);
          }
        }
      `}</style>
    </div>,
    portalRoot.current
  );
};

