import React from 'react';
import type { BusinessAgency } from '../../types/businessAgency';

interface DeleteBusinessAgencyModalProps {
  agency: BusinessAgency;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteBusinessAgencyModal: React.FC<DeleteBusinessAgencyModalProps> = ({ 
  agency, 
  onConfirm, 
  onCancel 
}) => {
  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        style={{
          background: 'var(--secondary-black)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
          padding: '2rem',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Delete Business Agency</h3>
        <p className="text-gray-300 mb-2">
          Are you sure you want to delete <strong className="text-white">"{agency.name}"</strong>?
        </p>
        <p className="text-red-400 text-sm mb-6">
          ⚠️ This will not delete the agents or workflows, only the agency organization.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '8px',
              color: '#9CA3AF',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#ef4444',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

