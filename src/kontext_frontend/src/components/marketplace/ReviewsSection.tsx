/**
 * Reviews Section - Full Review & Rating System
 * Complete review display, submission, voting, and moderation
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { platformCanisterService } from '../../services/PlatformCanisterService';

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

interface ReviewSummary {
    listingId: string;
    totalReviews: number;
    averageRating: number;
    ratingDistribution: number[];
    recommendationRate: number;
    verifiedPurchaseRate: number;
}

interface VerifiedPurchase {
    purchaseId: string;
    listingId: string;
    buyer: string;
    amountPaid: number;
    purchasedAt: bigint;
    status: string;
}

interface ReviewsSectionProps {
    listingId: string;
    reviews: ProjectReview[];
    reviewSummary?: ReviewSummary;
    hasPurchased: boolean;
    userPurchase: VerifiedPurchase | null;
    onReviewSubmitted: () => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
    listingId,
    reviews,
    reviewSummary,
    hasPurchased,
    userPurchase,
    onReviewSubmitted,
}) => {
    const { identity, principal } = useAppStore();
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'rating'>('recent');

    // Check if user has already reviewed
    const userReview = reviews.find(r => r.reviewer === principal?.toText());
    const canReview = hasPurchased && !userReview;

    // Sort reviews
    const sortedReviews = [...reviews].sort((a, b) => {
        switch (sortBy) {
            case 'helpful':
                return b.helpfulCount - a.helpfulCount;
            case 'rating':
                return b.rating - a.rating;
            case 'recent':
            default:
                return Number(b.createdAt) - Number(a.createdAt);
        }
    });

    return (
        <div>
            {/* Review Summary */}
            {reviewSummary && reviewSummary.totalReviews > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.05))',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '24px',
                    padding: '3rem',
                    marginBottom: '3rem',
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
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr',
                        gap: '3rem',
                        alignItems: 'center',
                    }}>
                        {/* Overall Rating */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: '5rem',
                                fontWeight: '800',
                                background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                marginBottom: '1rem',
                            }}>
                                {reviewSummary.averageRating.toFixed(1)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1rem' }}>
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} style={{
                                        color: i < Math.floor(reviewSummary.averageRating) ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                                        fontSize: '2rem',
                                        filter: i < Math.floor(reviewSummary.averageRating) ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' : 'none',
                                    }}>
                                        ⭐
                                    </span>
                                ))}
                            </div>
                            <div style={{
                                fontSize: '1.1rem',
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontWeight: '600',
                            }}>
                                Based on {reviewSummary.totalReviews} {reviewSummary.totalReviews === 1 ? 'review' : 'reviews'}
                            </div>
                            <div style={{
                                marginTop: '1rem',
                                fontSize: '1rem',
                                color: '#10b981',
                                fontWeight: '700',
                            }}>
                                {reviewSummary.recommendationRate.toFixed(0)}% recommend
                            </div>
                        </div>

                        {/* Rating Distribution */}
                        <div>
                            {[5, 4, 3, 2, 1].map(stars => {
                                const count = reviewSummary.ratingDistribution[stars - 1] || 0;
                                const percentage = reviewSummary.totalReviews > 0 
                                    ? (count / reviewSummary.totalReviews) * 100 
                                    : 0;

                                return (
                                    <div key={stars} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        marginBottom: '1rem',
                                    }}>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: '700',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            minWidth: '60px',
                                        }}>
                                            {stars} ⭐
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            height: '12px',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${percentage}%`,
                                                background: 'linear-gradient(90deg, #10b981, #f59e0b)',
                                                borderRadius: '6px',
                                                transition: 'width 0.5s ease',
                                            }}></div>
                                        </div>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: '600',
                                            color: 'rgba(255, 255, 255, 0.6)',
                                            minWidth: '50px',
                                            textAlign: 'right',
                                        }}>
                                            {count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Write Review Button */}
            {canReview && (
                <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                    <button
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        style={{
                            padding: '1.25rem 3rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: showReviewForm
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'linear-gradient(135deg, #10b981, #f59e0b)',
                            color: '#ffffff',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: showReviewForm ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.4)',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {showReviewForm ? '✕ Cancel Review' : '✍️ Write a Review'}
                    </button>
                </div>
            )}

            {/* Review Form */}
            {showReviewForm && canReview && userPurchase && (
                <ReviewForm
                    listingId={listingId}
                    purchaseId={userPurchase.purchaseId}
                    onSubmitted={() => {
                        setShowReviewForm(false);
                        onReviewSubmitted();
                    }}
                    onCancel={() => setShowReviewForm(false)}
                />
            )}

            {/* Sort Controls */}
            {reviews.length > 0 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                }}>
                    <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#ffffff',
                    }}>
                        Customer Reviews ({reviews.length})
                    </h3>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(10, 10, 10, 0.8)',
                            color: '#ffffff',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="recent">Most Recent</option>
                        <option value="helpful">Most Helpful</option>
                        <option value="rating">Highest Rating</option>
                    </select>
                </div>
            )}

            {/* Reviews List */}
            <div style={{
                display: 'grid',
                gap: '2rem',
            }}>
                {sortedReviews.map(review => (
                    <ReviewCard key={review.reviewId} review={review} />
                ))}
            </div>

            {/* Empty State */}
            {reviews.length === 0 && !showReviewForm && (
                <div style={{
                    textAlign: 'center',
                    padding: '5rem 3rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.03))',
                    border: '2px dashed rgba(16, 185, 129, 0.3)',
                    borderRadius: '24px',
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⭐</div>
                    <h3 style={{
                        fontSize: '2rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '1rem',
                    }}>
                        No Reviews Yet
                    </h3>
                    <p style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                    }}>
                        Be the first to review this app!
                    </p>
                </div>
            )}
        </div>
    );
};

// Review Form Component
const ReviewForm: React.FC<{
    listingId: string;
    purchaseId: string;
    onSubmitted: () => void;
    onCancel: () => void;
}> = ({ listingId, purchaseId, onSubmitted, onCancel }) => {
    const [rating, setRating] = useState(5);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [pros, setPros] = useState<string[]>([]);
    const [cons, setCons] = useState<string[]>([]);
    const [proInput, setProInput] = useState('');
    const [conInput, setConInput] = useState('');
    const [wouldRecommend, setWouldRecommend] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const addPro = () => {
        if (proInput.trim() && !pros.includes(proInput.trim())) {
            setPros([...pros, proInput.trim()]);
            setProInput('');
        }
    };

    const addCon = () => {
        if (conInput.trim() && !cons.includes(conInput.trim())) {
            setCons([...cons, conInput.trim()]);
            setConInput('');
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || !comment.trim()) {
            alert('Please provide a title and comment');
            return;
        }

        try {
            setSubmitting(true);
            await platformCanisterService.createReview(
                listingId,
                purchaseId,
                rating,
                title,
                comment,
                pros,
                cons,
                wouldRecommend
            );
            alert('✅ Review submitted successfully!');
            onSubmitted();
        } catch (error) {
            console.error('Failed to submit review:', error);
            alert('❌ Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.05))',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px',
            padding: '3rem',
            marginBottom: '3rem',
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

            <h3 style={{
                fontSize: '2rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #10b981, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '2rem',
            }}>
                ✍️ Write Your Review
            </h3>

            {/* Rating Stars */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '1rem',
                }}>
                    Overall Rating *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '3rem',
                                color: star <= (hoveredRating || rating) ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                                filter: star <= (hoveredRating || rating) ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' : 'none',
                                transition: 'all 0.2s ease',
                                transform: star <= (hoveredRating || rating) ? 'scale(1.1)' : 'scale(1)',
                            }}
                        >
                            ⭐
                        </button>
                    ))}
                </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '0.75rem',
                }}>
                    Review Title *
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Summarize your experience"
                    maxLength={100}
                    style={{
                        width: '100%',
                        padding: '1rem 1.5rem',
                        fontSize: '1.1rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        background: 'rgba(10, 10, 10, 0.5)',
                        color: '#ffffff',
                        outline: 'none',
                    }}
                />
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '0.75rem',
                }}>
                    Your Review *
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your detailed experience with this app..."
                    rows={6}
                    style={{
                        width: '100%',
                        padding: '1rem 1.5rem',
                        fontSize: '1.05rem',
                        lineHeight: '1.7',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        background: 'rgba(10, 10, 10, 0.5)',
                        color: '#ffffff',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                    }}
                />
            </div>

            {/* Pros */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '0.75rem',
                }}>
                    👍 Pros (Optional)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                        type="text"
                        value={proInput}
                        onChange={(e) => setProInput(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') addPro(); }}
                        placeholder="What did you like?"
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            fontSize: '1rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(10, 10, 10, 0.5)',
                            color: '#ffffff',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={addPro}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                        }}
                    >
                        Add
                    </button>
                </div>
                {pros.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {pros.map(pro => (
                            <span
                                key={pro}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '12px',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    color: '#10b981',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                👍 {pro}
                                <button
                                    onClick={() => setPros(pros.filter(p => p !== pro))}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        padding: 0,
                                        lineHeight: 1,
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Cons */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '0.75rem',
                }}>
                    👎 Cons (Optional)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                        type="text"
                        value={conInput}
                        onChange={(e) => setConInput(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') addCon(); }}
                        placeholder="What could be improved?"
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            fontSize: '1rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(10, 10, 10, 0.5)',
                            color: '#ffffff',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={addCon}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#EF4444',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                        }}
                    >
                        Add
                    </button>
                </div>
                {cons.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {cons.map(con => (
                            <span
                                key={con}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '12px',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: '#EF4444',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                👎 {con}
                                <button
                                    onClick={() => setCons(cons.filter(c => c !== con))}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        padding: 0,
                                        lineHeight: 1,
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Would Recommend */}
            <div style={{ marginBottom: '3rem' }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                }}>
                    <input
                        type="checkbox"
                        checked={wouldRecommend}
                        onChange={(e) => setWouldRecommend(e.target.checked)}
                        style={{
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                        }}
                    />
                    ✅ I would recommend this app
                </label>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1.5rem' }}>
                <button
                    onClick={onCancel}
                    disabled={submitting}
                    style={{
                        flex: 1,
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(107, 114, 128, 0.4)',
                        background: 'rgba(107, 114, 128, 0.2)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting || !title.trim() || !comment.trim()}
                    style={{
                        flex: 1,
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: submitting || !title.trim() || !comment.trim()
                            ? '#6B7280'
                            : 'linear-gradient(135deg, #10b981, #f59e0b)',
                        color: '#ffffff',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        cursor: submitting || !title.trim() || !comment.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: submitting || !title.trim() || !comment.trim()
                            ? 'none'
                            : '0 8px 24px rgba(16, 185, 129, 0.4)',
                    }}
                >
                    {submitting ? '⏳ Submitting...' : '✍️ Submit Review'}
                </button>
            </div>
        </div>
    );
};

// Review Card Component
const ReviewCard: React.FC<{ review: ProjectReview }> = ({ review }) => {
    const { principal } = useAppStore();
    const [votedHelpful, setVotedHelpful] = useState(false);
    const [localHelpfulCount, setLocalHelpfulCount] = useState(review.helpfulCount);

    const handleVoteHelpful = async () => {
        if (votedHelpful) return;

        try {
            await platformCanisterService.voteReviewHelpful(review.reviewId, true);
            setVotedHelpful(true);
            setLocalHelpfulCount(localHelpfulCount + 1);
        } catch (error) {
            console.error('Failed to vote:', error);
        }
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.03))',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '20px',
            padding: '2.5rem',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Side gradient bar */}
            <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                background: 'linear-gradient(180deg, #10b981, #f59e0b)',
            }}></div>

            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.5rem',
            }}>
                <div>
                    {/* Rating */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem' }}>
                        {[...Array(5)].map((_, i) => (
                            <span key={i} style={{
                                color: i < review.rating ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                                fontSize: '1.5rem',
                                filter: i < review.rating ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.5))' : 'none',
                            }}>
                                ⭐
                            </span>
                        ))}
                    </div>

                    {/* Title */}
                    <h4 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '0.5rem',
                    }}>
                        {review.title}
                    </h4>

                    {/* Meta */}
                    <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        fontSize: '0.95rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                    }}>
                        <span>👤 {review.reviewer.substring(0, 10)}...</span>
                        <span>📅 {new Date(Number(review.createdAt) / 1_000_000).toLocaleDateString()}</span>
                        {review.isVerifiedPurchase && (
                            <span style={{ color: '#10b981', fontWeight: '700' }}>
                                ✅ Verified Purchase
                            </span>
                        )}
                    </div>
                </div>

                {/* Recommend Badge */}
                {review.wouldRecommend && (
                    <div style={{
                        padding: '0.75rem 1.25rem',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        fontSize: '0.95rem',
                        fontWeight: '700',
                        color: '#10b981',
                    }}>
                        👍 Recommends
                    </div>
                )}
            </div>

            {/* Comment */}
            <p style={{
                fontSize: '1.05rem',
                lineHeight: '1.8',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '2rem',
            }}>
                {review.comment}
            </p>

            {/* Pros & Cons */}
            {(review.pros.length > 0 || review.cons.length > 0) && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: review.pros.length > 0 && review.cons.length > 0 ? '1fr 1fr' : '1fr',
                    gap: '2rem',
                    marginBottom: '2rem',
                }}>
                    {review.pros.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: '#10b981',
                                marginBottom: '1rem',
                            }}>
                                👍 Pros
                            </div>
                            <ul style={{
                                margin: 0,
                                paddingLeft: '1.5rem',
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: '1rem',
                                lineHeight: '1.8',
                            }}>
                                {review.pros.map((pro, idx) => (
                                    <li key={idx}>{pro}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {review.cons.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: '#EF4444',
                                marginBottom: '1rem',
                            }}>
                                👎 Cons
                            </div>
                            <ul style={{
                                margin: 0,
                                paddingLeft: '1.5rem',
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: '1rem',
                                lineHeight: '1.8',
                            }}>
                                {review.cons.map((con, idx) => (
                                    <li key={idx}>{con}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Helpful Button */}
            <button
                onClick={handleVoteHelpful}
                disabled={votedHelpful}
                style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '12px',
                    border: votedHelpful ? 'none' : '1px solid rgba(16, 185, 129, 0.3)',
                    background: votedHelpful
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(16, 185, 129, 0.1)',
                    color: votedHelpful ? '#10b981' : '#10b981',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: votedHelpful ? 'not-allowed' : 'pointer',
                }}
            >
                {votedHelpful ? '✅ Helpful' : '👍 Helpful'} ({localHelpfulCount})
            </button>

            {/* Seller Response */}
            {review.sellerResponse && (
                <div style={{
                    marginTop: '2rem',
                    padding: '2rem',
                    background: 'rgba(10, 10, 10, 0.5)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '16px',
                }}>
                    <div style={{
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#10b981',
                        marginBottom: '1rem',
                    }}>
                        💬 Seller Response
                    </div>
                    <p style={{
                        fontSize: '1rem',
                        lineHeight: '1.7',
                        color: 'rgba(255, 255, 255, 0.8)',
                        margin: 0,
                    }}>
                        {review.sellerResponse.responseText}
                    </p>
                    <div style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginTop: '1rem',
                    }}>
                        {new Date(Number(review.sellerResponse.respondedAt) / 1_000_000).toLocaleDateString()}
                    </div>
                </div>
            )}
        </div>
    );
};

