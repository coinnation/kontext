import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  Users, 
  UserPlus,
  Shield,
  Trash2,
  Plus,
  AlertCircle,
  CreditCard, 
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { platformCanisterService } from '../services/PlatformCanisterService';

interface AITokenReserve {
  totalCreditsRemaining: bigint;
  claudeInputCostPerMillion: number;
  claudeOutputCostPerMillion: number;
  avgTokensPerCredit: number;
  maxPotentialAICostUSD: number;
  requiredClaudeBalance: number;
  currentClaudeBalance: number;
  shortfallUSD: number;
  reserveRatio: number;
  daysOfReserve: bigint;
  lastCalculated: bigint;
}

interface ICPReserve {
  totalCreditsRemaining: bigint;
  xdrRate: {
    usdPerXDR: number;
    icpPerXDR: number;
    lastUpdated: bigint;
  };
  cyclesPerTrillion: bigint;
  maxPotentialCyclesNeeded: bigint;
  maxPotentialXDRNeeded: number;
  maxPotentialICPNeeded: number;
  maxPotentialUSDNeeded: number;
  currentICPBalance: number;
  currentUSDValue: number;
  reserveRatio: number;
  shortfallICP: number;
  shortfallUSD: number;
  daysOfReserve: bigint;
  lastCalculated: bigint;
}

interface DomainStatistics {
  totalDomainsPurchased: bigint;
  domainsByType: any[];
  totalCostCents: bigint;
  avgCostPerDomainCents: bigint;
  purchasesThisMonth: bigint;
  avgPurchasesPerMonth: number;
  forecastedMonthlyCostCents: bigint;
  requiredNameSiloBalanceUSD: number;
  renewalsNext30Days: bigint;
  renewalCostNext30DaysCents: bigint;
}

interface TeamMember {
  id: bigint;
  name: string;
  role: string;
  revenueSharePercent: number;
  subscriptionShare: boolean;
  creditCommissionShare: boolean;
  marketplaceShare: boolean;
  active: boolean;
  addedAt: bigint;
}

interface TeamEarningsReport {
  totalPlatformRevenue: bigint;
  totalTeamPayouts: bigint;
  platformRetainedRevenue: bigint;
  memberEarnings: Array<{
    memberId: bigint;
    memberName: string;
    revenueSharePercent: number;
    subscriptionEarnings: bigint;
    creditCommissionEarnings: bigint;
    marketplaceEarnings: bigint;
    totalEarnings: bigint;
    earningsThisMonth: bigint;
    earningsLastMonth: bigint;
    earningsAllTime: bigint;
    calculatedAt: bigint;
  }>;
  generatedAt: bigint;
}

const FinancialAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for each analytics category
  const [aiReserve, setAiReserve] = useState<AITokenReserve | null>(null);
  const [icpReserve, setIcpReserve] = useState<ICPReserve | null>(null);
  const [domainStats, setDomainStats] = useState<DomainStatistics | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamEarnings, setTeamEarnings] = useState<TeamEarningsReport | null>(null);
  
  // New team member form
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    revenueSharePercent: 10,
    subscriptionShare: true,
    creditCommissionShare: false,
    marketplaceShare: false
  });


  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadAIReserve(),
        loadICPReserve(),
        loadDomainStats(),
        loadTeamMembers(),
        loadTeamEarnings()
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadAIReserve = async () => {
    try {
      const result = await platformCanisterService.calculateAITokenReserve();
      setAiReserve(result);
    } catch (err: any) {
      console.error('Failed to load AI reserve:', err);
    }
  };

  const loadICPReserve = async () => {
    try {
      const result = await platformCanisterService.calculateICPReserve();
      setIcpReserve(result);
    } catch (err: any) {
      console.error('Failed to load ICP reserve:', err);
    }
  };

  const loadDomainStats = async () => {
    try {
      const result = await platformCanisterService.getDomainStatistics();
      setDomainStats(result);
    } catch (err: any) {
      console.error('Failed to load domain stats:', err);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const result = await platformCanisterService.getTeamMembers();
      setTeamMembers(result);
    } catch (err: any) {
      console.error('Failed to load team members:', err);
    }
  };

  const loadTeamEarnings = async () => {
    try {
      const result = await platformCanisterService.calculateTeamEarnings();
      setTeamEarnings(result);
    } catch (err: any) {
      console.error('Failed to load team earnings:', err);
    }
  };

  const addTeamMember = async () => {
    try {
      setLoading(true);
      await platformCanisterService.addTeamMember(
        newMember.name,
        newMember.role,
        newMember.revenueSharePercent,
        newMember.subscriptionShare,
        newMember.creditCommissionShare,
        newMember.marketplaceShare
      );
      
      setShowAddTeamMember(false);
      setNewMember({
        name: '',
        role: '',
        revenueSharePercent: 10,
        subscriptionShare: true,
        creditCommissionShare: false,
        marketplaceShare: false
      });
      
      await loadTeamMembers();
      await loadTeamEarnings();
    } catch (err: any) {
      setError(err.message || 'Failed to add team member');
    } finally {
      setLoading(false);
    }
  };


  const exportReport = () => {
    try {
      const timestamp = new Date().toISOString();
      const reportData = {
        timestamp,
        aiReserve,
        icpReserve,
        domainStats,
        teamMembers,
        teamEarnings,
        admins
      };

      // Create downloadable JSON file
      const dataStr = JSON.stringify(reportData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `kontext-financial-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ [FinancialAnalytics] Report exported successfully');
    } catch (error) {
      console.error('❌ [FinancialAnalytics] Failed to export report:', error);
      setError('Failed to export report. Please try again.');
    }
  };

  const formatUSD = (cents: number | bigint): string => {
    const amount = typeof cents === 'bigint' ? Number(cents) : cents;
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatNumber = (num: number | bigint): string => {
    return typeof num === 'bigint' ? num.toLocaleString() : num.toLocaleString();
  };

  const getStatusBadge = (ratio: number, daysLeft: number) => {
    if (ratio >= 3.0 && daysLeft >= 90) {
      return <Badge className="bg-green-500">✅ HEALTHY</Badge>;
    } else if (ratio >= 1.5 && daysLeft >= 45) {
      return <Badge className="bg-yellow-500">⚠️ WARNING</Badge>;
    } else {
      return <Badge className="bg-red-500">🚨 CRITICAL</Badge>;
    }
  };

  return (
    <div className="rounded-2xl p-4 lg:p-8" style={{ 
      background: 'rgba(17, 17, 17, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold" style={{ 
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            💰 Financial Analytics Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Treasury management, reserves, and revenue tracking
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center gap-2"
            style={{
              background: loading ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 107, 53, 0.2)',
              color: 'var(--kontext-orange)',
              border: '1px solid var(--kontext-orange)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
              }
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={exportReport}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center gap-2"
            style={{
              background: 'rgba(255, 107, 53, 0.2)',
              color: 'var(--kontext-orange)',
              border: '1px solid var(--kontext-orange)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
            }}
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="w-full">
        <div className="flex gap-2 flex-wrap mb-6 p-2 rounded-lg" style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'reserves', label: 'Reserves' },
            { key: 'domains', label: 'Domains' },
            { key: 'team', label: 'Team' },
            { key: 'revenue', label: 'Revenue' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300"
              style={{
                background: activeTab === tab.key ? 'var(--kontext-orange)' : 'transparent',
                color: activeTab === tab.key ? 'white' : 'var(--kontext-text-secondary)',
                border: activeTab === tab.key ? '1px solid var(--kontext-orange)' : '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* AI Reserve Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-500" />
                  AI Reserve (Claude)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {aiReserve ? `$${aiReserve.currentClaudeBalance.toFixed(2)}` : '—'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Required: ${aiReserve?.requiredClaudeBalance.toFixed(2) || '—'}
                </p>
                {aiReserve && (
                  <div className="mt-2">
                    {getStatusBadge(aiReserve.reserveRatio, Number(aiReserve.daysOfReserve))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ICP Reserve Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  ICP Reserve
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {icpReserve ? `${icpReserve.currentICPBalance.toFixed(2)} ICP` : '—'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Required: {icpReserve?.maxPotentialICPNeeded.toFixed(2) || '—'} ICP
                </p>
                {icpReserve && (
                  <div className="mt-2">
                    {getStatusBadge(icpReserve.reserveRatio, Number(icpReserve.daysOfReserve))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Domain Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-500" />
                  Domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {domainStats ? formatNumber(domainStats.totalDomainsPurchased) : '—'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This month: {domainStats ? formatNumber(domainStats.purchasesThisMonth) : '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  NameSilo: ${domainStats?.requiredNameSiloBalanceUSD.toFixed(2) || '—'}
                </p>
              </CardContent>
            </Card>

            {/* Team Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  Team Payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teamEarnings ? formatUSD(teamEarnings.totalTeamPayouts) : '—'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Platform keeps: {teamEarnings ? formatUSD(teamEarnings.platformRetainedRevenue) : '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {teamMembers.filter(m => m.active).length} active members
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common financial management tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex flex-col">
                <DollarSign className="w-6 h-6 mb-2" />
                Update Balances
              </Button>
              <Button variant="outline" className="h-20 flex flex-col">
                <Users className="w-6 h-6 mb-2" />
                Manage Team
              </Button>
              <Button variant="outline" className="h-20 flex flex-col">
                <Download className="w-6 h-6 mb-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>
        )}

        {/* RESERVES TAB */}
        {activeTab === 'reserves' && (
        <div className="space-y-4">
          {/* AI Reserve Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-500" />
                AI Token Reserve (Claude API)
              </CardTitle>
              <CardDescription>
                How much funding needed in Claude API account to cover all user credits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiReserve ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Credits Outstanding</div>
                      <div className="text-2xl font-bold">{formatNumber(aiReserve.totalCreditsRemaining)}</div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Max Potential Cost</div>
                      <div className="text-2xl font-bold text-red-600">${aiReserve.maxPotentialAICostUSD.toFixed(2)}</div>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Current Balance</div>
                      <div className="text-2xl font-bold text-green-600">${aiReserve.currentClaudeBalance.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reserve Status</div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{aiReserve.reserveRatio.toFixed(2)}x Coverage</span>
                        {getStatusBadge(aiReserve.reserveRatio, Number(aiReserve.daysOfReserve))}
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        ~{formatNumber(aiReserve.daysOfReserve)} days of reserve
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Shortfall</div>
                      <div className="text-lg font-semibold">
                        {aiReserve.shortfallUSD < 0 
                          ? <span className="text-green-600">Surplus: ${Math.abs(aiReserve.shortfallUSD).toFixed(2)}</span>
                          : <span className="text-red-600">Need: ${aiReserve.shortfallUSD.toFixed(2)}</span>
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Pricing: ${aiReserve.claudeInputCostPerMillion}/1M input tokens, ${aiReserve.claudeOutputCostPerMillion}/1M output tokens
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              )}
            </CardContent>
          </Card>

          {/* ICP Reserve Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
                ICP Reserve (Platform Wallet)
              </CardTitle>
              <CardDescription>
                How much ICP needed in platform wallet to cover all user credits for cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {icpReserve ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Max ICP Needed</div>
                      <div className="text-xl font-bold text-red-600">{icpReserve.maxPotentialICPNeeded.toFixed(2)}</div>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Current Balance</div>
                      <div className="text-xl font-bold text-green-600">{icpReserve.currentICPBalance.toFixed(2)}</div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">USD Value</div>
                      <div className="text-xl font-bold">${icpReserve.currentUSDValue.toFixed(2)}</div>
                    </div>
                    
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Shortfall</div>
                      <div className="text-xl font-bold text-red-600">{icpReserve.shortfallICP.toFixed(2)} ICP</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reserve Status</div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{icpReserve.reserveRatio.toFixed(2)}x Coverage</span>
                        {getStatusBadge(icpReserve.reserveRatio, Number(icpReserve.daysOfReserve))}
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        ~{formatNumber(icpReserve.daysOfReserve)} days of reserve
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Exchange Rates</div>
                      <div className="text-sm space-y-1">
                        <div>1 XDR = ${icpReserve.xdrRate.usdPerXDR.toFixed(2)} USD</div>
                        <div>1 XDR = {icpReserve.xdrRate.icpPerXDR.toFixed(4)} ICP</div>
                        <div>1 ICP = ${(icpReserve.xdrRate.usdPerXDR / icpReserve.xdrRate.icpPerXDR).toFixed(2)} USD</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* DOMAINS TAB */}
        {activeTab === 'domains' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-500" />
                Domain Purchase Analytics
              </CardTitle>
              <CardDescription>
                Track domain purchases and forecast NameSilo funding needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {domainStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Domains</div>
                      <div className="text-2xl font-bold">{formatNumber(domainStats.totalDomainsPurchased)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Avg cost: {formatUSD(domainStats.avgCostPerDomainCents)}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">This Month</div>
                      <div className="text-2xl font-bold">{formatNumber(domainStats.purchasesThisMonth)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Avg: {domainStats.avgPurchasesPerMonth.toFixed(1)}/month
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Forecasted Monthly</div>
                      <div className="text-2xl font-bold">{formatUSD(domainStats.forecastedMonthlyCostCents)}</div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">💰 Required NameSilo Balance</h3>
                        <p className="text-3xl font-bold text-green-600">
                          ${domainStats.requiredNameSiloBalanceUSD.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Covers 3 months of forecasted purchases
                        </p>
                      </div>
                      <CheckCircle className="w-16 h-16 text-green-500 opacity-50" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Renewals Next 30 Days</div>
                      <div className="text-2xl font-bold">{formatNumber(domainStats.renewalsNext30Days)} domains</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Cost: {formatUSD(domainStats.renewalCostNext30DaysCents)}
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Spent</div>
                      <div className="text-2xl font-bold">{formatUSD(domainStats.totalCostCents)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    Team Management
                  </CardTitle>
                  <CardDescription>
                    Manage team members and their revenue share
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddTeamMember(true)}>
                  + Add Team Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Team Members Table */}
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id.toString()} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{member.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{member.role}</p>
                        <div className="flex gap-2 mt-2">
                          {member.subscriptionShare && (
                            <Badge variant="outline">💳 Subscriptions</Badge>
                          )}
                          {member.creditCommissionShare && (
                            <Badge variant="outline">⚡ Credits</Badge>
                          )}
                          {member.marketplaceShare && (
                            <Badge variant="outline">🛒 Marketplace</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {member.revenueSharePercent}%
                        </div>
                        <div className="text-sm text-gray-500">revenue share</div>
                        {member.active ? (
                          <Badge className="mt-2 bg-green-500">Active</Badge>
                        ) : (
                          <Badge className="mt-2 bg-gray-500">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Team Member Form */}
              {showAddTeamMember && (
                <div className="mt-6 p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-800">
                  <h3 className="font-semibold mb-4">Add New Team Member</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={newMember.name}
                        onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Alice Johnson"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Role</label>
                      <input
                        type="text"
                        value={newMember.role}
                        onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Developer"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Revenue Share %</label>
                      <input
                        type="number"
                        value={newMember.revenueSharePercent}
                        onChange={(e) => setNewMember({ ...newMember, revenueSharePercent: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newMember.subscriptionShare}
                          onChange={(e) => setNewMember({ ...newMember, subscriptionShare: e.target.checked })}
                        />
                        <span className="text-sm">Share subscription revenue</span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newMember.creditCommissionShare}
                          onChange={(e) => setNewMember({ ...newMember, creditCommissionShare: e.target.checked })}
                        />
                        <span className="text-sm">Share credit commission (20%)</span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newMember.marketplaceShare}
                          onChange={(e) => setNewMember({ ...newMember, marketplaceShare: e.target.checked })}
                        />
                        <span className="text-sm">Share marketplace revenue</span>
                      </label>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button onClick={addTeamMember} disabled={loading}>
                        Add Member
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddTeamMember(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Earnings */}
          {teamEarnings && (
            <Card>
              <CardHeader>
                <CardTitle>💰 Team Earnings (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
                      <div className="text-2xl font-bold">{formatUSD(teamEarnings.totalPlatformRevenue)}</div>
                    </div>
                    
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Team Payouts</div>
                      <div className="text-2xl font-bold text-orange-600">{formatUSD(teamEarnings.totalTeamPayouts)}</div>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Platform Keeps</div>
                      <div className="text-2xl font-bold text-green-600">{formatUSD(teamEarnings.platformRetainedRevenue)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {teamEarnings.memberEarnings.map((earning) => (
                      <div key={earning.memberId.toString()} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{earning.memberName}</h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                              <div>Subscriptions: {formatUSD(earning.subscriptionEarnings)}</div>
                              <div>Credit Commission: {formatUSD(earning.creditCommissionEarnings)}</div>
                              <div>Marketplace: {formatUSD(earning.marketplaceEarnings)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              {formatUSD(earning.totalEarnings)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {earning.revenueSharePercent}% share
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* REVENUE TAB */}
        {activeTab === 'revenue' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Revenue Attribution
              </CardTitle>
              <CardDescription>
                Track revenue sources and 20% commission on credit consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamEarnings ? (
                <div className="space-y-4">
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border-2">
                    <h3 className="text-lg font-semibold mb-4">Revenue Breakdown (Last 30 Days)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {formatUSD(teamEarnings.totalPlatformRevenue)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          💳 Subscriptions
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          $—
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          ⚡ Credit Commission (20%)
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">
                          $—
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          🛒 Marketplace (7%)
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>20% Commission Model:</strong> When users consume credits for AI usage, 
                      a 20% commission is automatically added. For example, if base cost is 100 credits, 
                      user is charged 120 credits (100 base + 20 commission).
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

      </div>
    </div>
  );
};

export default FinancialAnalyticsDashboard;

