import React, { useState, useEffect } from 'react';
import { SubscriptionPlan, SubscriptionPlanInput, PlanFeature, SubscriptionTier } from '../types';
import { PlatformCanisterService } from '../services/PlatformCanisterService';
import { getSharedAuthClient } from '../services/SharedAuthClient';

const SubscriptionPlanManager: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<SubscriptionPlanInput | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState<string>('');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);

      const result = await service.getAllSubscriptionPlans();
      if ('ok' in result) {
        // Sort plans by order
        const sortedPlans = result.ok.sort((a, b) => a.order - b.order);
        setPlans(sortedPlans);
      } else {
        setError(result.err);
      }
    } catch (err) {
      console.error('❌ Failed to load subscription plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      tier: plan.tier,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      originalPrice: plan.originalPrice,
      discountPercentage: plan.discountPercentage,
      monthlyCredits: plan.monthlyCredits,
      hostingCredits: plan.hostingCredits,
      maxProjects: plan.maxProjects,
      features: [...plan.features],
      badges: [...plan.badges],
      ctaText: plan.ctaText,
      isActive: plan.isActive,
      order: plan.order,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId,
    });
    setIsEditing(true);
  };

  const handleSavePlan = async () => {
    if (!editForm) return;

    try {
      setLoading(true);
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);

      const result = await service.upsertSubscriptionPlan(editForm);
      if ('ok' in result) {
        await loadPlans();
        setIsEditing(false);
        setEditForm(null);
        setSelectedPlan(null);
      } else {
        setError(result.err);
      }
    } catch (err) {
      console.error('❌ Failed to save subscription plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (tier: SubscriptionTier) => {
    if (!confirm(`Are you sure you want to delete the ${tier} plan?`)) return;

    try {
      setLoading(true);
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);

      const result = await service.deleteSubscriptionPlan(tier);
      if ('ok' in result) {
        await loadPlans();
      } else {
        setError(result.err);
      }
    } catch (err) {
      console.error('❌ Failed to delete subscription plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaultPlans = async () => {
    if (!confirm('Initialize default subscription plans? This will not overwrite existing plans.')) return;

    try {
      setLoading(true);
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);

      const result = await service.initializeDefaultSubscriptionPlans();
      if ('ok' in result) {
        await loadPlans();
      } else {
        setError(result.err);
      }
    } catch (err) {
      console.error('❌ Failed to initialize default plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize plans');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrompt = async () => {
    try {
      setLoading(true);
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);

      const result = await service.getSubscriptionPrompt();
      if ('ok' in result) {
        setPromptText(result.ok);
        setShowPrompt(true);
      } else {
        setError(result.err);
      }
    } catch (err) {
      console.error('❌ Failed to generate subscription prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeature = () => {
    if (!editForm) return;
    const newFeature: PlanFeature = {
      description: '',
      enabled: true,
      order: editForm.features.length,
    };
    setEditForm({
      ...editForm,
      features: [...editForm.features, newFeature],
    });
  };

  const handleUpdateFeature = (index: number, field: keyof PlanFeature, value: any) => {
    if (!editForm) return;
    const updatedFeatures = [...editForm.features];
    updatedFeatures[index] = {
      ...updatedFeatures[index],
      [field]: value,
    };
    setEditForm({
      ...editForm,
      features: updatedFeatures,
    });
  };

  const handleRemoveFeature = (index: number) => {
    if (!editForm) return;
    const updatedFeatures = editForm.features.filter((_, i) => i !== index);
    setEditForm({
      ...editForm,
      features: updatedFeatures,
    });
  };

  const handleAddBadge = () => {
    if (!editForm) return;
    const badgeText = prompt('Enter badge text:');
    if (badgeText) {
      setEditForm({
        ...editForm,
        badges: [...editForm.badges, badgeText],
      });
    }
  };

  const handleRemoveBadge = (index: number) => {
    if (!editForm) return;
    const updatedBadges = editForm.badges.filter((_, i) => i !== index);
    setEditForm({
      ...editForm,
      badges: updatedBadges,
    });
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <p className="text-sm lg:text-base text-gray-400">
          Manage pricing, features, and plan details
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleGeneratePrompt}
            className="px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm"
            style={{
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: '#a78bfa'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            }}
          >
            🤖 AI Prompt
          </button>
          <button
            onClick={handleInitializeDefaultPlans}
            className="px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm"
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
            }}
          >
            ⚙️ Init Defaults
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <p className="text-red-400">❌ {error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Plan Grid - Matching SubscriptionSelectionInterface */}
      {!isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {plans.map((plan) => {
            const isPopular = plan.badges.includes('Most Popular');
            
            return (
              <div
                key={plan.tier}
                className={`
                  bg-gray-800 bg-opacity-50 border rounded-xl p-6 lg:p-8
                  ${isPopular ? 'border-orange-500 border-opacity-50 ring-2 ring-gray-600 ring-opacity-50' : 'border-gray-600 border-opacity-50'}
                `}
              >
              {/* Badges */}
              {isPopular && (
                <div className="text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3" style={{ background: 'rgba(255, 107, 53, 0.2)', color: 'var(--kontext-orange)' }}>
                  Most Popular
                </div>
              )}
              
              {plan.badges.filter(b => b !== 'Most Popular').map((badge, idx) => (
                <div key={idx} className="bg-green-500 bg-opacity-20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3 mr-2">
                  {badge}
                </div>
              ))}
              
              {!plan.isActive && (
                <div className="bg-red-500 bg-opacity-20 text-red-400 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3">
                  Inactive
                </div>
              )}
              
              <h4 className="text-xl lg:text-2xl font-bold text-white mb-2">{plan.name}</h4>
              {plan.description && (
                <p className="text-sm lg:text-base text-gray-400 mb-3">{plan.description}</p>
              )}
              
              {/* Pricing */}
              <div className="mb-4">
                {plan.originalPrice && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base lg:text-lg text-gray-500 line-through">${(plan.originalPrice / 100).toFixed(2)}</span>
                    {plan.discountPercentage && plan.discountPercentage > 0 && (
                      <span className="bg-green-500 bg-opacity-20 text-green-400 text-xs font-semibold px-2 py-1 rounded">
                        {plan.discountPercentage}% OFF
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl lg:text-4xl font-bold text-white">${(plan.monthlyPrice / 100).toFixed(2)}</span>
                  <span className="text-base lg:text-lg text-gray-400">/month</span>
                </div>
              </div>
              
              <div className="text-sm lg:text-base text-gray-300 mb-4">
                {plan.monthlyCredits.toLocaleString()} credits/month
                {plan.hostingCredits > 0 && (
                  <span className="text-gray-400"> + {plan.hostingCredits.toLocaleString()} hosting</span>
                )}
              </div>

              <ul className="text-xs lg:text-sm text-gray-400 mb-6 space-y-2">
                {plan.features.filter(f => f.enabled).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>{feature.description}</span>
                  </li>
                ))}
              </ul>

              {/* Admin Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPlan(plan)}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-300"
                  style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    color: '#60a5fa'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  }}
                >
                  ✏️ Edit
                </button>
                {plan.tier !== SubscriptionTier.FREE && (
                  <button
                    onClick={() => handleDeletePlan(plan.tier)}
                    className="px-4 py-3 rounded-lg font-semibold transition-all duration-300"
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && editForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Edit {editForm.name} Plan
          </h2>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={editForm.ctaText}
                  onChange={(e) => setEditForm({ ...editForm, ctaText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monthly Price (cents)
                </label>
                <input
                  type="number"
                  value={editForm.monthlyPrice}
                  onChange={(e) => setEditForm({ ...editForm, monthlyPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Display: ${(editForm.monthlyPrice / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Original Price (cents)
                </label>
                <input
                  type="number"
                  value={editForm.originalPrice || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      originalPrice: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Leave empty for no strike-through"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Discount %
                </label>
                <input
                  type="number"
                  value={editForm.discountPercentage || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      discountPercentage: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="e.g., 37"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Credits & Limits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monthly Credits
                </label>
                <input
                  type="number"
                  value={editForm.monthlyCredits}
                  onChange={(e) => setEditForm({ ...editForm, monthlyCredits: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hosting Credits
                </label>
                <input
                  type="number"
                  value={editForm.hostingCredits}
                  onChange={(e) => setEditForm({ ...editForm, hostingCredits: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Projects
                </label>
                <input
                  type="number"
                  value={editForm.maxProjects || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      maxProjects: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Stripe Integration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stripe Product ID
                </label>
                <input
                  type="text"
                  value={editForm.stripeProductId || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      stripeProductId: e.target.value || null,
                    })
                  }
                  placeholder="prod_xxxxx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stripe Price ID
                </label>
                <input
                  type="text"
                  value={editForm.stripePriceId || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      stripePriceId: e.target.value || null,
                    })
                  }
                  placeholder="price_xxxxx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Badges */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Badges
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editForm.badges.map((badge, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-orange-500 text-white text-sm rounded-full flex items-center gap-2"
                  >
                    {badge}
                    <button
                      onClick={() => handleRemoveBadge(idx)}
                      className="text-white hover:text-red-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleAddBadge}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                + Add Badge
              </button>
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Features
              </label>
              <div className="space-y-2 mb-2">
                {editForm.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={(e) => handleUpdateFeature(idx, 'enabled', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <input
                      type="text"
                      value={feature.description}
                      onChange={(e) => handleUpdateFeature(idx, 'description', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Feature description"
                    />
                    <button
                      onClick={() => handleRemoveFeature(idx)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddFeature}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                + Add Feature
              </button>
            </div>

            {/* Status & Order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-5 h-5"
                />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Plan is Active
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={editForm.order}
                  onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(null);
                  setSelectedPlan(null);
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Enforcement Prompt Modal */}
      {showPrompt && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPrompt(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🤖 Subscription Enforcement Prompt
              </h2>
              <button
                onClick={() => setShowPrompt(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>📋 Instructions:</strong> Copy this entire prompt and paste it in your conversation with the AI.
                  The AI will use this information to enforce subscription restrictions throughout your application.
                </p>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(promptText);
                    alert('✅ Prompt copied to clipboard!');
                  }}
                  className="absolute top-2 right-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm z-10"
                >
                  📋 Copy to Clipboard
                </button>
                
                <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {promptText}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(promptText);
                  alert('✅ Prompt copied to clipboard!');
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlanManager;

