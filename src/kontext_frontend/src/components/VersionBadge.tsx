import React from 'react';
import { Package, Edit3 } from 'lucide-react';

interface VersionBadgeProps {
  versionString?: string | null;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  versionString,
  variant = 'default',
  className = '',
}) => {
  const isWorkingCopy = !versionString;

  // Compact variant (just the badge, no icon)
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
        style={{
          background: isWorkingCopy 
            ? 'rgba(249, 115, 22, 0.2)' 
            : 'rgba(59, 130, 246, 0.2)',
          color: isWorkingCopy ? '#f97316' : '#3b82f6',
        }}
      >
        {isWorkingCopy ? 'Sandbox' : versionString}
      </span>
    );
  }

  // Inline variant (smaller, for sidebar)
  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${className}`}
        style={{
          background: isWorkingCopy 
            ? 'rgba(249, 115, 22, 0.15)' 
            : 'rgba(59, 130, 246, 0.15)',
          color: isWorkingCopy 
            ? 'rgba(249, 115, 22, 0.9)' 
            : 'rgba(59, 130, 246, 0.9)',
        }}
      >
        {isWorkingCopy ? (
          <Edit3 className="w-3 h-3" />
        ) : (
          <Package className="w-3 h-3" />
        )}
        <span className="font-mono">
          {isWorkingCopy ? 'SB' : versionString}
        </span>
      </span>
    );
  }

  // Default variant (full size with icon)
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${className}`}
      style={{
        background: isWorkingCopy 
          ? 'rgba(249, 115, 22, 0.15)' 
          : 'rgba(59, 130, 246, 0.15)',
        border: `1px solid ${isWorkingCopy 
          ? 'rgba(249, 115, 22, 0.3)' 
          : 'rgba(59, 130, 246, 0.3)'}`,
      }}
    >
      {isWorkingCopy ? (
        <Edit3 className="w-4 h-4" style={{ color: '#f97316' }} />
      ) : (
        <Package className="w-4 h-4" style={{ color: '#3b82f6' }} />
      )}
      <span
        className="text-sm font-medium"
        style={{
          color: isWorkingCopy ? '#f97316' : '#3b82f6',
        }}
      >
        {isWorkingCopy ? 'Sandbox' : versionString}
      </span>
    </div>
  );
};

export default VersionBadge;



