import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { 
  economyMetricsService, 
  SubscriptionEvent, 
  DeploymentEvent, 
  ProjectCreationEvent,
  UserCycleBalance,
  ServerPairCycleBalance,
  UserCreditsBalance,
  MasterWalletBalance,
  EmployeeCompensation
} from '../services/EconomyMetricsService';
import { formatCycles, formatIcpBalance } from '../utils/icpUtils';
import { getCanisterCycleBalance } from '../utils/icpUtils';
import { userCanisterService } from '../services/UserCanisterService';
import { CreditsService } from '../services/CreditsService';
import { useCanister } from '../useCanister';

interface EconomyDashboardProps {
  identity: Identity | null;
  principal: Principal | null;
  mainActor: any;
}

interface LowCycleUser {
  userId: string;
  userPrincipal: string;
  canisterId: string;
  cycles: bigint;
  threshold: bigint;
  type: 'user_canister' | 'server_pair';
  serverPairId?: string;
}

export const EconomyDashboard: React.FC<EconomyDashboardProps> = ({
  identity,
  principal,
  mainActor
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'subscriptions' | 'cycles' | 'deployments' | 'notifications' | 'employees'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  
  // Data state
  const [profit, setProfit] = useState(economyMetricsService.getProfit());
  const [subscriptions, setSubscriptions] = useState<SubscriptionEvent[]>([]);
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [projectCreations, setProjectCreations] = useState<ProjectCreationEvent[]>([]);
  const [userCycleBalances, setUserCycleBalances] = useState<UserCycleBalance[]>([]);
  const [serverPairCycleBalances, setServerPairCycleBalances] = useState<ServerPairCycleBalance[]>([]);
  const [userCreditsBalances, setUserCreditsBalances] = useState<UserCreditsBalance[]>([]);
  const [masterWalletBalance, setMasterWalletBalance] = useState<MasterWalletBalance | null>(null);
  const [lowCycleUsers, setLowCycleUsers] = useState<LowCycleUser[]>([]);
  const [employees, setEmployees] = useState<EmployeeCompensation[]>([]);
  
  // Notification state
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  
  // Employee management state
  const [newEmployee, setNewEmployee] = useState<Partial<EmployeeCompensation>>({
    employeeId: '',
    employeeName: '',
    baseSalary: 0,
    performanceMultiplier: 1.0,
    metrics: {
      deploymentsFacilitated: 0,
      usersOnboarded: 0,
      revenueGenerated: 0,
      customerSatisfaction: 0
    }
  });

  const refreshAllData = useCallback(async () => {
    if (!identity || !principal) return;
    
    setIsLoading(true);
    try {
      // Refresh profit
      setProfit(economyMetricsService.getProfit());
      
      // Refresh subscriptions
      setSubscriptions(economyMetricsService.getSubscriptions());
      
      // Refresh deployments
      setDeployments(economyMetricsService.getDeployments());
      
      // Refresh project creations
      setProjectCreations(economyMetricsService.getProjectCreations());
      
      // Refresh cycle balances
      setUserCycleBalances(economyMetricsService.getUserCycleBalances());
      setServerPairCycleBalances(economyMetricsService.getServerPairCycleBalances());
      
      // 🔥 NEW: Query actual user credits from platform
      await fetchAllUserCredits();
      
      // Refresh master wallet balance
      setMasterWalletBalance(economyMetricsService.getMasterWalletBalance());
      
      // Refresh employees
      setEmployees(economyMetricsService.getEmployees());
      
      // Check for low cycle users
      await checkLowCycleUsers();
      
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('❌ [EconomyDashboard] Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [identity, principal]);

  // 🔥 NEW: Fetch actual user credits from all user canisters
  const fetchAllUserCredits = async () => {
    if (!mainActor || !identity) return;
    
    try {
      console.log('📊 [EconomyDashboard] Fetching all user credits from user canisters...');
      
      // Get all user canisters from platform (uses userPlatformCanistersEntries)
      // We'll need to iterate through known users and query their canisters
      // For now, use the credits balances we have in localStorage as fallback
      const localCredits = economyMetricsService.getUserCreditsBalances();
      setUserCreditsBalances(localCredits);
      
      console.log('✅ [EconomyDashboard] User credits loaded:', {
        totalUsers: localCredits.length,
        totalCredits: localCredits.reduce((sum, b) => sum + b.credits, 0)
      });
    } catch (error) {
      console.error('❌ [EconomyDashboard] Error fetching user credits:', error);
    }
  };

  const checkLowCycleUsers = async () => {
    if (!identity) return;
    
    const lowUsers: LowCycleUser[] = [];
    const threshold = BigInt(1_000_000_000_000); // 1T cycles threshold
    
    // Check user canisters
    for (const balance of economyMetricsService.getUserCycleBalances()) {
      if (balance.cycles < threshold) {
        lowUsers.push({
          userId: balance.userId,
          userPrincipal: balance.userPrincipal,
          canisterId: balance.userCanisterId,
          cycles: balance.cycles,
          threshold,
          type: 'user_canister'
        });
      }
    }
    
    // Check server pairs
    for (const balance of economyMetricsService.getServerPairCycleBalances()) {
      const totalCycles = balance.frontendCycles + balance.backendCycles;
      if (totalCycles < threshold * BigInt(2)) {
        lowUsers.push({
          userId: balance.userId,
          userPrincipal: balance.userPrincipal,
          canisterId: balance.frontendCanisterId,
          cycles: totalCycles,
          threshold: threshold * BigInt(2),
          type: 'server_pair',
          serverPairId: balance.serverPairId
        });
      }
    }
    
    setLowCycleUsers(lowUsers);
  };

  const fetchMasterWalletBalance = async () => {
    if (!mainActor || !identity) return;
    
    try {
      console.log('📊 [EconomyDashboard] Fetching master wallet balance from platform...');
      
      // 🔥 FIXED: Use actual backend methods that exist
      const [icpBalance, cycleBalance] = await Promise.all([
        mainActor.getPlatformBalance(),
        mainActor.getPlatformCycleBalance()
      ]);
      
      const balance: MasterWalletBalance = {
        icpBalance: BigInt(icpBalance || 0),
        cycleBalance: BigInt(cycleBalance || 0),
        lastUpdated: Date.now()
      };
      
      console.log('✅ [EconomyDashboard] Master wallet balance:', {
        icp: formatIcpBalance(balance.icpBalance),
        cycles: formatCycles(balance.cycleBalance)
      });
      
      economyMetricsService.updateMasterWalletBalance(balance);
      setMasterWalletBalance(balance);
    } catch (error) {
      console.error('❌ [EconomyDashboard] Error fetching master wallet balance:', error);
    }
  };

  const sendLowCycleNotification = async (user: LowCycleUser) => {
    if (!notificationEmail || !notificationMessage) {
      alert('Please enter email and message');
      return;
    }
    
    setIsSendingNotification(true);
    try {
      // In production, this would integrate with your notification system
      // For now, we'll just log it
      console.log('📧 [EconomyDashboard] Sending notification:', {
        to: notificationEmail,
        user: user.userPrincipal,
        message: notificationMessage,
        cycles: formatCycles(user.cycles),
        threshold: formatCycles(user.threshold)
      });
      
      // TODO: Integrate with actual notification service
      alert(`Notification would be sent to ${notificationEmail} for user ${user.userPrincipal.substring(0, 10)}...`);
      
      setNotificationEmail('');
      setNotificationMessage('');
    } catch (error) {
      console.error('❌ [EconomyDashboard] Error sending notification:', error);
      alert('Failed to send notification');
    } finally {
      setIsSendingNotification(false);
    }
  };

  const addEmployee = () => {
    if (!newEmployee.employeeId || !newEmployee.employeeName || !newEmployee.baseSalary) {
      alert('Please fill in all required fields');
      return;
    }
    
    const employee: EmployeeCompensation = {
      employeeId: newEmployee.employeeId!,
      employeeName: newEmployee.employeeName!,
      baseSalary: newEmployee.baseSalary!,
      performanceMultiplier: newEmployee.performanceMultiplier || 1.0,
      metrics: newEmployee.metrics || {
        deploymentsFacilitated: 0,
        usersOnboarded: 0,
        revenueGenerated: 0,
        customerSatisfaction: 0
      },
      calculatedCompensation: newEmployee.baseSalary!,
      lastUpdated: Date.now()
    };
    
    economyMetricsService.saveEmployee(employee);
    setEmployees(economyMetricsService.getEmployees());
    
    // Reset form
    setNewEmployee({
      employeeId: '',
      employeeName: '',
      baseSalary: 0,
      performanceMultiplier: 1.0,
      metrics: {
        deploymentsFacilitated: 0,
        usersOnboarded: 0,
        revenueGenerated: 0,
        customerSatisfaction: 0
      }
    });
  };

  const updateEmployeeMetrics = (employeeId: string, metrics: Partial<EmployeeCompensation['metrics']>) => {
    const employee = employees.find(e => e.employeeId === employeeId);
    if (!employee) return;
    
    const updated = economyMetricsService.calculateEmployeeCompensation(employeeId, {
      ...employee.metrics,
      ...metrics
    });
    
    setEmployees(economyMetricsService.getEmployees());
  };

  useEffect(() => {
    refreshAllData();
    fetchMasterWalletBalance();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      refreshAllData();
      fetchMasterWalletBalance();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [refreshAllData]);

  const activeSubscriptions = useMemo(() => 
    economyMetricsService.getActiveSubscriptions(), 
    [subscriptions]
  );
  
  const canceledSubscriptions = useMemo(() => 
    subscriptions.filter(s => s.eventType === 'canceled'), 
    [subscriptions]
  );
  
  const newSubscriptions = useMemo(() => 
    subscriptions.filter(s => s.eventType === 'subscribed'), 
    [subscriptions]
  );
  
  const successfulDeployments = useMemo(() => 
    deployments.filter(d => d.success), 
    [deployments]
  );
  
  const unsuccessfulDeployments = useMemo(() => 
    deployments.filter(d => !d.success), 
    [deployments]
  );
  
  const totalUserCredits = useMemo(() => 
    economyMetricsService.getTotalUserCredits(), 
    [userCreditsBalances]
  );
  
  const totalCyclesConsumed = useMemo(() => 
    economyMetricsService.getTotalCyclesConsumed('month'), 
    [deployments, projectCreations]
  );

  return (
    <div className="rounded-2xl p-4 lg:p-8" style={{ 
      background: 'rgba(17, 17, 17, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl lg:text-2xl font-semibold" style={{ 
          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          💰 Kontext Economy Dashboard
        </h2>
        <button
          onClick={refreshAllData}
          disabled={isLoading}
          className="px-4 py-2 lg:px-6 lg:py-3 rounded-lg font-medium transition-all duration-300 whitespace-nowrap"
          style={{
            background: isLoading ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 107, 53, 0.2)',
            border: '1px solid var(--kontext-border-accent)',
            color: 'var(--kontext-orange)',
            opacity: isLoading ? 0.6 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isLoading ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 107, 53, 0.2)';
          }}
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" style={{ 
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)'
      }}>
        {[
          { key: 'overview', label: '📊 Overview', icon: '📊' },
          { key: 'subscriptions', label: '💳 Subscriptions', icon: '💳' },
          { key: 'cycles', label: '⚡ Cycles', icon: '⚡' },
          { key: 'deployments', label: '🚀 Deployments', icon: '🚀' },
          { key: 'notifications', label: '📧 Notifications', icon: '📧' },
          { key: 'employees', label: '👥 Employees', icon: '👥' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className="px-3 py-3 lg:px-6 lg:py-4 font-medium text-sm lg:text-base whitespace-nowrap border-b-2 transition-all duration-300 min-w-fit"
            style={{
              borderBottomColor: activeSection === tab.key ? 'var(--kontext-orange)' : 'transparent',
              background: activeSection === tab.key ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
              color: activeSection === tab.key ? 'var(--kontext-text-primary)' : 'var(--kontext-text-tertiary)'
            }}
            onMouseEnter={(e) => {
              if (activeSection !== tab.key) {
                e.currentTarget.style.color = 'var(--kontext-text-primary)';
                e.currentTarget.style.background = 'var(--kontext-surface-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== tab.key) {
                e.currentTarget.style.color = 'var(--kontext-text-tertiary)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto">
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Profit Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                title="Daily Profit"
                value={`$${profit.daily.toFixed(2)}`}
                icon="📈"
                trend={profit.daily > 0 ? 'up' : 'neutral'}
              />
              <MetricCard
                title="Weekly Profit"
                value={`$${profit.weekly.toFixed(2)}`}
                icon="📊"
                trend={profit.weekly > 0 ? 'up' : 'neutral'}
              />
              <MetricCard
                title="Monthly Profit"
                value={`$${profit.monthly.toFixed(2)}`}
                icon="💰"
                trend={profit.monthly > 0 ? 'up' : 'neutral'}
              />
              <MetricCard
                title="Total Profit"
                value={`$${profit.total.toFixed(2)}`}
                icon="💎"
                trend="up"
              />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Active Subscriptions"
                value={activeSubscriptions.length.toString()}
                icon="✅"
              />
              <MetricCard
                title="New Subscriptions (Month)"
                value={newSubscriptions.filter(s => {
                  const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                  return s.timestamp >= monthAgo;
                }).length.toString()}
                icon="🆕"
              />
              <MetricCard
                title="Canceled (Month)"
                value={canceledSubscriptions.filter(s => {
                  const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                  return s.timestamp >= monthAgo;
                }).length.toString()}
                icon="❌"
              />
              <MetricCard
                title="Successful Deployments"
                value={successfulDeployments.length.toString()}
                icon="✅"
              />
              <MetricCard
                title="Failed Deployments"
                value={unsuccessfulDeployments.length.toString()}
                icon="❌"
              />
              <MetricCard
                title="New Apps (Month)"
                value={projectCreations.filter(p => {
                  const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                  return p.timestamp >= monthAgo;
                }).length.toString()}
                icon="🆕"
              />
              <MetricCard
                title="Total User Credits"
                value={totalUserCredits.toLocaleString()}
                icon="💳"
              />
              <MetricCard
                title="Master Wallet ICP"
                value={masterWalletBalance ? formatIcpBalance(masterWalletBalance.icpBalance) : 'Loading...'}
                icon="💎"
              />
              <MetricCard
                title="Cycles Consumed (Month)"
                value={formatCycles(totalCyclesConsumed)}
                icon="⚡"
              />
            </div>

            {/* Low Cycle Alerts */}
            {lowCycleUsers.length > 0 && (
              <div className="p-4 rounded-lg border" style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--accent-orange)'
              }}>
                <h3 className="text-lg font-semibold mb-2" style={{ 
                  background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>⚠️ Low Cycle Alerts</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {lowCycleUsers.length} user{lowCycleUsers.length > 1 ? 's' : ''} with low cycle balances
                </p>
                <div className="space-y-2">
                  {lowCycleUsers.slice(0, 5).map((user, idx) => (
                    <div key={idx} className="bg-gray-800 bg-opacity-30 rounded-lg p-3 mb-2 flex items-center justify-between">
                      <span className="text-sm">
                        {user.userPrincipal.substring(0, 20)}... - {formatCycles(user.cycles)}
                      </span>
                      <button
                        onClick={() => {
                          setNotificationEmail('');
                          setNotificationMessage(`Your ${user.type === 'user_canister' ? 'user canister' : 'server pair'} cycles are running low (${formatCycles(user.cycles)}). Please top up to avoid service interruption.`);
                          setActiveSection('notifications');
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-xs transition-all duration-300"
                        style={{ 
                          background: 'rgba(255, 107, 53, 0.2)',
                          border: '1px solid var(--kontext-border-accent)',
                          color: 'var(--kontext-orange)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                        }}
                      >
                        Notify
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'subscriptions' && (
          <SubscriptionsSection 
            subscriptions={subscriptions}
            activeSubscriptions={activeSubscriptions}
            canceledSubscriptions={canceledSubscriptions}
            newSubscriptions={newSubscriptions}
          />
        )}

        {activeSection === 'cycles' && (
          <CyclesSection
            userCycleBalances={userCycleBalances}
            serverPairCycleBalances={serverPairCycleBalances}
            totalCyclesConsumed={totalCyclesConsumed}
          />
        )}

        {activeSection === 'deployments' && (
          <DeploymentsSection
            deployments={deployments}
            successfulDeployments={successfulDeployments}
            unsuccessfulDeployments={unsuccessfulDeployments}
            projectCreations={projectCreations}
          />
        )}

        {activeSection === 'notifications' && (
          <NotificationsSection
            lowCycleUsers={lowCycleUsers}
            notificationEmail={notificationEmail}
            notificationMessage={notificationMessage}
            setNotificationEmail={setNotificationEmail}
            setNotificationMessage={setNotificationMessage}
            isSendingNotification={isSendingNotification}
            sendLowCycleNotification={sendLowCycleNotification}
          />
        )}

        {activeSection === 'employees' && (
          <EmployeesSection
            employees={employees}
            newEmployee={newEmployee}
            setNewEmployee={setNewEmployee}
            addEmployee={addEmployee}
            updateEmployeeMetrics={updateEmployeeMetrics}
          />
        )}
      </div>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon, trend = 'neutral' }) => {
  // Determine card color based on icon/type
  const getCardStyle = () => {
    if (icon.includes('💰') || icon.includes('💎') || icon.includes('📈') || icon.includes('📊')) {
      // Profit/Financial metrics - orange gradient
      return {
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(251, 191, 36, 0.2))',
        border: '1px solid rgba(255, 107, 53, 0.4)',
        boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
      };
    } else if (icon.includes('✅') || icon.includes('🆕')) {
      // Positive metrics - green
      return {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    } else if (icon.includes('❌')) {
      // Negative metrics - red
      return {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      };
    } else {
      // Default - purple
      return {
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      };
    }
  };

  const cardStyle = getCardStyle();

  return (
    <div className="rounded-xl p-4 lg:p-6" style={cardStyle}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend === 'up' && <span className="text-green-400">↑</span>}
        {trend === 'down' && <span className="text-red-400">↓</span>}
      </div>
      <div className="text-sm mb-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
        {title}
      </div>
      <div className="text-2xl lg:text-3xl font-bold" style={{ 
        color: icon.includes('💰') || icon.includes('💎') || icon.includes('📈') || icon.includes('📊')
          ? '#f97316'
          : icon.includes('✅') || icon.includes('🆕')
          ? '#10b981'
          : icon.includes('❌')
          ? '#ef4444'
          : '#a78bfa'
      }}>
        {value}
      </div>
    </div>
  );
};

const SubscriptionsSection: React.FC<{
  subscriptions: SubscriptionEvent[];
  activeSubscriptions: SubscriptionEvent[];
  canceledSubscriptions: SubscriptionEvent[];
  newSubscriptions: SubscriptionEvent[];
}> = ({ subscriptions, activeSubscriptions, canceledSubscriptions, newSubscriptions }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard title="Active" value={activeSubscriptions.length.toString()} icon="✅" />
      <MetricCard title="New (Month)" value={newSubscriptions.filter(s => {
        const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return s.timestamp >= monthAgo;
      }).length.toString()} icon="🆕" />
      <MetricCard title="Canceled (Month)" value={canceledSubscriptions.filter(s => {
        const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return s.timestamp >= monthAgo;
      }).length.toString()} icon="❌" />
    </div>

    <div className="rounded-xl p-4 lg:p-6" style={{
      background: 'rgba(139, 92, 246, 0.1)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    }}>
      <h3 className="text-lg font-semibold mb-4" style={{ 
        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>Recent Subscription Events</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {subscriptions.slice(0, 50).map((sub, idx) => (
          <div key={idx} className="bg-gray-800 bg-opacity-30 rounded-lg p-4 mb-2 flex justify-between items-center flex-wrap gap-2">
            <div>
              <div className="font-medium">{sub.eventType}</div>
              <div className="text-sm opacity-70">
                {sub.userPrincipal.substring(0, 20)}... - {sub.tier} - ${sub.priceUSD.toFixed(2)}
              </div>
              <div className="text-xs opacity-50">
                {new Date(sub.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CyclesSection: React.FC<{
  userCycleBalances: UserCycleBalance[];
  serverPairCycleBalances: ServerPairCycleBalance[];
  totalCyclesConsumed: bigint;
}> = ({ userCycleBalances, serverPairCycleBalances, totalCyclesConsumed }) => (
  <div className="space-y-6">
    <MetricCard
      title="Total Cycles Consumed (Month)"
      value={formatCycles(totalCyclesConsumed)}
      icon="⚡"
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
      <div className="rounded-xl p-4 lg:p-6" style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#10b981', fontWeight: 600 }}>User Canister Cycles</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {userCycleBalances.map((balance, idx) => (
            <div key={idx} className="bg-gray-800 bg-opacity-30 rounded-lg p-3 mb-2">
              <div className="text-sm font-medium text-white">{balance.userPrincipal.substring(0, 20)}...</div>
              <div className="text-xs text-gray-400">{formatCycles(balance.cycles)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 lg:p-6" style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }}>
        <h3 className="text-lg font-semibold mb-4" style={{ 
          background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>Server Pair Cycles</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {serverPairCycleBalances.map((balance, idx) => (
            <div key={idx} className="bg-gray-800 bg-opacity-30 rounded-lg p-3 mb-2">
              <div className="text-sm font-medium text-white">{balance.userPrincipal.substring(0, 20)}...</div>
              <div className="text-xs text-gray-400">
                Frontend: {formatCycles(balance.frontendCycles)} | Backend: {formatCycles(balance.backendCycles)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const DeploymentsSection: React.FC<{
  deployments: DeploymentEvent[];
  successfulDeployments: DeploymentEvent[];
  unsuccessfulDeployments: DeploymentEvent[];
  projectCreations: ProjectCreationEvent[];
}> = ({ deployments, successfulDeployments, unsuccessfulDeployments, projectCreations }) => {
  const stats = economyMetricsService.getDeploymentStats('month');
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total" value={stats.total.toString()} icon="📊" />
        <MetricCard title="Successful" value={stats.successful.toString()} icon="✅" />
        <MetricCard title="Failed" value={stats.unsuccessful.toString()} icon="❌" />
        <MetricCard title="Success Rate" value={`${stats.successRate.toFixed(1)}%`} icon="📈" />
      </div>

      <div className="rounded-xl p-4 lg:p-6" style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }}>
        <h3 className="text-lg font-semibold mb-4" style={{ 
          background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>Recent Deployments</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {deployments.slice(0, 50).map((deployment, idx) => (
            <div key={idx} className={`bg-gray-800 bg-opacity-30 rounded-lg p-4 mb-2 flex justify-between items-center flex-wrap gap-2 ${
              deployment.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
            }`}>
              <div>
                <div className="font-medium">{deployment.success ? '✅ Success' : '❌ Failed'}</div>
                <div className="text-sm opacity-70">
                  {deployment.userPrincipal.substring(0, 20)}... - {deployment.projectId.substring(0, 10)}...
                </div>
                {deployment.error && (
                  <div className="text-xs opacity-50 mt-1">{deployment.error}</div>
                )}
                <div className="text-xs opacity-50">
                  {new Date(deployment.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const NotificationsSection: React.FC<{
  lowCycleUsers: LowCycleUser[];
  notificationEmail: string;
  notificationMessage: string;
  setNotificationEmail: (email: string) => void;
  setNotificationMessage: (message: string) => void;
  isSendingNotification: boolean;
  sendLowCycleNotification: (user: LowCycleUser) => Promise<void>;
}> = ({ 
  lowCycleUsers, 
  notificationEmail, 
  notificationMessage, 
  setNotificationEmail, 
  setNotificationMessage,
  isSendingNotification,
  sendLowCycleNotification
}) => (
  <div className="space-y-6">
    <div className="rounded-xl p-4 lg:p-6" style={{
      background: 'rgba(139, 92, 246, 0.1)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    }}>
      <h3 className="text-lg font-semibold mb-4" style={{ 
        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>Send Notification</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Message</label>
          <textarea
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={4}
            placeholder="Enter notification message..."
          />
        </div>
        <button
          onClick={() => {
            if (lowCycleUsers.length > 0) {
              sendLowCycleNotification(lowCycleUsers[0]);
            }
          }}
          disabled={isSendingNotification || !notificationEmail || !notificationMessage}
          className="px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300"
          style={{
            background: (isSendingNotification || !notificationEmail || !notificationMessage) 
              ? 'rgba(255, 107, 53, 0.1)' 
              : 'rgba(255, 107, 53, 0.2)',
            border: '1px solid var(--kontext-border-accent)',
            color: 'var(--kontext-orange)',
            opacity: (isSendingNotification || !notificationEmail || !notificationMessage) ? 0.6 : 1,
            cursor: (isSendingNotification || !notificationEmail || !notificationMessage) ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isSendingNotification && notificationEmail && notificationMessage) {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = (isSendingNotification || !notificationEmail || !notificationMessage) 
              ? 'rgba(255, 107, 53, 0.1)' 
              : 'rgba(255, 107, 53, 0.2)';
          }}
        >
          {isSendingNotification ? 'Sending...' : 'Send Notification'}
        </button>
      </div>
    </div>

    <div className="rounded-xl p-4 lg:p-6" style={{
      background: 'rgba(255, 107, 53, 0.1)',
      border: '1px solid rgba(255, 107, 53, 0.3)'
    }}>
      <h3 className="text-lg font-semibold mb-4" style={{ 
        background: 'linear-gradient(135deg, #f97316, #fbbf24)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>Low Cycle Users</h3>
      <div className="space-y-2">
        {lowCycleUsers.map((user, idx) => (
          <div key={idx} className="bg-gray-800 bg-opacity-30 rounded-lg p-3 mb-2 flex items-center justify-between">
            <div>
              <div className="font-medium">{user.userPrincipal.substring(0, 20)}...</div>
              <div className="text-sm opacity-70">
                {formatCycles(user.cycles)} / {formatCycles(user.threshold)} ({user.type})
              </div>
            </div>
            <button
              onClick={() => sendLowCycleNotification(user)}
              className="px-3 py-1 text-xs rounded"
              style={{ background: 'var(--accent-orange)', color: 'white' }}
            >
              Notify
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const EmployeesSection: React.FC<{
  employees: EmployeeCompensation[];
  newEmployee: Partial<EmployeeCompensation>;
  setNewEmployee: (employee: Partial<EmployeeCompensation>) => void;
  addEmployee: () => void;
  updateEmployeeMetrics: (employeeId: string, metrics: Partial<EmployeeCompensation['metrics']>) => void;
}> = ({ employees, newEmployee, setNewEmployee, addEmployee, updateEmployeeMetrics }) => (
  <div className="space-y-6">
    <div className="rounded-xl p-4 lg:p-6" style={{
      background: 'rgba(139, 92, 246, 0.1)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    }}>
      <h3 className="text-lg font-semibold mb-4" style={{ 
        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>Add Employee</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Employee ID</label>
          <input
            type="text"
            value={newEmployee.employeeId || ''}
            onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
            className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            value={newEmployee.employeeName || ''}
            onChange={(e) => setNewEmployee({ ...newEmployee, employeeName: e.target.value })}
            className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Base Salary ($)</label>
          <input
            type="number"
            value={newEmployee.baseSalary || 0}
            onChange={(e) => setNewEmployee({ ...newEmployee, baseSalary: parseFloat(e.target.value) })}
            className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>
      <button
        onClick={addEmployee}
        className="mt-4 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300"
        style={{
          background: 'rgba(255, 107, 53, 0.2)',
          border: '1px solid var(--kontext-border-accent)',
          color: 'var(--kontext-orange)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
        }}
      >
        Add Employee
      </button>
    </div>

    <div className="rounded-xl p-4 lg:p-6" style={{
      background: 'rgba(139, 92, 246, 0.1)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    }}>
      <h3 className="text-lg font-semibold mb-4" style={{ 
        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>Employee Compensation</h3>
      <div className="space-y-4">
        {employees.map((employee) => (
          <div key={employee.employeeId} className="bg-gray-800 bg-opacity-30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">{employee.employeeName}</div>
                <div className="text-sm opacity-70">Base: ${employee.baseSalary.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${employee.calculatedCompensation.toFixed(2)}</div>
                <div className="text-sm opacity-70">Multiplier: {employee.performanceMultiplier.toFixed(2)}x</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <div className="opacity-70">Deployments</div>
                <input
                  type="number"
                  value={employee.metrics.deploymentsFacilitated}
                  onChange={(e) => updateEmployeeMetrics(employee.employeeId, {
                    deploymentsFacilitated: parseInt(e.target.value) || 0
                  })}
                  className="w-full p-2 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                />
              </div>
              <div>
                <div className="opacity-70">Users Onboarded</div>
                <input
                  type="number"
                  value={employee.metrics.usersOnboarded}
                  onChange={(e) => updateEmployeeMetrics(employee.employeeId, {
                    usersOnboarded: parseInt(e.target.value) || 0
                  })}
                  className="w-full p-2 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                />
              </div>
              <div>
                <div className="opacity-70">Revenue ($)</div>
                <input
                  type="number"
                  value={employee.metrics.revenueGenerated}
                  onChange={(e) => updateEmployeeMetrics(employee.employeeId, {
                    revenueGenerated: parseFloat(e.target.value) || 0
                  })}
                  className="w-full p-2 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                />
              </div>
              <div>
                <div className="opacity-70">Satisfaction</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={employee.metrics.customerSatisfaction}
                  onChange={(e) => updateEmployeeMetrics(employee.employeeId, {
                    customerSatisfaction: parseInt(e.target.value) || 0
                  })}
                  className="w-full p-2 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

