import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { initializationRecoveryService, InitializationStep } from '../services/InitializationRecoveryService';

interface InitializationRecoveryDialogProps {
  onClose: () => void;
  onRetry: () => Promise<void>;
}

export const InitializationRecoveryDialog: React.FC<InitializationRecoveryDialogProps> = ({ onClose, onRetry }) => {
  const { principal, initializationRecovery } = useAppStore();
  const [isRetrying, setIsRetrying] = useState(false);

  if (!principal || !initializationRecovery?.needsRecovery) {
    return null;
  }

  const recoveryInfo = initializationRecoveryService.getRecoveryInfo(principal.toString());
  const state = recoveryInfo.state;

  const getStepName = (step: InitializationStep): string => {
    switch (step) {
      case InitializationStep.CANISTER_CREATION:
        return 'Setting up your workspace';
      case InitializationStep.WASM_DEPLOYMENT:
        return 'Installing your tools';
      case InitializationStep.ACCOUNT_INITIALIZATION:
        return 'Creating your account';
      case InitializationStep.SUBSCRIPTION_SETUP:
        return 'Activating your subscription';
      default:
        return 'Setting things up';
    }
  };

  const getStepDescription = (step: InitializationStep): string => {
    switch (step) {
      case InitializationStep.CANISTER_CREATION:
        return 'We were setting up your personal workspace';
      case InitializationStep.WASM_DEPLOYMENT:
        return 'We were installing the tools you need to build projects';
      case InitializationStep.ACCOUNT_INITIALIZATION:
        return 'We were creating your account and profile';
      case InitializationStep.SUBSCRIPTION_SETUP:
        return 'We were activating your subscription and adding your credits';
      default:
        return 'We were getting everything ready for you';
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleContactSupport = () => {
    const supportMessage = `Hi! I need help completing my account setup.

I was setting up my account when something went wrong. Here's what happened:

What we were working on: ${state?.failedSteps.map(s => getStepName(s)).join(', ') || 'Account setup'}
Where we got stuck: ${recoveryInfo.nextStep ? getStepName(recoveryInfo.nextStep) : 'Unknown'}
How many times we tried: ${state?.retryCount || 0}
What happened: ${state?.error || 'Unknown error'}
Payment confirmation: ${state?.sessionId ? 'Yes, payment was successful' : 'N/A'}

Please help me complete my account setup. Thank you!`;

    // Open email client or support link
    const mailtoLink = `mailto:support@kontext.dev?subject=Help completing my account setup&body=${encodeURIComponent(supportMessage)}`;
    window.open(mailtoLink);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Let's finish setting up your account</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isRetrying}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Something went wrong while setting up your account, but don't worry! We've saved your progress and you can try again from where we left off.
          </p>

          {state?.failedSteps && state.failedSteps.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">What we were working on:</h3>
              <ul className="list-disc list-inside space-y-1">
                {state.failedSteps.map((step) => (
                  <li key={step} className="text-red-600">
                    {getStepDescription(step)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recoveryInfo.nextStep && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next:</h3>
              <p className="text-gray-700">
                {getStepDescription(recoveryInfo.nextStep)}
              </p>
            </div>
          )}

          {state?.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                <strong>What happened:</strong> {state.error.replace(/canister|WASM|deployment|principal/gi, (match) => {
                  const replacements: { [key: string]: string } = {
                    'canister': 'workspace',
                    'WASM': 'tools',
                    'deployment': 'installation',
                    'principal': 'account'
                  };
                  return replacements[match.toLowerCase()] || match;
                })}
              </p>
            </div>
          )}

          {state && state.retryCount > 0 && (
            <div className="mb-4 text-sm text-gray-600">
              <p>We've tried {state.retryCount} time{state.retryCount !== 1 ? 's' : ''} so far. You can try {3 - state.retryCount} more time{3 - state.retryCount !== 1 ? 's' : ''}.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleContactSupport}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isRetrying}
          >
            Contact Support
          </button>
          {recoveryInfo.canRetry ? (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? 'Trying again...' : 'Try Again'}
            </button>
          ) : (
            <button
              onClick={handleContactSupport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Get Help from Support
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Good news:</strong> Your payment went through successfully! We just need to finish setting up your account - no additional charges.
          </p>
        </div>
      </div>
    </div>
  );
};
