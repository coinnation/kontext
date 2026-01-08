/**
 * Product Detail Page - Full Marketplace Experience
 * Complete product view with reviews, purchases, installation, and downloads
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { platformCanisterService } from '../../services/PlatformCanisterService';
import { ReviewsSection } from './ReviewsSection';
import type { Principal } from '@dfinity/principal';

interface MarketplaceListing {
    listingId: string;
    projectId: string;
    userCanisterId: string;
    seller: string;
    exportId: string;
    title: string;
    description: string;
    price: number;
    stripeAccountId: string;
    previewImages: string[];
    demoUrl: string | null;
    category: string;
    tags: string[];
    version: string;
    listedAt: bigint;
    updatedAt: bigint;
    totalSales: number;
    isPublished: boolean;
    isActive: boolean;
}

interface ReviewSummary {
    listingId: string;
    totalReviews: number;
    averageRating: number;
    ratingDistribution: number[];
    recommendationRate: number;
    verifiedPurchaseRate: number;
}

interface ProjectReview {
    reviewId: string;
    listingId: string;
    purchaseId: string;
    reviewer: string;
    rating: number;
    title: string;
    comment: string;
    pros: string[];
    cons: string[];
    wouldRecommend: boolean;
    createdAt: bigint;
    updatedAt: bigint;
    isVerifiedPurchase: boolean;
    helpfulCount: number;
    reportCount: number;
    isHidden: boolean;
    sellerResponse: { responseText: string; respondedAt: bigint } | null;
}

interface VerifiedPurchase {
    purchaseId: string;
    listingId: string;
    buyer: string;
    stripePaymentIntentId: string;
    amountPaid: number;
    purchasedAt: bigint;
    status: 'pending' | 'completed' | 'refunded' | 'failed';
}

interface ProductDetailPageProps {
    listing: MarketplaceListing;
    reviewSummary?: ReviewSummary;
    onBack: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ listing, reviewSummary, onBack }) => {
    const { identity, principal } = useAppStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'seller'>('overview');
    const [selectedImage, setSelectedImage] = useState(0);
    const [reviews, setReviews] = useState<ProjectReview[]>([]);
    const [userPurchase, setUserPurchase] = useState<VerifiedPurchase | null>(null);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        loadReviews();
        checkUserPurchase();
    }, [listing.listingId, principal]);

    const loadReviews = async () => {
        try {
            setLoadingReviews(true);
            const reviewsData = await platformCanisterService.getListingReviews(listing.listingId);
            setReviews(reviewsData.map((r: any) => ({
                ...r,
                reviewer: r.reviewer.toString(),
                sellerResponse: r.sellerResponse[0] || null,
            })));
        } catch (error) {
            console.error('Failed to load reviews:', error);
        } finally {
            setLoadingReviews(false);
        }
    };

    const checkUserPurchase = async () => {
        if (!principal) return;
        
        try {
            const purchases = await platformCanisterService.getUserPurchases();
            const purchase = purchases.find((p: any) => 
                p.listingId === listing.listingId && 
                p.status === 'completed'
            );
            
            if (purchase) {
                setUserPurchase({
                    ...purchase,
                    buyer: purchase.buyer.toString(),
                });
            }
        } catch (error) {
            console.error('Failed to check purchase:', error);
        }
    };

    const handlePurchase = async () => {
        if (!identity || !principal) {
            alert('Please sign in to make a purchase');
            return;
        }

        try {
            setLoadingPurchase(true);
            
            // Create Stripe checkout session
            const result = await platformCanisterService.createMarketplaceCheckout(
                listing.listingId,
                listing.seller,
                listing.stripeAccountId
            );

            if ('ok' in result && result.ok.sessionId) {
                // Redirect to Stripe Checkout
                window.location.href = `https://checkout.stripe.com/pay/${result.ok.sessionId}`;
            } else {
                throw new Error('Failed to create checkout session');
            }
        } catch (error) {
            console.error('Purchase failed:', error);
            alert('❌ Failed to initiate purchase. Please try again.');
        } finally {
            setLoadingPurchase(false);
        }
    };

    const handleInstall = async () => {
        if (!userPurchase) {
            alert('Please purchase this app first');
            return;
        }

        try {
            setInstalling(true);
            
            // Call backend to install project into user's environment
            const result = await platformCanisterService.installPurchasedApp(
                userPurchase.purchaseId,
                listing.listingId
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
        if (!userPurchase) {
            alert('Please purchase this app first');
            return;
        }

        try {
            setDownloading(true);
            
            // Generate download token
            const tokenResult = await platformCanisterService.generateDownloadToken(
                userPurchase.purchaseId
            );

            if ('ok' in tokenResult) {
                const token = tokenResult.ok;
                
                // Download the exported project as ZIP
                const downloadUrl = `https://${listing.userCanisterId}.raw.icp0.io/export/${listing.exportId}?token=${token.tokenId}`;
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

    const hasPurchased = Boolean(userPurchase);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
            padding: '3rem',
        }}>
            {/* Back Button */}
            <button
                onClick={onBack}
                style={{
                    padding: '1rem 2rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'rgba(10, 10, 10, 0.95)',
                    color: '#10b981',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginBottom: '3rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                    e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(10, 10, 10, 0.95)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                }}
            >
                ← Back to Marketplace
            </button>

            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
            }}>
                {/* Main Content Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '3rem',
                    marginBottom: '4rem',
                }}>
                    {/* Left Column - Images */}
                    <div>
                        {/* Main Image */}
                        <div style={{
                            background: listing.previewImages[selectedImage]
                                ? `url(${listing.previewImages[selectedImage]})`
                                : 'linear-gradient(135deg, #10b981, #f59e0b)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            height: '500px',
                            borderRadius: '24px',
                            marginBottom: '1.5rem',
                            border: '2px solid rgba(16, 185, 129, 0.3)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Top gradient bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '4px',
                                background: 'linear-gradient(90deg, #10b981, #f59e0b, #10b981)',
                            }}></div>

                            {/* Sales badge */}
                            {listing.totalSales > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '1.5rem',
                                    right: '1.5rem',
                                    padding: '1rem 1.5rem',
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    color: '#ffffff',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                                }}>
                                    🔥 {listing.totalSales} sold
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Grid */}
                        {listing.previewImages.length > 1 && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                                gap: '1rem',
                            }}>
                                {listing.previewImages.map((img, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedImage(idx)}
                                        style={{
                                            background: `url(${img})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            height: '100px',
                                            borderRadius: '12px',
                                            border: selectedImage === idx 
                                                ? '3px solid #10b981' 
                                                : '1px solid rgba(16, 185, 129, 0.2)',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: selectedImage === idx
                                                ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                                                : 'none',
                                        }}
                                    ></div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Product Info */}
                    <div>
                        {/* Category Badge */}
                        <div style={{
                            display: 'inline-block',
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            color: '#10b981',
                            marginBottom: '1.5rem',
                        }}>
                            {listing.category}
                        </div>

                        {/* Title */}
                        <h1 style={{
                            fontSize: '3rem',
                            fontWeight: '800',
                            background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '1rem',
                            lineHeight: '1.2',
                        }}>
                            {listing.title}
                        </h1>

                        {/* Rating */}
                        {reviewSummary && reviewSummary.totalReviews > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                marginBottom: '2rem',
                            }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i} style={{
                                            color: i < Math.floor(reviewSummary.averageRating) ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                                            fontSize: '1.5rem',
                                            filter: i < Math.floor(reviewSummary.averageRating) ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.5))' : 'none',
                                        }}>
                                            ⭐
                                        </span>
                                    ))}
                                </div>
                                <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f59e0b' }}>
                                    {reviewSummary.averageRating.toFixed(1)}
                                </span>
                                <span style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    ({reviewSummary.totalReviews} {reviewSummary.totalReviews === 1 ? 'review' : 'reviews'})
                                </span>
                            </div>
                        )}

                        {/* Description */}
                        <p style={{
                            fontSize: '1.2rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            lineHeight: '1.8',
                            marginBottom: '2rem',
                        }}>
                            {listing.description}
                        </p>

                        {/* Tags */}
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            marginBottom: '3rem',
                        }}>
                            {listing.tags.map(tag => (
                                <span
                                    key={tag}
                                    style={{
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: '12px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        color: '#10b981'
                                    }}
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        {/* Price & Purchase */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.05))',
                            border: '2px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '20px',
                            padding: '2.5rem',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Top gradient bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '4px',
                                background: 'linear-gradient(90deg, #10b981, #f59e0b, #10b981)',
                            }}></div>

                            <div style={{
                                fontSize: '4rem',
                                fontWeight: '800',
                                background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                marginBottom: '2rem',
                                textShadow: '0 0 40px rgba(16, 185, 129, 0.4)',
                            }}>
                                ${(listing.price / 100).toFixed(2)}
                            </div>

                            {hasPurchased ? (
                                <div>
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        borderRadius: '12px',
                                        marginBottom: '1.5rem',
                                        textAlign: 'center',
                                        fontSize: '1.1rem',
                                        fontWeight: '700',
                                        color: '#10b981',
                                    }}>
                                        ✅ You own this app
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button
                                            onClick={handleInstall}
                                            disabled={installing}
                                            style={{
                                                flex: 1,
                                                padding: '1.25rem',
                                                borderRadius: '12px',
                                                border: 'none',
                                                background: installing ? '#6B7280' : 'linear-gradient(135deg, #10b981, #059669)',
                                                color: '#ffffff',
                                                fontSize: '1.1rem',
                                                fontWeight: '700',
                                                cursor: installing ? 'not-allowed' : 'pointer',
                                                boxShadow: installing ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.4)',
                                                transition: 'all 0.3s ease',
                                            }}
                                        >
                                            {installing ? '⏳ Installing...' : '🚀 Install App'}
                                        </button>

                                        <button
                                            onClick={handleDownload}
                                            disabled={downloading}
                                            style={{
                                                flex: 1,
                                                padding: '1.25rem',
                                                borderRadius: '12px',
                                                border: 'none',
                                                background: downloading ? '#6B7280' : 'linear-gradient(135deg, #10b981, #f59e0b)',
                                                color: '#ffffff',
                                                fontSize: '1.1rem',
                                                fontWeight: '700',
                                                cursor: downloading ? 'not-allowed' : 'pointer',
                                                boxShadow: downloading ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.4)',
                                                transition: 'all 0.3s ease',
                                            }}
                                        >
                                            {downloading ? '⏳ Downloading...' : '📦 Download ZIP'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handlePurchase}
                                    disabled={loadingPurchase || !listing.isActive}
                                    style={{
                                        width: '100%',
                                        padding: '1.5rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: loadingPurchase || !listing.isActive 
                                            ? '#6B7280' 
                                            : 'linear-gradient(135deg, #10b981, #f59e0b)',
                                        color: '#ffffff',
                                        fontSize: '1.3rem',
                                        fontWeight: '700',
                                        cursor: loadingPurchase || !listing.isActive ? 'not-allowed' : 'pointer',
                                        boxShadow: loadingPurchase || !listing.isActive 
                                            ? 'none' 
                                            : '0 8px 24px rgba(16, 185, 129, 0.5)',
                                        transition: 'all 0.3s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!loadingPurchase && listing.isActive) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 12px 36px rgba(16, 185, 129, 0.6)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!loadingPurchase && listing.isActive) {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.5)';
                                        }
                                    }}
                                >
                                    {loadingPurchase ? '⏳ Processing...' : !listing.isActive ? '❌ Not Available' : '🛒 Buy Now'}
                                </button>
                            )}

                            {/* Demo Link */}
                            {listing.demoUrl && (
                                <a
                                    href={listing.demoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'block',
                                        textAlign: 'center',
                                        marginTop: '1rem',
                                        color: '#10b981',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        textDecoration: 'none',
                                    }}
                                >
                                    🎮 Try Demo →
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '3rem',
                    borderBottom: '2px solid rgba(16, 185, 129, 0.2)',
                }}>
                    {(['overview', 'reviews', 'seller'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '1.25rem 2.5rem',
                                background: activeTab === tab 
                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(245, 158, 11, 0.15))' 
                                    : 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab ? '3px solid #10b981' : '3px solid transparent',
                                borderRadius: '12px 12px 0 0',
                                color: activeTab === tab ? '#10b981' : 'rgba(255, 255, 255, 0.6)',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab === 'overview' && '📋 Overview'}
                            {tab === 'reviews' && `⭐ Reviews (${reviewSummary?.totalReviews || 0})`}
                            {tab === 'seller' && '👤 Seller Info'}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <OverviewTab listing={listing} />
                )}

                {activeTab === 'reviews' && (
                    <ReviewsTab
                        listing={listing}
                        reviews={reviews}
                        reviewSummary={reviewSummary}
                        hasPurchased={hasPurchased}
                        userPurchase={userPurchase}
                        onReviewSubmitted={loadReviews}
                    />
                )}

                {activeTab === 'seller' && (
                    <SellerTab
                        listing={listing}
                    />
                )}
            </div>
        </div>
    );
};

// Overview Tab Component
const OverviewTab: React.FC<{ listing: MarketplaceListing }> = ({ listing }) => {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.03))',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '24px',
            padding: '3rem',
        }}>
            <h2 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '2rem',
            }}>
                📋 About This App
            </h2>

            <div style={{
                fontSize: '1.1rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.8',
                marginBottom: '3rem',
            }}>
                {listing.description}
            </div>

            {/* Technical Details */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '2rem',
            }}>
                <InfoCard title="Version" value={listing.version} icon="🔢" />
                <InfoCard title="Category" value={listing.category} icon="📁" />
                <InfoCard title="Total Sales" value={listing.totalSales.toString()} icon="🔥" />
                <InfoCard 
                    title="Listed" 
                    value={new Date(Number(listing.listedAt) / 1_000_000).toLocaleDateString()} 
                    icon="📅" 
                />
            </div>
        </div>
    );
};

// Info Card Component
const InfoCard: React.FC<{ title: string; value: string; icon: string }> = ({ title, value, icon }) => {
    return (
        <div style={{
            background: 'rgba(10, 10, 10, 0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '16px',
            padding: '2rem',
        }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icon}</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.5rem' }}>
                {title}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff' }}>
                {value}
            </div>
        </div>
    );
};

// Reviews Tab Component - Now fully functional!
const ReviewsTab: React.FC<{
    listing: MarketplaceListing;
    reviews: ProjectReview[];
    reviewSummary?: ReviewSummary;
    hasPurchased: boolean;
    userPurchase: VerifiedPurchase | null;
    onReviewSubmitted: () => void;
}> = ({ listing, reviews, reviewSummary, hasPurchased, userPurchase, onReviewSubmitted }) => {
    return (
        <ReviewsSection
            listingId={listing.listingId}
            reviews={reviews}
            reviewSummary={reviewSummary}
            hasPurchased={hasPurchased}
            userPurchase={userPurchase}
            onReviewSubmitted={onReviewSubmitted}
        />
    );
};

// Seller Tab Component (simplified - full version in next file)
const SellerTab: React.FC<{ listing: MarketplaceListing }> = ({ listing }) => {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.03))',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '24px',
            padding: '3rem',
        }}>
            <h2 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '2rem',
            }}>
                👤 Seller Information
            </h2>

            <div style={{
                fontSize: '1.1rem',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '2rem',
            }}>
                <strong>Seller Principal:</strong><br />
                <code style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    fontSize: '0.95rem',
                }}>
                    {listing.seller}
                </code>
            </div>

            <a
                href={`/profile/${listing.seller}`}
                style={{
                    display: 'inline-block',
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    textDecoration: 'none',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.3s ease',
                }}
            >
                🎴 View Seller Profile →
            </a>
        </div>
    );
};

