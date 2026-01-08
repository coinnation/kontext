/**
 * User Purchases Dashboard
 * View, manage, and access all purchased apps
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { platformCanisterService } from '../../services/PlatformCanisterService';

interface VerifiedPurchase {
    purchaseId: string;
    listingId: string;
    buyer: string;
    stripePaymentIntentId: string;
    amountPaid: number;
    userCanisterId: string;
    exportId: string;
    projectId: string;
    purchasedAt: bigint;
    status: 'pending' | 'completed' | 'refunded' | 'failed';
}

interface MarketplaceListing {
    listingId: string;
    title: string;
    description: string;
    category: string;
    previewImages: string[];
    price: number;
    seller: string;
    version: string;
}

interface PurchaseWithListing extends VerifiedPurchase {
    listing?: MarketplaceListing;
}

interface UserPurchasesDashboardProps {
    onClose: () => void;
}

export const UserPurchasesDashboard: React.FC<UserPurchasesDashboardProps> = ({ onClose }) => {
    const { identity, principal } = useAppStore();
    const [purchases, setPurchases] = useState<PurchaseWithListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

    useEffect(() => {
        loadPurchases();
    }, [principal]);

    const loadPurchases = async () => {
        if (!principal) return;

        try {
            setLoading(true);
            const purchasesData = await platformCanisterService.getUserPurchases();
            
            // Load listing details for each purchase
            const purchasesWithListings = await Promise.all(
                purchasesData.map(async (purchase: any) => {
                    try {
                        const listing = await platformCanisterService.getMarketplaceListing(purchase.listingId);
                        return {
                            ...purchase,
                            buyer: purchase.buyer.toString(),
                            userCanisterId: purchase.userCanisterId.toString(),
                            listing: listing ? {
                                ...listing,
                                seller: listing.seller.toString(),
                            } : undefined,
                        };
                    } catch (error) {
                        console.error(`Failed to load listing for purchase ${purchase.purchaseId}:`, error);
                        return {
                            ...purchase,
                            buyer: purchase.buyer.toString(),
                            userCanisterId: purchase.userCanisterId.toString(),
                        };
                    }
                })
            );

            setPurchases(purchasesWithListings);
        } catch (error) {
            console.error('Failed to load purchases:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPurchases = purchases.filter(p => {
        if (filter === 'all') return true;
        return p.status === filter;
    });

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        border: '4px solid rgba(16, 185, 129, 0.2)',
                        borderTopColor: '#10b981',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 2rem',
                    }}></div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem', fontWeight: '600' }}>
                        Loading your purchases...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
            zIndex: 10000,
            overflow: 'auto',
        }}>
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '3rem',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '3rem',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '3rem',
                            fontWeight: '800',
                            background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '0.75rem',
                            letterSpacing: '-0.02em',
                        }}>
                            📦 My Purchases
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                            Manage and access all your purchased apps
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '1rem 2rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '12px',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '1rem',
                            transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                        }}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* Filter Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '3rem',
                    borderBottom: '2px solid rgba(16, 185, 129, 0.2)',
                }}>
                    {(['all', 'completed', 'pending'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '1rem 2rem',
                                background: filter === f 
                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(245, 158, 11, 0.15))' 
                                    : 'transparent',
                                border: 'none',
                                borderBottom: filter === f ? '3px solid #10b981' : '3px solid transparent',
                                borderRadius: '12px 12px 0 0',
                                color: filter === f ? '#10b981' : 'rgba(255, 255, 255, 0.6)',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f} ({purchases.filter(p => f === 'all' || p.status === f).length})
                        </button>
                    ))}
                </div>

                {/* Purchases Grid */}
                {filteredPurchases.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '6rem 3rem',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.03))',
                        border: '2px dashed rgba(16, 185, 129, 0.3)',
                        borderRadius: '24px',
                    }}>
                        <div style={{ 
                            fontSize: '5rem', 
                            marginBottom: '2rem',
                            filter: 'drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))',
                        }}>🛒</div>
                        <h3 style={{
                            fontSize: '2rem',
                            fontWeight: '700',
                            color: '#ffffff',
                            marginBottom: '1rem',
                        }}>
                            No Purchases Yet
                        </h3>
                        <p style={{
                            fontSize: '1.2rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            marginBottom: '2rem',
                        }}>
                            Browse the marketplace to find amazing apps!
                        </p>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '1.25rem 3rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                                color: '#ffffff',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                            }}
                        >
                            🛒 Browse Marketplace
                        </button>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                        gap: '2.5rem',
                    }}>
                        {filteredPurchases.map(purchase => (
                            <PurchaseCard key={purchase.purchaseId} purchase={purchase} />
                        ))}
                    </div>
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

