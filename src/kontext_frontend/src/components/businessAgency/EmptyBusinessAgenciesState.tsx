import React from 'react';
import { AGENCY_TEMPLATES } from '../../services/AgencyTemplatesService';
import type { BusinessAgencyTemplate } from '../../types/businessAgency';

interface EmptyBusinessAgenciesStateProps {
  onCreateFromTemplate: (template: BusinessAgencyTemplate) => void;
}

export const EmptyBusinessAgenciesState: React.FC<EmptyBusinessAgenciesStateProps> = ({ 
  onCreateFromTemplate 
}) => {
  return (
    <div className="text-center py-12">
      <div style={{
        width: '80px',
        height: '80px',
        background: 'rgba(255, 107, 53, 0.1)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem auto',
        border: '1px solid rgba(255, 107, 53, 0.2)'
      }}>
        <span style={{ fontSize: '2rem' }}>🏛️</span>
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">No Business Agencies Yet</h3>
      <p className="text-gray-400 mb-6 text-sm leading-relaxed max-w-lg mx-auto">
        Create a business agency to organize your agents and workflows by business purpose. 
        Choose from templates or create a custom agency.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        {AGENCY_TEMPLATES.map(template => (
          <button
            key={template.id}
            onClick={() => onCreateFromTemplate(template)}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1rem 1.5rem',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: '150px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = template.color;
              e.currentTarget.style.background = `${template.color}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            <span style={{ fontSize: '2rem' }}>{template.icon}</span>
            <span className="font-semibold text-sm">{template.name}</span>
            <span className="text-xs text-gray-400 text-center">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

