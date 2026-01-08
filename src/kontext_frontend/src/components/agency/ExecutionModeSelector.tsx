import React from 'react';

interface ExecutionModeSelectorProps {
  value: 'sequential' | 'parallel' | 'conditional';
  onChange: (mode: 'sequential' | 'parallel' | 'conditional') => void;
  className?: string;
  isCompact?: boolean;
}

export const ExecutionModeSelector: React.FC<ExecutionModeSelectorProps> = ({
  value,
  onChange,
  className = '',
  isCompact = false
}) => {
  const modes = [
    {
      id: 'sequential' as const,
      name: 'Sequential',
      description: 'Execute agents one after another in order',
      icon: '➡️',
      pros: ['Predictable execution order', 'Easy to debug', 'Lower resource usage'],
      cons: ['Slower execution time', 'Single point of failure'],
      useCase: 'When agents depend on previous results'
    },
    {
      id: 'parallel' as const,
      name: 'Parallel',
      description: 'Execute multiple agents simultaneously',
      icon: '⚡',
      pros: ['Faster execution', 'Better resource utilization', 'Higher throughput'],
      cons: ['More complex coordination', 'Higher resource usage'],
      useCase: 'When agents can work independently'
    },
    {
      id: 'conditional' as const,
      name: 'Conditional',
      description: 'Execute agents based on conditions and results',
      icon: '🔀',
      pros: ['Smart routing', 'Efficient resource usage', 'Adaptive workflows'],
      cons: ['Complex setup', 'Harder to predict', 'More testing required'],
      useCase: 'When execution path depends on data or results'
    }
  ];

  if (isCompact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-400 font-medium" style={{ marginLeft: '1.5rem' }}>Mode:</span>
        <div className="flex gap-1">
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onChange(mode.id)}
              className="px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1"
              style={{
                background: value === mode.id
                  ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-orange-light))'
                  : 'rgba(255, 255, 255, 0.05)',
                color: value === mode.id ? 'white' : 'var(--text-gray)',
                border: value === mode.id 
                  ? '1px solid var(--accent-orange)' 
                  : '1px solid var(--border-color)',
                boxShadow: value === mode.id ? '0 4px 12px rgba(255, 107, 53, 0.3)' : 'none'
              }}
              title={mode.description}
            >
              <span className="text-sm">{mode.icon}</span>
              <span>{mode.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map(mode => (
          <div
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className="p-4 rounded-lg border-2 cursor-pointer transition-all duration-200"
            style={{
              borderColor: value === mode.id ? 'var(--accent-orange)' : 'var(--border-color)',
              background: value === mode.id 
                ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.05))'
                : 'rgba(255, 255, 255, 0.05)'
            }}
            onMouseEnter={(e) => {
              if (value !== mode.id) {
                e.currentTarget.style.borderColor = 'var(--accent-orange)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (value !== mode.id) {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{mode.icon}</span>
              <div>
                <h3 className={`font-semibold ${
                  value === mode.id ? 'text-orange-400' : 'text-white'
                }`}>
                  {mode.name}
                </h3>
                <p className="text-sm text-gray-400">{mode.description}</p>
              </div>
            </div>

            {value === mode.id && (
              <div className="space-y-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2">Advantages</h4>
                  <ul className="text-xs text-gray-300 space-y-1">
                    {mode.pros.map(pro => (
                      <li key={pro} className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-yellow-400 mb-2">Considerations</h4>
                  <ul className="text-xs text-gray-300 space-y-1">
                    {mode.cons.map(con => (
                      <li key={con} className="flex items-center gap-2">
                        <span className="text-yellow-400">⚠</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded p-3" style={{ background: 'rgba(107, 114, 128, 0.2)' }}>
                  <h4 className="text-sm font-medium text-orange-400 mb-1">Best for:</h4>
                  <p className="text-xs text-gray-300">{mode.useCase}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Visual representation */}
      <div className="rounded-lg p-4 border" style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'var(--border-color)'
      }}>
        <h4 className="text-sm font-medium text-white mb-3">Execution Flow Preview</h4>
        <div className="flex items-center justify-center h-20">
          {value === 'sequential' && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-8 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-orange)' }}>A1</div>
              <span className="text-gray-400">→</span>
              <div className="w-12 h-8 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-orange)' }}>A2</div>
              <span className="text-gray-400">→</span>
              <div className="w-12 h-8 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-orange)' }}>A3</div>
            </div>
          )}
          
          {value === 'parallel' && (
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-green)' }}>A1</div>
              <div className="flex flex-col gap-1">
                <div className="w-12 h-6 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-green)' }}>A2</div>
                <div className="w-12 h-6 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-green)' }}>A3</div>
              </div>
              <div className="w-12 h-8 rounded flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-green)' }}>A4</div>
            </div>
          )}
          
          {value === 'conditional' && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-8 bg-purple-600 rounded flex items-center justify-center text-xs text-white">A1</div>
              <span className="text-gray-400">→</span>
              <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center text-xs">?</div>
              <div className="flex flex-col gap-1">
                <div className="w-12 h-6 bg-purple-600 rounded flex items-center justify-center text-xs text-white">A2</div>
                <div className="w-12 h-6 bg-purple-600 rounded flex items-center justify-center text-xs text-white">A3</div>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          {value === 'sequential' && 'Agents execute in sequence, one after another'}
          {value === 'parallel' && 'Multiple agents can execute simultaneously'}
          {value === 'conditional' && 'Execution path determined by conditions and results'}
        </p>
      </div>
    </div>
  );
};