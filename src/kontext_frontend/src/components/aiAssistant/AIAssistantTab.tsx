/**
 * Main AI Assistant Tab - Entry point for natural language agent/workflow/agency creation
 */

import React, { useState } from 'react';
import { AIAgentBuilder } from './AIAgentBuilder';
import { AIWorkflowBuilder } from './AIWorkflowBuilder';
import { AIAgencyBuilder } from './AIAgencyBuilder';

type CreationType = 'agent' | 'workflow' | 'agency' | null;

interface AIAssistantTabProps {
  onSwitchToTab?: (tabId: string) => void;
}

export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({ onSwitchToTab }) => {
  const [selectedType, setSelectedType] = useState<CreationType>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const handleTypeSelect = (type: CreationType) => {
    setSelectedType(type);
    setShowBuilder(true);
  };

  const handleClose = () => {
    setShowBuilder(false);
    setSelectedType(null);
  };

  return (
    <div className="h-full flex flex-col" style={{ padding: '1rem', overflow: 'hidden' }}>
      {!showBuilder ? (
        <>
          {/* Header */}
          <div className="mb-4 flex-shrink-0" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 0.5rem 0'
            }}>
              ✨ AI Assistant
            </h2>
            <p style={{
              color: 'var(--text-gray)',
              margin: 0,
              fontSize: '0.95rem',
              lineHeight: 1.4
            }}>
              Create agents, workflows, and business agencies using natural language
            </p>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0, overflow: 'hidden', paddingTop: '0.5rem' }}>
            <div className="w-full max-w-5xl mx-auto" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flexShrink: 0, marginBottom: '1rem' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  What would you like to create?
                </h3>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Agent Card */}
                  <div
                    onClick={() => handleTypeSelect('agent')}
                    style={{
                      padding: '1rem',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      minHeight: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤖</div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>Agent</h4>
                    <p style={{ lineHeight: '1.4', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                      Create a single AI agent with specific capabilities
                    </p>
                  </div>

                  {/* Workflow Card */}
                  <div
                    onClick={() => handleTypeSelect('workflow')}
                    style={{
                      padding: '1rem',
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      minHeight: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>Workflow</h4>
                    <p style={{ lineHeight: '1.4', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                      Create a multi-agent workflow with orchestration
                    </p>
                  </div>

                  {/* Business Agency Card */}
                  <div
                    onClick={() => handleTypeSelect('agency')}
                    style={{
                      padding: '1rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      minHeight: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏢</div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>Business Agency</h4>
                    <p style={{ lineHeight: '1.4', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                      Create a business-oriented agency with goals and metrics
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips Section */}
              <div style={{
                padding: '1rem',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                marginTop: '1rem',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
              }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem' }}>💡</span>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Tips for Best Results</h4>
                </div>
                <ul style={{ lineHeight: '1.5', fontSize: '0.8125rem', color: 'var(--text-gray)', margin: 0, padding: 0, listStyle: 'none' }}>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgba(245, 158, 11, 0.9)', marginTop: '0.2rem', fontSize: '0.75rem' }}>•</span>
                    <span>Be specific about what you want the agent/workflow to do</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgba(245, 158, 11, 0.9)', marginTop: '0.2rem', fontSize: '0.75rem' }}>•</span>
                    <span>Mention any tools or services you want to integrate (Slack, GitHub, Zapier, etc.)</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgba(245, 158, 11, 0.9)', marginTop: '0.2rem', fontSize: '0.75rem' }}>•</span>
                    <span>Describe the workflow steps if creating a multi-agent system</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                    <span style={{ color: 'rgba(245, 158, 11, 0.9)', marginTop: '0.2rem', fontSize: '0.75rem' }}>•</span>
                    <span>Include business goals if creating a business agency</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {selectedType === 'agent' && (
            <AIAgentBuilder 
              onClose={handleClose} 
              onSuccess={handleClose}
              onSwitchToTab={onSwitchToTab}
            />
          )}
          {selectedType === 'workflow' && (
            <AIWorkflowBuilder 
              onClose={handleClose} 
              onSuccess={handleClose}
              onSwitchToTab={onSwitchToTab}
            />
          )}
          {selectedType === 'agency' && (
            <AIAgencyBuilder 
              onClose={handleClose} 
              onSuccess={handleClose}
              onSwitchToTab={onSwitchToTab}
            />
          )}
        </>
      )}
    </div>
  );
};

