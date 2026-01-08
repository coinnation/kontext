import React from 'react';
import type { CanvasState } from './types';

interface WorkflowToolbarProps {
  canvasState: CanvasState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onAutoLayout: () => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  className?: string;
}

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  canvasState,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onAutoLayout,
  onClear,
  onSave,
  onLoad,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  className = ''
}) => {
  const formatZoomLevel = (level: number) => `${Math.round(level * 100)}%`;

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left section - Canvas controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={onZoomOut}
              disabled={canvasState.zoomLevel <= 0.1}
              title="Zoom Out"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <span className="px-3 py-1 text-sm text-white min-w-[4rem] text-center">
              {formatZoomLevel(canvasState.zoomLevel)}
            </span>
            
            <button
              onClick={onZoomIn}
              disabled={canvasState.zoomLevel >= 3}
              title="Zoom In"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            <button
              onClick={onZoomToFit}
              title="Zoom to Fit"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          {/* Layout controls */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={onAutoLayout}
              title="Auto Layout"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-xs hidden sm:inline">Layout</span>
            </button>
          </div>

          {/* Undo/Redo */}
          {(onUndo || onRedo) && (
            <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
              {onUndo && (
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo"
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              )}
              
              {onRedo && (
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo"
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center section - Status */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Nodes:</span>
            <span className="text-white font-medium">{canvasState.nodes.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Connections:</span>
            <span className="text-white font-medium">{canvasState.edges.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Mode:</span>
            <span className="text-orange-400 font-medium capitalize">{canvasState.executionMode}</span>
          </div>
        </div>

        {/* Right section - File operations */}
        <div className="flex items-center gap-2">
          {/* Import/Export */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={onImport}
              title="Import Workflow"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="text-xs hidden sm:inline">Import</span>
            </button>
            
            <button
              onClick={onExport}
              title="Export Workflow"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="text-xs hidden sm:inline">Export</span>
            </button>
          </div>

          {/* Save/Load */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={onLoad}
              title="Load Template"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-xs hidden sm:inline">Load</span>
            </button>
            
            <button
              onClick={onSave}
              disabled={canvasState.nodes.length === 0}
              title="Save Workflow"
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span className="text-xs hidden sm:inline">Save</span>
            </button>
          </div>

          {/* Clear */}
          <button
            onClick={onClear}
            disabled={canvasState.nodes.length === 0}
            title="Clear Canvas"
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas state indicators */}
      {(canvasState.isDragging || canvasState.isConnecting) && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-4 text-xs">
            {canvasState.isDragging && (
              <span className="text-blue-400 flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                Dragging node
              </span>
            )}
            {canvasState.isConnecting && (
              <span className="text-green-400 flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Connecting: {canvasState.connectionSource} → ?
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};