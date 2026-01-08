/**
 * Marketplace Admin Manager
 * 
 * Admin interface for managing marketplace listings:
 * - View all listings (including unpublished)
 * - Publish/Unpublish listings
 * - Delete listings (for policy violations, orphaned listings, etc.)
 * - Update listings
 */

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Eye, EyeOff, Trash2, Edit, RefreshCw, Search, Filter } from 'lucide-react';
import { platformCanisterService } from '../services/PlatformCanisterService';
import { useAppStore } from '../store/appStore';

const ADMIN_LISTINGS_PER_PAGE = 50;

export const MarketplaceAdminManager: React.FC = () => {
  const { identity } = useAppStore();
  const [allListings, setAllListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'unpublished' | 'active' | 'inactive'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalListings, setTotalListings] = useState(0);

  // Load all listings (paginated)
  const loadAllListings = async () => {
    if (!identity) {
      setError('Identity not available');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const offset = (currentPage - 1) * ADMIN_LISTINGS_PER_PAGE;
      const result = await platformCanisterService.getAllListingsPaginated(ADMIN_LISTINGS_PER_PAGE, offset);
      if ('ok' in result && result.ok) {
        setAllListings(result.ok.listings);
        setTotalListings(result.ok.total);
        console.log(`✅ [MarketplaceAdminManager] Loaded ${result.ok.listings.length} listings (page ${currentPage})`);
      } else {
        setError(result.err || 'Failed to load listings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  // Load listings on mount and page change
  useEffect(() => {
    if (identity) {
      loadAllListings();
    }
  }, [identity, currentPage]);

  // Handle publish/unpublish
  const handleTogglePublish = async (listingId: string, currentStatus: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = currentStatus
        ? await platformCanisterService.unpublishListing(listingId)
        : await platformCanisterService.publishListing(listingId);

      if ('ok' in result) {
        setSuccess(`✅ Listing ${currentStatus ? 'unpublished' : 'published'} successfully!`);
        await loadAllListings(); // Reload to show updated status
      } else {
        setError(result.err || `Failed to ${currentStatus ? 'unpublish' : 'publish'} listing`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update listing');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (listingId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?\n\nThis action cannot be undone and is for policy violations or orphaned listings.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await platformCanisterService.deleteMarketplaceListing(listingId);
      if ('ok' in result) {
        setSuccess(`✅ Listing deleted successfully!`);
        await loadAllListings(); // Reload to show updated list
      } else {
        setError(result.err || 'Failed to delete listing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete listing');
    } finally {
      setLoading(false);
    }
  };

  // Filter and search listings
  const filteredListings = allListings.filter(listing => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query) ||
        listing.listingId?.toLowerCase().includes(query) ||
        listing.category?.toLowerCase().includes(query) ||
        listing.tags?.some((tag: string) => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status filter
    switch (filterStatus) {
      case 'published':
        return listing.isPublished === true;
      case 'unpublished':
        return listing.isPublished === false;
      case 'active':
        return listing.isActive === true;
      case 'inactive':
        return listing.isActive === false;
      default:
        return true; // 'all'
    }
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(75, 85, 99, 0.5)',
    background: 'rgba(55, 65, 81, 0.5)',
    color: '#ffffff',
    fontSize: '0.9rem',
    marginBottom: '1rem'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  return (
    <div style={{
      background: 'rgb(17, 17, 17)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <ShoppingCart size={28} color="#f97316" />
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0
          }}>
            Marketplace Administration
          </h2>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', margin: 0 }}>
          Manage all marketplace listings, publish/unpublish, and delete listings for policy violations or orphaned content.
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          padding: '1rem',
          background: 'rgba(34, 197, 94, 0.2)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          color: '#4ade80',
          marginBottom: '1rem'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#f87171',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)'
            }} />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: '2.5rem',
                marginBottom: 0
              }}
            />
          </div>
        </div>

        {/* Filter */}
        <div style={{ minWidth: '150px' }}>
          <div style={{ position: 'relative' }}>
            <Filter size={18} style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)',
              zIndex: 1
            }} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{
                ...inputStyle,
                paddingLeft: '2.5rem',
                marginBottom: 0,
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="all">All Listings</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadAllListings}
          disabled={loading}
          style={{
            ...buttonStyle,
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Listings Count */}
      <div style={{
        marginBottom: '1rem',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.9rem'
      }}>
        Showing {filteredListings.length} of {allListings.length} listings on page {currentPage} ({totalListings} total)
      </div>

      {/* Listings List */}
      {loading && allListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block' }} />
          Loading listings...
        </div>
      ) : filteredListings.length === 0 ? (
        <div style={{
          padding: '2rem',
          background: 'rgba(55, 65, 81, 0.3)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          {allListings.length === 0 ? 'No listings found' : 'No listings match your filters'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredListings.map((listing: any) => (
            <div
              key={listing.listingId}
              style={{
                padding: '1.25rem',
                background: 'rgba(55, 65, 81, 0.3)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '1rem',
                    margin: 0,
                    flex: 1,
                    minWidth: '200px'
                  }}>
                    {listing.title || 'Untitled Listing'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {listing.isPublished ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '4px',
                        color: '#4ade80',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        ✅ Published
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '4px',
                        color: '#fbbf24',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        ⏸️ Draft
                      </span>
                    )}
                    {listing.isActive ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '4px',
                        color: '#60a5fa',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        Active
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(107, 114, 128, 0.2)',
                        border: '1px solid rgba(107, 114, 128, 0.3)',
                        borderRadius: '4px',
                        color: '#9ca3af',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.85rem',
                  marginBottom: '0.25rem'
                }}>
                  ID: {listing.listingId}
                </div>
                {listing.description && (
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {listing.description}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.8rem'
                  }}>
                    💰 ${(Number(listing.price || 0) / 100).toFixed(2)}
                  </span>
                  {listing.category && (
                    <span style={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '0.8rem'
                    }}>
                      📁 {listing.category}
                    </span>
                  )}
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.8rem'
                  }}>
                    📊 {Number(listing.totalSales || 0)} sales
                  </span>
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexShrink: 0,
                flexDirection: 'column'
              }}>
                <button
                  onClick={() => handleTogglePublish(listing.listingId, listing.isPublished)}
                  disabled={loading}
                  style={{
                    ...buttonStyle,
                    background: listing.isPublished
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(34, 197, 94, 0.2)',
                    color: listing.isPublished ? '#fbbf24' : '#4ade80',
                    border: `1px solid ${listing.isPublished ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    justifyContent: 'center'
                  }}
                >
                  {listing.isPublished ? (
                    <>
                      <EyeOff size={14} />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye size={14} />
                      Publish
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(listing.listingId, listing.title || 'Untitled')}
                  disabled={loading}
                  style={{
                    ...buttonStyle,
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalListings > ADMIN_LISTINGS_PER_PAGE && (
        <div style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
            style={{
              ...buttonStyle,
              background: currentPage === 1 
                ? 'rgba(75, 85, 99, 0.3)' 
                : 'rgba(16, 185, 129, 0.2)',
              color: currentPage === 1 ? '#6b7280' : '#10b981',
              border: `1px solid ${currentPage === 1 ? 'rgba(75, 85, 99, 0.5)' : 'rgba(16, 185, 129, 0.3)'}`,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            ← Previous
          </button>

          <div style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            fontWeight: '600',
          }}>
            Page {currentPage} of {Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE)}
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginLeft: '0.5rem' }}>
              ({totalListings} total)
            </span>
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE), p + 1))}
            disabled={currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE) || loading}
            style={{
              ...buttonStyle,
              background: currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE)
                ? 'rgba(75, 85, 99, 0.3)'
                : 'rgba(16, 185, 129, 0.2)',
              color: currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE) ? '#6b7280' : '#10b981',
              border: `1px solid ${currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE) ? 'rgba(75, 85, 99, 0.5)' : 'rgba(16, 185, 129, 0.3)'}`,
              cursor: currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE) ? 'not-allowed' : 'pointer',
              opacity: currentPage >= Math.ceil(totalListings / ADMIN_LISTINGS_PER_PAGE) ? 0.5 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

