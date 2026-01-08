import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, DollarSign, Zap, Server, TrendingUp, AlertCircle, CheckCircle, Clock, ArrowRight, Plus } from 'lucide-react';

interface IcpConversionData {
  realIcpPrice: number;
  priceSource: string;
  priceAge: number;
  icpTokens: number;
  icpE8s: bigint;
  usdEquivalent: number;
}

interface CyclesBreakdown {
  runtimeCycles: bigint;
  creationOverhead: bigint;
  hostingDeploymentCost: bigint;
  safetyBuffer: bigint;
  totalCyclesExpected: bigint;
}

interface TransactionEntry {
  id: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  operationType: 'server_creation' | 'credit_addition' | 'management_server_topup' | 'server_pair_topup';
  source: 'hosting_interface' | 'server_pair_dialog' | 'management_server' | 'server_management';
  
  // Input data
  creditsRequested: number;
  serverPairName?: string;
  memoryGB: number;
  durationDays: number;
  
  // Target information (for top-ups)
  targetServerId?: string;
  targetServerType?: 'management' | 'frontend' | 'backend';
  targetServerName?: string;
  
  // ICP conversion data
  icpConversion: IcpConversionData;
  
  // Cycles breakdown
  cyclesBreakdown: CyclesBreakdown;
  
  // Transaction results
  platformIcpTransferred: bigint;
  blockIndex?: bigint;
  actualCyclesReceived: bigint;
  conversionEfficiency: number;
  
  // Server creation results (for server_creation type)
  frontendServerId?: string;
  backendServerId?: string;
  hostingConfigured?: boolean;
  
  // Verification data
  estimatedVsActual: {
    estimatedCycles: bigint;
    actualCycles: bigint;
    variance: number;
    withinTolerance: boolean;
  };
  
  // Timing data
  operationDuration: number;
  resourceAllocationTime: number;
  
  // Status
  success: boolean;
  errorMessage?: string;
}

interface TransactionTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'kontext_transaction_tracking';
const MAX_ENTRIES = 100; // Keep last 100 transactions

// Helper functions for formatting
const formatIcp = (e8s: bigint): string => {
  return (Number(e8s) / 100_000_000).toFixed(6);
};

const formatCycles = (cycles: bigint): string => {
  const trillion = Number(cycles) / 1_000_000_000_000;
  return `${trillion.toFixed(2)}T`;
};

const formatUsd = (amount: number): string => {
  return `$${amount.toFixed(4)}`;
};

const formatPercentage = (ratio: number): string => {
  return `${(ratio * 100).toFixed(1)}%`;
};

const getStatusColor = (success: boolean, efficiency?: number): string => {
  if (!success) return '#ef4444';
  if (efficiency && efficiency < 0.9) return '#f59e0b';
  return '#10b981';
};

const getVarianceColor = (variance: number): string => {
  const absVariance = Math.abs(variance);
  if (absVariance < 0.05) return '#10b981'; // Within 5%
  if (absVariance < 0.1) return '#f59e0b';  // Within 10%
  return '#ef4444'; // Greater than 10%
};

const getOperationIcon = (operationType: string): string => {
  switch (operationType) {
    case 'server_creation':
      return '🚀';
    case 'credit_addition':
      return '⚡';
    case 'management_server_topup':
      return '🏭';
    case 'server_pair_topup':
      return '🔋';
    default:
      return '💰';
  }
};

const getOperationLabel = (operationType: string): string => {
  switch (operationType) {
    case 'server_creation':
      return 'Server Creation';
    case 'credit_addition':
      return 'Credit Addition';
    case 'management_server_topup':
      return 'Management Server Top-Up';
    case 'server_pair_topup':
      return 'Server Pair Top-Up';
    default:
      return 'Transaction';
  }
};