// Purchase Card Component
const PurchaseCard: React.FC<{ purchase: PurchaseWithListing }> = ({ purchase }) => {
    const [installing, setInstalling] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleInstall = async () => {
        try {
            setInstalling(true);
            const result = await platformCanisterService.installPurchasedApp(
                purchase.purchaseId,
                purchase.listingId
            );
            if ('ok' in result) {
                alert('✅ App installed successfully! Check your projects.');
            } else {
                throw new Error('Installation failed');
            }
        } catch (error) {
            console.error('Installation failed:', error);
            alert('❌ Failed to install app. Please try again.');
        } finally {
            setInstalling(false);
        }
    };

    const handleDownload = async () => {
        try {
            setDownloading(true);
            const tokenResult = await platformCanisterService.generateDownloadToken(purchase.purchaseId);
            if ('ok' in tokenResult) {
                const token = tokenResult.ok;
                const downloadUrl = `https://${purchase.userCanisterId}.raw.icp0.io/export/${purchase.exportId}?token=${token.tokenId}`;
                window.open(downloadUrl, '_blank');
                alert('✅ Download started! Check your downloads folder.');
            } else {
                throw new Error('Failed to generate download token');
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('❌ Failed to download app. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const statusColor = {
        completed: '#10b981',
        pending: '#f59e0b',
        refunded: '#9CA3AF',
        failed: '#EF4444',
    }[purchase.status];

    const statusIcon = {
        completed: '✅',
        pending: '⏳',
        refunded: '↩️',
        failed: '❌',
    }[purchase.status];

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.05))',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isHovered ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: isHovered 
                    ? '0 20px 60px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.3)'
                    : '0 8px 32px rgba(16, 185, 129, 0.15)',
                position: 'relative',
            }}
        >
            {/* Top gradient accent */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #10b981, #f59e0b, #10b981)',
            }}></div>

            {/* Preview Image */}
            {purchase.listing?.previewImages?.[0] && (
                <div style={{
                    height: '200px',
                    background: `url(${purchase.listing.previewImages[0]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                }}>
                    {/* Status Badge */}
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '12px',
                        background: 'rgba(10, 10, 10, 0.9)',
                        backdropFilter: 'blur(10px)',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: statusColor,
                        border: `1px solid ${statusColor}40`,
                    }}>
                        {statusIcon} {purchase.status}
                    </div>
                </div>
            )}

            {/* Content */}
            <div style={{ padding: '2rem' }}>
                {/* Title */}
                <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffffff',
                }}>
                    {purchase.listing?.title || 'Purchased App'}
                </h3>

                {/* Description */}
                {purchase.listing?.description && (
                    <p style={{
                        margin: '0 0 1.5rem 0',
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        height: '3rem',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.5rem'
                    }}>
                        {purchase.listing.description}
                    </p>
                )}

                {/* Purchase Details */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'rgba(10, 10, 10, 0.5)',
                    borderRadius: '12px',
                }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            Purchased
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#ffffff' }}>
                            {new Date(Number(purchase.purchasedAt) / 1_000_000).toLocaleDateString()}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            Price Paid
                        </div>
                        <div style={{
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            ${(purchase.amountPaid / 100).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                {purchase.status === 'completed' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: installing 
                                    ? '#6B7280' 
                                    : 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#ffffff',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: installing ? 'not-allowed' : 'pointer',
                                boxShadow: installing ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.4)',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {installing ? '⏳' : '🚀'} Install
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: downloading 
                                    ? '#6B7280' 
                                    : 'linear-gradient(135deg, #10b981, #f59e0b)',
                                color: '#ffffff',
                                fontSize: '1rem',
                                fontWeight: '700',
                                cursor: downloading ? 'not-allowed' : 'pointer',
                                boxShadow: downloading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.4)',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {downloading ? '⏳' : '📦'} Download
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

