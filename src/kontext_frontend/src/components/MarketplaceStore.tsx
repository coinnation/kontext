/**
 * Marketplace Store - Kontext Style
 * Discover, purchase, and deploy amazing projects with stunning UI
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { platformCanisterService, PlatformCanisterService } from '../services/PlatformCanisterService';
import { ProductDetailPage } from './marketplace/ProductDetailPage';

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

interface MarketplaceStoreProps {
    onClose?: () => void;
}

const LISTINGS_PER_PAGE = 20;

export const MarketplaceStore: React.FC<MarketplaceStoreProps> = ({ onClose }) => {
    const { identity, principal } = useAppStore();
    
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
    const [reviewSummaries, setReviewSummaries] = useState<Map<string, ReviewSummary>>(new Map());
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalListings, setTotalListings] = useState(0);
    const [loadingPage, setLoadingPage] = useState(false);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating' | 'price-low' | 'price-high'>('popular');
    
    const categories = ['all', 'Templates', 'Tools', 'Games', 'Education', 'Business', 'Social', 'Finance', 'Other'];

    useEffect(() => {
        loadMarketplace();
    }, [currentPage, selectedCategory]);

    useEffect(() => {
        applyFiltersAndSort();
    }, [listings, searchQuery, sortBy]);

    const loadMarketplace = async () => {
        try {
            setLoadingPage(true);
            
            // 🔥 FIX: Ensure platform service is initialized with identity
            let service = platformCanisterService;
            if (identity) {
                service = PlatformCanisterService.createWithIdentity(identity);
                await service.initialize();
            }
            
            // Load paginated published listings
            const offset = (currentPage - 1) * LISTINGS_PER_PAGE;
            let result: { listings: any[]; total: number };
            
            if (selectedCategory === 'all') {
                result = await service.getPublishedListingsPaginated(LISTINGS_PER_PAGE, offset);
            } else {
                result = await service.getListingsByCategoryPaginated(selectedCategory, LISTINGS_PER_PAGE, offset);
            }
            
            const listingsData = result.listings.map((l: any) => ({
                listingId: l.listingId,
                projectId: l.projectId,
                userCanisterId: l.userCanisterId.toString(),
                seller: l.seller.toString(),
                exportId: l.exportId,
                title: l.title,
                description: l.description,
                price: Number(l.price),
                stripeAccountId: l.stripeAccountId,
                previewImages: l.previewImages || [],
                demoUrl: l.demoUrl[0] || null,
                category: l.category,
                tags: l.tags || [],
                version: l.version,
                listedAt: l.listedAt,
                updatedAt: l.updatedAt,
                totalSales: Number(l.totalSales),
                isPublished: l.isPublished,
                isActive: l.isActive
            }));

            setListings(listingsData);
            setTotalListings(result.total);

            // Load review summaries for current page listings
            const summaries = new Map<string, ReviewSummary>();
            await Promise.all(
                listingsData.map(async (listing) => {
                    try {
                        const summary = await service.getListingReviewSummary(listing.listingId);
                        summaries.set(listing.listingId, {
                            listingId: summary.listingId,
                            totalReviews: Number(summary.totalReviews),
                            averageRating: Number(summary.averageRating),
                            ratingDistribution: summary.ratingDistribution.map((n: any) => Number(n)),
                            recommendationRate: Number(summary.recommendationRate),
                            verifiedPurchaseRate: Number(summary.verifiedPurchaseRate)
                        });
                    } catch (error) {
                        console.warn(`Failed to load reviews for ${listing.listingId}:`, error);
                    }
                })
            );
            setReviewSummaries(summaries);

        } catch (error) {
            console.error('Failed to load marketplace:', error);
        } finally {
            setLoading(false);
            setLoadingPage(false);
        }
    };

    const applyFiltersAndSort = () => {
        let filtered = [...listings];

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(l => 
                l.title.toLowerCase().includes(query) ||
                l.description.toLowerCase().includes(query) ||
                l.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(l => l.category === selectedCategory);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'popular':
                    return b.totalSales - a.totalSales;
                case 'newest':
                    return Number(b.listedAt) - Number(a.listedAt);
                case 'rating':
                    const ratingA = reviewSummaries.get(a.listingId)?.averageRating || 0;
                    const ratingB = reviewSummaries.get(b.listingId)?.averageRating || 0;
                    return ratingB - ratingA;
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                default:
                    return 0;
            }
        });

        setFilteredListings(filtered);
    };

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
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
                        Loading marketplace...
                    </p>
                </div>
            </div>
        );
    }

    if (selectedListing) {
        return (
            <ProductDetailPage 
                listing={selectedListing}
                reviewSummary={reviewSummaries.get(selectedListing.listingId)}
                onBack={() => setSelectedListing(null)}
            />
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
            position: 'relative',
        }}>
            {/* Back Button */}
            {onClose && (
                <div style={{
                    position: 'fixed',
                    top: '30px',
                    left: '30px',
                    zIndex: 1000
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '1rem 2rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(10, 10, 10, 0.95)',
                            backdropFilter: 'blur(20px)',
                            color: '#10b981',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                            e.currentTarget.style.transform = 'translateX(-4px)';
                            e.currentTarget.style.borderColor = '#10b981';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(10, 10, 10, 0.95)';
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                        }}
                    >
                        ← Back
                    </button>
                </div>
            )}

            {/* Hero Section - Kontext Style */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                padding: '120px 40px 80px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                borderBottom: '2px solid rgba(255, 107, 53, 0.2)',
            }}>
                {/* Animated gradient orbs */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-10%',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(255, 107, 53, 0.15) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(80px)',
                    pointerEvents: 'none',
                    animation: 'float 20s ease-in-out infinite',
                }}></div>
                <div style={{
                    position: 'absolute',
                    bottom: '-30%',
                    right: '-5%',
                    width: '400px',
                    height: '400px',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(80px)',
                    pointerEvents: 'none',
                    animation: 'float 15s ease-in-out infinite reverse',
                }}></div>
                
                <h1 style={{
                    fontSize: '4.5rem',
                    fontWeight: '800',
                    margin: '0 0 1.5rem 0',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 40px rgba(16, 185, 129, 0.3)',
                    position: 'relative',
                    letterSpacing: '-0.02em',
                }}>
                    🛒 Kontext Marketplace
                </h1>
                <p style={{
                    fontSize: '1.4rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    maxWidth: '700px',
                    margin: '0 auto 3rem',
                    lineHeight: '1.6',
                    position: 'relative',
                }}>
                    Discover, purchase, and deploy amazing projects built by the community
                </p>

                {/* Search Bar - Kontext Style */}
                <div style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    position: 'relative',
                }}>
                    <input
                        type="text"
                        placeholder="🔍 Search projects, categories, or tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '1.5rem 2rem',
                            fontSize: '1.1rem',
                            borderRadius: '20px',
                            border: '2px solid rgba(255, 107, 53, 0.3)',
                            background: 'rgba(10, 10, 10, 0.8)',
                            backdropFilter: 'blur(20px)',
                            color: '#ffffff',
                            boxShadow: '0 8px 32px rgba(255, 107, 53, 0.2)',
                            outline: 'none',
                            transition: 'all 0.3s ease',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#10b981';
                            e.currentTarget.style.boxShadow = '0 12px 48px rgba(255, 107, 53, 0.4)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                            e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.2)';
                        }}
                    />
                </div>
            </div>

            {/* Filters & Sort - Kontext Style */}
            <div style={{
                padding: '2rem 3rem',
                borderBottom: '1px solid rgba(255, 107, 53, 0.1)',
                background: 'rgba(10, 10, 10, 0.8)',
                backdropFilter: 'blur(20px)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 20px rgba(255, 107, 53, 0.1)',
            }}>
                <div style={{
                    maxWidth: '1600px',
                    margin: '0 auto',
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    {/* Category Pills - Kontext Style */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.75rem 1.75rem',
                                    borderRadius: '16px',
                                    border: selectedCategory === cat
                                        ? '2px solid rgba(255, 107, 53, 0.5)'
                                        : '1px solid rgba(255, 107, 53, 0.2)',
                                    background: selectedCategory === cat 
                                        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(245, 158, 11, 0.15))'
                                        : 'rgba(255, 255, 255, 0.05)',
                                    color: selectedCategory === cat ? '#ff6b35' : 'rgba(255, 255, 255, 0.7)',
                                    fontSize: '0.95rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    textTransform: 'capitalize',
                                    boxShadow: selectedCategory === cat
                                        ? '0 4px 12px rgba(255, 107, 53, 0.3)'
                                        : 'none',
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedCategory !== cat) {
                                        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedCategory !== cat) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                                    }
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Sort Dropdown - Kontext Style */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(10, 10, 10, 0.8)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="popular">🔥 Most Popular</option>
                        <option value="newest">✨ Newest First</option>
                        <option value="rating">⭐ Highest Rated</option>
                        <option value="price-low">💰 Price: Low to High</option>
                        <option value="price-high">💎 Price: High to Low</option>
                    </select>
                </div>
            </div>

            {/* Results Count */}
            <div style={{
                padding: '2rem 3rem 1rem',
                maxWidth: '1600px',
                margin: '0 auto'
            }}>
                <p style={{ 
                    fontSize: '1rem', 
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: '600',
                }}>
                    📦 {filteredListings.length} {filteredListings.length === 1 ? 'project' : 'projects'} found
                </p>
            </div>

            {/* Product Grid - Kontext Style */}
            <div style={{
                padding: '0 3rem 5rem',
                maxWidth: '1600px',
                margin: '0 auto'
            }}>
                {filteredListings.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '6rem 2rem',
                        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
                        border: '1px solid rgba(255, 107, 53, 0.1)',
                        borderRadius: '24px',
                    }}>
                        <div style={{ 
                            fontSize: '5rem', 
                            marginBottom: '2rem',
                            filter: 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.3))',
                        }}>🔍</div>
                        <h3 style={{
                            fontSize: '2rem',
                            fontWeight: '700',
                            color: '#ffffff',
                            marginBottom: '1rem',
                        }}>No projects found</h3>
                        <p style={{ 
                            fontSize: '1.1rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                        }}>
                            Try adjusting your filters or search terms
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                            gap: '2.5rem'
                        }}>
                            {filteredListings.map(listing => (
                                <ProductCard
                                    key={listing.listingId}
                                    listing={listing}
                                    reviewSummary={reviewSummaries.get(listing.listingId)}
                                    onClick={() => setSelectedListing(listing)}
                                />
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalListings > LISTINGS_PER_PAGE && (
                        <div style={{
                            marginTop: '3rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '1rem',
                        }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loadingPage}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    background: currentPage === 1 
                                        ? 'rgba(50, 50, 50, 0.5)' 
                                        : 'rgba(16, 185, 129, 0.1)',
                                    color: currentPage === 1 ? '#666' : '#10b981',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                ← Previous
                            </button>

                            <div style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                fontWeight: '600',
                            }}>
                                Page {currentPage} of {Math.ceil(totalListings / LISTINGS_PER_PAGE)}
                                <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginLeft: '0.5rem' }}>
                                    ({totalListings} total)
                                </span>
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalListings / LISTINGS_PER_PAGE), p + 1))}
                                disabled={currentPage >= Math.ceil(totalListings / LISTINGS_PER_PAGE) || loadingPage}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    background: currentPage >= Math.ceil(totalListings / LISTINGS_PER_PAGE)
                                        ? 'rgba(50, 50, 50, 0.5)'
                                        : 'rgba(16, 185, 129, 0.1)',
                                    color: currentPage >= Math.ceil(totalListings / LISTINGS_PER_PAGE) ? '#666' : '#10b981',
                                    cursor: currentPage >= Math.ceil(totalListings / LISTINGS_PER_PAGE) ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes float {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    33% { transform: translate(30px, -30px) rotate(120deg); }
                    66% { transform: translate(-20px, 20px) rotate(240deg); }
                }
            `}</style>
        </div>
    );
};

// Product Card Component - Kontext Style
const ProductCard: React.FC<{
    listing: MarketplaceListing;
    reviewSummary?: ReviewSummary;
    onClick: () => void;
}> = ({ listing, reviewSummary, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isHovered ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: isHovered 
                    ? '0 20px 60px rgba(255, 107, 53, 0.4), 0 0 0 1px rgba(255, 107, 53, 0.3)'
                    : '0 8px 32px rgba(255, 107, 53, 0.15)',
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
                background: 'linear-gradient(90deg, #10b981, #ff6b35, #a855f7)',
            }}></div>

            {/* Preview Image */}
            <div style={{
                height: '240px',
                background: listing.previewImages[0]
                    ? `url(${listing.previewImages[0]})`
                    : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Category Badge */}
                <div style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(10, 10, 10, 0.9)',
                    backdropFilter: 'blur(10px)',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#ff6b35',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }}>
                    {listing.category}
                </div>

                {/* Sales Badge */}
                {listing.totalSales > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))',
                        backdropFilter: 'blur(10px)',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                    }}>
                        🔥 {listing.totalSales} sold
                    </div>
                )}

                {/* Hover overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(10, 10, 10, 0.8) 100%)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                }}></div>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
                {/* Title */}
                <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.4rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {listing.title}
                </h3>

                {/* Description */}
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
                    {listing.description}
                </p>

                {/* Rating */}
                {reviewSummary && reviewSummary.totalReviews > 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[...Array(5)].map((_, i) => (
                                <span key={i} style={{
                                    color: i < Math.floor(reviewSummary.averageRating) ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                                    fontSize: '1.2rem',
                                    filter: i < Math.floor(reviewSummary.averageRating) ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.5))' : 'none',
                                }}>
                                    ⭐
                                </span>
                            ))}
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f59e0b' }}>
                            {reviewSummary.averageRating.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            ({reviewSummary.totalReviews})
                        </span>
                    </div>
                ) : (
                    <div style={{
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.4)'
                    }}>
                        ⭐ No reviews yet
                    </div>
                )}

                {/* Tags */}
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    marginBottom: '1.5rem'
                }}>
                    {listing.tags.slice(0, 3).map(tag => (
                        <span
                            key={tag}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: '#10b981'
                            }}
                        >
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(255, 107, 53, 0.2)'
                }}>
                    {/* Price */}
                    <div style={{
                        fontSize: '2rem',
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 20px rgba(255, 107, 53, 0.3)',
                    }}>
                        ${(listing.price / 100).toFixed(2)}
                    </div>

                    {/* View Button */}
                    <button
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: isHovered
                                ? 'linear-gradient(135deg, #ff6b35, #f59e0b)'
                                : 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(245, 158, 11, 0.15))',
                            color: '#ffffff',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: isHovered
                                ? '0 8px 24px rgba(255, 107, 53, 0.5)'
                                : 'none',
                        }}
                    >
                        View Details →
                    </button>
                </div>
            </div>
        </div>
    );
};

// Product Detail Page is now imported from ./marketplace/ProductDetailPage