const TransactionTrackingModalContent: React.FC<TransactionTrackingModalProps> = ({
  isOpen,
  onClose
}) => {
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionEntry | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'server_creation' | 'credit_addition' | 'management_server_topup' | 'server_pair_topup'>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'efficiency' | 'variance'>('timestamp');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Load transactions from localStorage
  useEffect(() => {
    const loadTransactions = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert BigInt strings back to BigInt
          const converted = parsed.map((entry: any) => ({
            ...entry,
            icpConversion: {
              ...entry.icpConversion,
              icpE8s: BigInt(entry.icpConversion.icpE8s)
            },
            cyclesBreakdown: {
              ...entry.cyclesBreakdown,
              runtimeCycles: BigInt(entry.cyclesBreakdown.runtimeCycles),
              creationOverhead: BigInt(entry.cyclesBreakdown.creationOverhead),
              hostingDeploymentCost: BigInt(entry.cyclesBreakdown.hostingDeploymentCost),
              safetyBuffer: BigInt(entry.cyclesBreakdown.safetyBuffer),
              totalCyclesExpected: BigInt(entry.cyclesBreakdown.totalCyclesExpected)
            },
            platformIcpTransferred: BigInt(entry.platformIcpTransferred),
            blockIndex: entry.blockIndex ? BigInt(entry.blockIndex) : undefined,
            actualCyclesReceived: BigInt(entry.actualCyclesReceived),
            estimatedVsActual: {
              ...entry.estimatedVsActual,
              estimatedCycles: BigInt(entry.estimatedVsActual.estimatedCycles),
              actualCycles: BigInt(entry.estimatedVsActual.actualCycles)
            }
          }));
          setTransactions(converted);
        }
      } catch (error) {
        console.error('Failed to load transaction tracking data:', error);
      }
    };

    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen]);

  // Clear all transactions
  const handleClearTransactions = () => {
    if (confirm('Are you sure you want to clear all transaction tracking data?')) {
      localStorage.removeItem(STORAGE_KEY);
      setTransactions([]);
      setSelectedTransaction(null);
    }
  };

  // Export transactions as JSON
  const handleExportTransactions = () => {
    try {
      // Convert BigInt to strings for JSON serialization
      const exportData = transactions.map(entry => ({
        ...entry,
        icpConversion: {
          ...entry.icpConversion,
          icpE8s: entry.icpConversion.icpE8s.toString()
        },
        cyclesBreakdown: {
          ...entry.cyclesBreakdown,
          runtimeCycles: entry.cyclesBreakdown.runtimeCycles.toString(),
          creationOverhead: entry.cyclesBreakdown.creationOverhead.toString(),
          hostingDeploymentCost: entry.cyclesBreakdown.hostingDeploymentCost.toString(),
          safetyBuffer: entry.cyclesBreakdown.safetyBuffer.toString(),
          totalCyclesExpected: entry.cyclesBreakdown.totalCyclesExpected.toString()
        },
        platformIcpTransferred: entry.platformIcpTransferred.toString(),
        blockIndex: entry.blockIndex?.toString(),
        actualCyclesReceived: entry.actualCyclesReceived.toString(),
        estimatedVsActual: {
          ...entry.estimatedVsActual,
          estimatedCycles: entry.estimatedVsActual.estimatedCycles.toString(),
          actualCycles: entry.estimatedVsActual.actualCycles.toString()
        }
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transaction-tracking-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export transaction data:', error);
    }
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter(t => filterType === 'all' || t.operationType === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'timestamp':
          return b.timestamp - a.timestamp;
        case 'efficiency':
          return b.conversionEfficiency - a.conversionEfficiency;
        case 'variance':
          return Math.abs(a.estimatedVsActual.variance) - Math.abs(b.estimatedVsActual.variance);
        default:
          return b.timestamp - a.timestamp;
      }
    });

  // Calculate summary stats
  const summaryStats = {
    totalTransactions: transactions.length,
    successfulTransactions: transactions.filter(t => t.success).length,
    averageEfficiency: transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + t.conversionEfficiency, 0) / transactions.length 
      : 0,
    totalIcpTransferred: transactions.reduce((sum, t) => sum + Number(t.platformIcpTransferred), 0) / 100_000_000,
    totalCyclesAllocated: transactions.reduce((sum, t) => sum + Number(t.actualCyclesReceived), 0) / 1_000_000_000_000,
    averageVariance: transactions.length > 0
      ? transactions.reduce((sum, t) => sum + Math.abs(t.estimatedVsActual.variance), 0) / transactions.length
      : 0,
    operationBreakdown: {
      serverCreation: transactions.filter(t => t.operationType === 'server_creation').length,
      creditAddition: transactions.filter(t => t.operationType === 'credit_addition').length,
      managementTopups: transactions.filter(t => t.operationType === 'management_server_topup').length,
      serverPairTopups: transactions.filter(t => t.operationType === 'server_pair_topup').length
    }
  };

  return (
    <>
      {/* Fixed Backdrop with matching z-index */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 999999,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        {/* Main Dialog with proper z-index isolation */}
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: 'relative',
            width: isMobile ? '100vw' : 'min(95vw, 1200px)',
            height: isMobile ? '100vh' : 'min(90vh, 800px)',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1e1e1e 100%)',
            border: isMobile ? 'none' : '2px solid rgba(255, 107, 53, 0.3)',
            borderRadius: isMobile ? '0' : '16px',
            boxShadow: isMobile ? 'none' : '0 25px 80px rgba(0, 0, 0, 0.9), 0 10px 40px rgba(255, 107, 53, 0.2)',
            zIndex: 1000001,
            isolation: 'isolate',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Header with enhanced background */}
          <div style={{
            padding: isMobile ? '1rem' : '1.5rem',
            borderBottom: '2px solid rgba(255, 107, 53, 0.3)',
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 107, 53, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)'
              }}>
                📊
              </div>
              <div>
                <h2 style={{
                  fontSize: isMobile ? '1.25rem' : '1.5rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                  marginBottom: '0.25rem',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}>
                  Value Flow Tracker
                </h2>
                <p style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  margin: 0
                }}>
                  Real ICP pricing, cycle top-ups & resource allocation analysis
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <X size={20} color="#ffffff" />
            </button>
          </div>

          {/* Enhanced Summary Stats with operation breakdown */}
          <div style={{
            padding: isMobile ? '1rem' : '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.04))',
            backdropFilter: 'blur(10px)'
          }}>
            {/* Main Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
              gap: isMobile ? '0.75rem' : '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '700', color: '#10b981' }}>
                  {summaryStats.totalTransactions}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>Total Operations</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '700', color: '#10b981' }}>
                  {summaryStats.successfulTransactions}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>Successful</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '700', color: '#3b82f6' }}>
                  {formatPercentage(summaryStats.averageEfficiency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>Avg Efficiency</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '700', color: '#8b5cf6' }}>
                  {summaryStats.totalIcpTransferred.toFixed(3)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>ICP Transferred</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '700', color: '#f59e0b' }}>
                  {summaryStats.totalCyclesAllocated.toFixed(1)}T
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>Cycles Allocated</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: isMobile ? '1.2rem' : '1.4rem',
                  fontWeight: '700',
                  color: getVarianceColor(summaryStats.averageVariance)
                }}>
                  {formatPercentage(summaryStats.averageVariance)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>Avg Variance</div>
              </div>
            </div>

            {/* Operation Type Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', color: '#ff6b35', marginBottom: '0.25rem' }}>🚀</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
                  {summaryStats.operationBreakdown.serverCreation}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Server Creation</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', color: '#10b981', marginBottom: '0.25rem' }}>⚡</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
                  {summaryStats.operationBreakdown.creditAddition}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Credit Addition</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', color: '#3b82f6', marginBottom: '0.25rem' }}>🏭</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
                  {summaryStats.operationBreakdown.managementTopups}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Mgmt Top-ups</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', color: '#f59e0b', marginBottom: '0.25rem' }}>🔋</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
                  {summaryStats.operationBreakdown.serverPairTopups}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Server Top-ups</div>
              </div>
            </div>
          </div>

          {/* Enhanced Controls */}
          <div style={{
            padding: isMobile ? '0.75rem' : '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '0.75rem',
              flex: 1
            }}>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                style={{
                  padding: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <option value="all">All Operations</option>
                <option value="server_creation">Server Creation</option>
                <option value="credit_addition">Credit Addition</option>
                <option value="management_server_topup">Management Server Top-ups</option>
                <option value="server_pair_topup">Server Pair Top-ups</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <option value="timestamp">Sort by Time</option>
                <option value="efficiency">Sort by Efficiency</option>
                <option value="variance">Sort by Variance</option>
              </select>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexShrink: 0
            }}>
              <button
                onClick={handleExportTransactions}
                disabled={transactions.length === 0}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '6px',
                  color: '#10b981',
                  fontSize: '0.8rem',
                  cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: transactions.length === 0 ? 0.5 : 1,
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (transactions.length > 0) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (transactions.length > 0) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  }
                }}
              >
                📦 Export
              </button>
              <button
                onClick={handleClearTransactions}
                disabled={transactions.length === 0}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: transactions.length === 0 ? 0.5 : 1,
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (transactions.length > 0) {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (transactions.length > 0) {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  }
                }}
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          {/* Enhanced Content with proper backgrounds */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            {/* Transactions List with enhanced styling */}
            <div style={{
              flex: selectedTransaction ? (isMobile ? 0 : 1) : 1,
              display: selectedTransaction && isMobile ? 'none' : 'flex',
              flexDirection: 'column',
              borderRight: !isMobile && selectedTransaction ? '2px solid rgba(255, 107, 53, 0.2)' : 'none',
              background: 'rgba(255, 255, 255, 0.03)'
            }}>
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  margin: 0,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                }}>
                  Transaction History ({filteredAndSortedTransactions.length})
                </h3>
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto'
              }}>
                {filteredAndSortedTransactions.length === 0 ? (
                  <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>
                      📊
                    </div>
                    <h4 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                      No Transactions Yet
                    </h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                      Create server pairs, add credits, or perform cycle top-ups to see transaction tracking data here.
                      All ICP pricing conversions and resource allocations are tracked with full transparency.
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: '0.5rem' }}>
                    {filteredAndSortedTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        style={{
                          padding: '1rem',
                          margin: '0.5rem',
                          background: selectedTransaction?.id === transaction.id 
                            ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(255, 107, 53, 0.1))' 
                            : 'rgba(255, 255, 255, 0.05)',
                          border: selectedTransaction?.id === transaction.id 
                            ? '2px solid rgba(255, 107, 53, 0.5)' 
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          backdropFilter: 'blur(10px)',
                          boxShadow: selectedTransaction?.id === transaction.id
                            ? '0 4px 20px rgba(255, 107, 53, 0.3)'
                            : '0 2px 10px rgba(0, 0, 0, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedTransaction?.id !== transaction.id) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTransaction?.id !== transaction.id) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem'
                        }}>
                          <div>
                            <div style={{
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              color: '#ffffff',
                              marginBottom: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              {getOperationIcon(transaction.operationType)} {transaction.projectName}
                              {transaction.success ? (
                                <CheckCircle size={14} color="#10b981" />
                              ) : (
                                <AlertCircle size={14} color="#ef4444" />
                              )}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.7)',
                              marginBottom: '0.25rem'
                            }}>
                              {getOperationLabel(transaction.operationType)}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                              {new Date(transaction.timestamp).toLocaleString()} • {transaction.source.replace(/_/g, ' ')}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: getStatusColor(transaction.success, transaction.conversionEfficiency),
                            textAlign: 'right'
                          }}>
                            {formatPercentage(transaction.conversionEfficiency)}
                            <div style={{
                              fontSize: '0.7rem',
                              color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                              efficiency
                            </div>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '0.5rem',
                          fontSize: '0.75rem'
                        }}>
                          <div>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Credits:</span>{' '}
                            <span style={{ color: '#ffffff' }}>{transaction.creditsRequested.toLocaleString()}</span>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ICP:</span>{' '}
                            <span style={{ color: '#ffffff' }}>{formatIcp(transaction.platformIcpTransferred)}</span>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Cycles:</span>{' '}
                            <span style={{ color: '#ffffff' }}>{formatCycles(transaction.actualCyclesReceived)}</span>
                          </div>
                        </div>
                        
                        {/* Target info for top-ups */}
                        {(transaction.operationType === 'management_server_topup' || transaction.operationType === 'server_pair_topup') && (
                          <div style={{
                            marginTop: '0.5rem',
                            fontSize: '0.7rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px'
                          }}>
                            Target: {transaction.targetServerName || transaction.targetServerId} ({transaction.targetServerType})
                          </div>
                        )}
                        
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          background: `${getVarianceColor(transaction.estimatedVsActual.variance)}20`,
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          color: getVarianceColor(transaction.estimatedVsActual.variance)
                        }}>
                          Variance: {formatPercentage(Math.abs(transaction.estimatedVsActual.variance))}
                          {transaction.estimatedVsActual.withinTolerance ? ' ✓' : ' ⚠️'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Transaction Details */}
            {selectedTransaction && (
              <div style={{
                flex: isMobile ? 1 : 1.5,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  padding: '1rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.03)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#ffffff',
                    margin: 0,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                  }}>
                    Transaction Details
                  </h3>
                  {isMobile && (
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '1rem',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back
                    </button>
                  )}
                </div>

                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem'
                }}>
                  {/* Transaction Overview */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 107, 53, 0.08))',
                    border: '2px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#ff6b35',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <TrendingUp size={16} /> Transaction Overview
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem',
                      fontSize: '0.8rem'
                    }}>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Operation</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {getOperationLabel(selectedTransaction.operationType)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Source</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.source.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Duration</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.operationDuration}s
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Status</div>
                        <div style={{
                          color: getStatusColor(selectedTransaction.success),
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          {selectedTransaction.success ? (
                            <>
                              <CheckCircle size={12} /> Success
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} /> Failed
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Target Server Information for Top-ups */}
                    {(selectedTransaction.operationType === 'management_server_topup' || selectedTransaction.operationType === 'server_pair_topup') && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#3b82f6',
                          marginBottom: '0.5rem'
                        }}>
                          🎯 Target Server Details
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '0.5rem',
                          fontSize: '0.75rem'
                        }}>
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Server ID</div>
                            <div style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                              {selectedTransaction.targetServerId}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Type</div>
                            <div style={{ color: '#ffffff', fontWeight: '500' }}>
                              {selectedTransaction.targetServerType}
                            </div>
                          </div>
                          {selectedTransaction.targetServerName && (
                            <div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Name</div>
                              <div style={{ color: '#ffffff', fontWeight: '500' }}>
                                {selectedTransaction.targetServerName}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTransaction.errorMessage && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#ef4444'
                      }}>
                        Error: {selectedTransaction.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* ICP Conversion Data */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.08))',
                    border: '2px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#8b5cf6',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <DollarSign size={16} /> ICP Market Conversion
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem',
                      fontSize: '0.8rem'
                    }}>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Credits Requested</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.creditsRequested.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>USD Equivalent</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatUsd(selectedTransaction.icpConversion.usdEquivalent)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>ICP Price</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatUsd(selectedTransaction.icpConversion.realIcpPrice)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>ICP Amount</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.icpConversion.icpTokens.toFixed(6)} ICP
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Price Source</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.icpConversion.priceSource}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Price Age</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {Math.round(selectedTransaction.icpConversion.priceAge / 1000)}s
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cycles Breakdown */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.08))',
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#f59e0b',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Zap size={16} /> Cycles Resource Breakdown
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem',
                      fontSize: '0.8rem'
                    }}>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Runtime Cycles</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.cyclesBreakdown.runtimeCycles)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Creation Overhead</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.cyclesBreakdown.creationOverhead)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Hosting Cost</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.cyclesBreakdown.hostingDeploymentCost)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Safety Buffer</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.cyclesBreakdown.safetyBuffer)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Total Expected</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.cyclesBreakdown.totalCyclesExpected)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Memory/Duration</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {selectedTransaction.memoryGB}GB × {selectedTransaction.durationDays}d
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results Comparison */}
                  <div style={{
                    background: `linear-gradient(135deg, rgba(${selectedTransaction.estimatedVsActual.withinTolerance ? '16, 185, 129' : '239, 68, 68'}, 0.15), rgba(${selectedTransaction.estimatedVsActual.withinTolerance ? '16, 185, 129' : '239, 68, 68'}, 0.08))`,
                    border: `2px solid rgba(${selectedTransaction.estimatedVsActual.withinTolerance ? '16, 185, 129' : '239, 68, 68'}, 0.3)`,
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: selectedTransaction.estimatedVsActual.withinTolerance ? '#10b981' : '#ef4444',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Server size={16} /> Estimated vs Actual Results
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem',
                      fontSize: '0.8rem'
                    }}>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Estimated Cycles</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.estimatedVsActual.estimatedCycles)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Actual Cycles</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatCycles(selectedTransaction.estimatedVsActual.actualCycles)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Variance</div>
                        <div style={{
                          color: getVarianceColor(selectedTransaction.estimatedVsActual.variance),
                          fontWeight: '500'
                        }}>
                          {selectedTransaction.estimatedVsActual.variance > 0 ? '+' : ''}{formatPercentage(selectedTransaction.estimatedVsActual.variance)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Conversion Efficiency</div>
                        <div style={{
                          color: getStatusColor(selectedTransaction.success, selectedTransaction.conversionEfficiency),
                          fontWeight: '500'
                        }}>
                          {formatPercentage(selectedTransaction.conversionEfficiency)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Within Tolerance</div>
                        <div style={{
                          color: selectedTransaction.estimatedVsActual.withinTolerance ? '#10b981' : '#ef4444',
                          fontWeight: '500'
                        }}>
                          {selectedTransaction.estimatedVsActual.withinTolerance ? '✓ Yes' : '⚠️ No'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>ICP Transferred</div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                          {formatIcp(selectedTransaction.platformIcpTransferred)} ICP
                        </div>
                      </div>
                    </div>
                    {selectedTransaction.blockIndex && (
                      <div style={{
                        marginTop: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        Block Index: {selectedTransaction.blockIndex.toString()}
                      </div>
                    )}
                  </div>

                  {/* Server Creation Results */}
                  {selectedTransaction.operationType === 'server_creation' && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08))',
                      border: '2px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <h4 style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#10b981',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <Server size={16} /> Server Creation Results
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        fontSize: '0.8rem'
                      }}>
                        {selectedTransaction.serverPairName && (
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Server Pair Name</div>
                            <div style={{ color: '#ffffff', fontWeight: '500' }}>
                              {selectedTransaction.serverPairName}
                            </div>
                          </div>
                        )}
                        {selectedTransaction.frontendServerId && (
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Frontend Server</div>
                            <div style={{ color: '#ffffff', fontWeight: '500', fontFamily: 'monospace' }}>
                              {selectedTransaction.frontendServerId}
                            </div>
                          </div>
                        )}
                        {selectedTransaction.backendServerId && (
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Backend Server</div>
                            <div style={{ color: '#ffffff', fontWeight: '500', fontFamily: 'monospace' }}>
                              {selectedTransaction.backendServerId}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Hosting Configured</div>
                          <div style={{
                            color: selectedTransaction.hostingConfigured ? '#10b981' : '#f59e0b',
                            fontWeight: '500'
                          }}>
                            {selectedTransaction.hostingConfigured ? '✅ Yes' : '⚠️ Partial'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Resource Allocation Time</div>
                          <div style={{ color: '#ffffff', fontWeight: '500' }}>
                            {selectedTransaction.resourceAllocationTime}s
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const TransactionTrackingModal: React.FC<TransactionTrackingModalProps> = (props) => {
  if (!props.isOpen) {
    return null;
  }

  const getPortalContainer = () => {
    let container = document.getElementById('transaction-tracking-modal-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'transaction-tracking-modal-root';
      container.style.position = 'relative';
      container.style.zIndex = '999999';
      document.body.appendChild(container);
    }
    return container;
  };

  return ReactDOM.createPortal(
    <TransactionTrackingModalContent {...props} />,
    getPortalContainer()
  );
};

// Export utility functions for storing transaction data
export const storeTransactionData = (entry: Omit<TransactionEntry, 'id' | 'timestamp'>) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    let transactions: TransactionEntry[] = [];
    
    if (existingData) {
      transactions = JSON.parse(existingData);
    }
    
    const newEntry: TransactionEntry = {
      ...entry,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    // Add to beginning of array
    transactions.unshift(newEntry);
    
    // Keep only the most recent entries
    if (transactions.length > MAX_ENTRIES) {
      transactions = transactions.slice(0, MAX_ENTRIES);
    }
    
    // Convert BigInt to strings for JSON serialization
    const serializable = transactions.map(entry => ({
      ...entry,
      icpConversion: {
        ...entry.icpConversion,
        icpE8s: entry.icpConversion.icpE8s.toString()
      },
      cyclesBreakdown: {
        ...entry.cyclesBreakdown,
        runtimeCycles: entry.cyclesBreakdown.runtimeCycles.toString(),
        creationOverhead: entry.cyclesBreakdown.creationOverhead.toString(),
        hostingDeploymentCost: entry.cyclesBreakdown.hostingDeploymentCost.toString(),
        safetyBuffer: entry.cyclesBreakdown.safetyBuffer.toString(),
        totalCyclesExpected: entry.cyclesBreakdown.totalCyclesExpected.toString()
      },
      platformIcpTransferred: entry.platformIcpTransferred.toString(),
      blockIndex: entry.blockIndex?.toString(),
      actualCyclesReceived: entry.actualCyclesReceived.toString(),
      estimatedVsActual: {
        ...entry.estimatedVsActual,
        estimatedCycles: entry.estimatedVsActual.estimatedCycles.toString(),
        actualCycles: entry.estimatedVsActual.actualCycles.toString()
      }
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    console.log('📊 [TransactionTracking] Stored new transaction entry:', newEntry.id);
    
  } catch (error) {
    console.error('❌ [TransactionTracking] Failed to store transaction data:', error);
  }
};

// Helper function to store cycle top-up transactions
export const storeCycleTopupTransaction = (data: {
  projectId: string;
  projectName: string;
  targetServerId: string;
  targetServerType: 'management' | 'frontend' | 'backend';
  targetServerName?: string;
  creditsRequested: number;
  icpConversion: IcpConversionData;
  platformIcpTransferred: bigint;
  blockIndex?: bigint;
  actualCyclesReceived: bigint;
  conversionEfficiency: number;
  operationDuration: number;
  resourceAllocationTime: number;
  success: boolean;
  errorMessage?: string;
}) => {
  // Create a cycles breakdown for top-ups (simplified)
  const cyclesBreakdown: CyclesBreakdown = {
    runtimeCycles: data.actualCyclesReceived, // For top-ups, all cycles are "runtime"
    creationOverhead: 0n,
    hostingDeploymentCost: 0n,
    safetyBuffer: 0n,
    totalCyclesExpected: data.actualCyclesReceived
  };

  const operationType = data.targetServerType === 'management' 
    ? 'management_server_topup' as const
    : 'server_pair_topup' as const;

  const source = data.targetServerType === 'management' 
    ? 'management_server' as const
    : 'server_management' as const;

  storeTransactionData({
    projectId: data.projectId,
    projectName: data.projectName,
    operationType: operationType,
    source: source,
    creditsRequested: data.creditsRequested,
    memoryGB: 1, // Default for top-ups
    durationDays: 30, // Default for top-ups
    targetServerId: data.targetServerId,
    targetServerType: data.targetServerType,
    targetServerName: data.targetServerName,
    icpConversion: data.icpConversion,
    cyclesBreakdown: cyclesBreakdown,
    platformIcpTransferred: data.platformIcpTransferred,
    blockIndex: data.blockIndex,
    actualCyclesReceived: data.actualCyclesReceived,
    conversionEfficiency: data.conversionEfficiency,
    estimatedVsActual: {
      estimatedCycles: cyclesBreakdown.totalCyclesExpected,
      actualCycles: data.actualCyclesReceived,
      variance: data.conversionEfficiency - 1,
      withinTolerance: Math.abs(data.conversionEfficiency - 1) <= 0.1
    },
    operationDuration: data.operationDuration,
    resourceAllocationTime: data.resourceAllocationTime,
    success: data.success,
    errorMessage: data.errorMessage
  });
};

export default TransactionTrackingModal;