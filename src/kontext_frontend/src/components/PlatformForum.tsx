/**
 * Platform Forum - Kontext Style
 * Community discussion forum with stunning Kontext design
 */

import React, { useState, useEffect } from 'react';
import { createForumService } from '../services/ForumService';
import { useAppStore } from '../store/appStore';
import type { ForumCategory, ForumThread, ForumReply } from '../types';

interface PlatformForumProps {
  onClose: () => void;
}

type View = 'categories' | 'category' | 'thread';

export const PlatformForum: React.FC<PlatformForumProps> = ({ onClose }) => {
  const { identity, principal } = useAppStore();
  const principalId = principal?.toText();
  const [view, setView] = useState<View>('categories');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    console.log('🔍 [PlatformForum] useEffect running, identity:', identity ? '✅ Available' : '❌ Missing');
    if (identity) {
      loadCategories();
    } else {
      console.warn('⚠️ [PlatformForum] No identity available, cannot load forum');
      setLoading(false);
    }
  }, [identity]);

  const loadCategories = async () => {
    if (!identity) {
      console.warn('⚠️ [PlatformForum] loadCategories called without identity');
      return;
    }

    try {
      console.log('📡 [PlatformForum] Loading categories...');
      setLoading(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      
      const forumService = createForumService(identity, agent);
      console.log('🔧 [PlatformForum] ForumService created, calling getActiveCategories...');
      const cats = await forumService.getActiveCategories();
      console.log('✅ [PlatformForum] Categories loaded:', cats.length, 'categories');
      console.log('📋 [PlatformForum] Categories:', cats);
      setCategories(cats);
    } catch (error) {
      console.error('❌ [PlatformForum] Failed to load categories:', error);
      console.error('❌ [PlatformForum] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = async (category: ForumCategory) => {
    if (!identity) return;

    try {
      setLoading(true);
      setSelectedCategory(category);
      
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      
      // Load first page of threads using pagination
      const THREADS_PER_PAGE = 25;
      const { threads: firstPageThreads, total } = await forumService.getThreadsByCategoryPaginated(
        category.categoryId,
        THREADS_PER_PAGE,
        0
      );
      setThreads(firstPageThreads);
      setView('category');
    } catch (error) {
      console.error('Failed to load threads:', error);
      // Fallback to non-paginated if pagination fails
      try {
        const { HttpAgent } = await import('@dfinity/agent');
        const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
        const forumService = createForumService(identity, agent);
        const categoryThreads = await forumService.getThreadsByCategory(category.categoryId);
        setThreads(categoryThreads);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectThread = async (thread: ForumThread) => {
    if (!identity) return;

    try {
      setLoading(true);
      setSelectedThread(thread);
      
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      
      // Increment view count
      await forumService.incrementThreadViews(thread.threadId);
      
      // Load first page of replies using pagination
      const REPLIES_PER_PAGE = 20;
      const { replies: firstPageReplies, total } = await forumService.getRepliesPaginated(
        thread.threadId,
        REPLIES_PER_PAGE,
        0
      );
      setReplies(firstPageReplies);
      setView('thread');
    } catch (error) {
      console.error('Failed to load thread:', error);
      // Fallback to loading all replies if pagination fails
      try {
        const { HttpAgent } = await import('@dfinity/agent');
        const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
        const forumService = createForumService(identity, agent);
        const allReplies = await forumService.getReplies(thread.threadId);
        setReplies(allReplies);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (view === 'thread') {
      setView('category');
      setSelectedThread(null);
      setReplies([]);
    } else if (view === 'category') {
      setView('categories');
      setSelectedCategory(null);
      setThreads([]);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid rgba(255, 107, 53, 0.2)',
            borderTopColor: '#ff6b35',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 2rem',
          }}></div>
          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem', fontWeight: '600' }}>
            Loading forum...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
      zIndex: 10000,
      overflow: 'auto',
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '3rem',
        minHeight: '100vh',
      }}>
        {/* Header - Kontext Style */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
          flexWrap: 'wrap',
          gap: '2rem',
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.75rem',
              letterSpacing: '-0.02em',
            }}>
              💬 Kontext Community Forum
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
              {view === 'categories' && 'Join the conversation with the Kontext community'}
              {view === 'category' && selectedCategory && `${selectedCategory.name} - ${selectedCategory.description}`}
              {view === 'thread' && selectedThread && selectedThread.title}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Search Bar */}
            {view === 'categories' && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter' && searchQuery.trim() && identity) {
                      try {
                        const { HttpAgent } = await import('@dfinity/agent');
                        const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
                        const forumService = createForumService(identity, agent);
                        const results = await forumService.searchForum(searchQuery);
                        setSearchResults(results);
                        setView('search' as any);
                      } catch (error) {
                        console.error('Search failed:', error);
                        alert('Search failed. Please try again.');
                      }
                    }
                  }}
                  placeholder="🔍 Search forum..."
                  style={{
                    padding: '0.75rem 1.5rem',
                    paddingLeft: '2.5rem',
                    background: 'rgba(10, 10, 10, 0.5)',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    width: '300px',
                    outline: 'none',
                  }}
                />
                <span style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(255, 255, 255, 0.5)',
                }}>🔍</span>
              </div>
            )}
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
        </div>

        {/* Back Button - Kontext Style */}
        {view !== 'categories' && (
          <button
            onClick={handleBack}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 107, 53, 0.1)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              color: '#ff6b35',
              cursor: 'pointer',
              marginBottom: '2rem',
              fontWeight: '700',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
              e.currentTarget.style.borderColor = '#ff6b35';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
            }}
          >
            ← Back
          </button>
        )}

        {/* Content */}
        {view === 'categories' && (
          <CategoryList 
            categories={categories} 
            onSelectCategory={handleSelectCategory}
          />
        )}
        {view === 'category' && selectedCategory && (
          <ThreadList 
            category={selectedCategory}
            threads={threads}
            onSelectThread={handleSelectThread}
            onRefresh={() => handleSelectCategory(selectedCategory)}
          />
        )}
        {view === 'thread' && selectedThread && (
          <ThreadView 
            thread={selectedThread}
            replies={replies}
            onRefresh={() => handleSelectThread(selectedThread)}
          />
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

// ═══════════════════════════════════════════════════════════════════════════
// Category List View - Kontext Style
// ═══════════════════════════════════════════════════════════════════════════

const CategoryList: React.FC<{
  categories: ForumCategory[];
  onSelectCategory: (category: ForumCategory) => void;
}> = ({ categories, onSelectCategory }) => {
  // Empty state - Kontext Style
  if (categories.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '6rem 3rem',
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
        border: '2px dashed rgba(255, 107, 53, 0.3)',
        borderRadius: '24px',
      }}>
        <div style={{ 
          fontSize: '5rem', 
          marginBottom: '2rem',
          filter: 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.3))',
        }}>💬</div>
        <h3 style={{
          fontSize: '2rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
        }}>
          No Categories Yet
        </h3>
        <p style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '1.1rem',
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: '1.6',
        }}>
          The forum is being set up. Categories will appear here once an admin creates them.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      {categories.map((category) => (
        <div
          key={category.categoryId}
          onClick={() => onSelectCategory(category)}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
            border: `2px solid ${category.color}40`,
            borderRadius: '24px',
            padding: '2.5rem',
            cursor: 'pointer',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = category.color;
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.01)';
            e.currentTarget.style.boxShadow = `0 20px 60px ${category.color}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${category.color}40`;
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.1)';
          }}
        >
          {/* Top gradient bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${category.color}, ${category.color}80)`,
          }}></div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
            {/* Category Icon */}
            <div style={{
              fontSize: '4rem',
              lineHeight: 1,
              filter: `drop-shadow(0 4px 8px ${category.color}40)`,
            }}>
              {category.icon}
            </div>

            {/* Category Info */}
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: category.color,
                marginBottom: '1rem',
                textShadow: `0 0 20px ${category.color}30`,
              }}>
                {category.name}
              </h3>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
              }}>
                {category.description}
              </p>
              <div style={{
                display: 'flex',
                gap: '2.5rem',
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: '600',
              }}>
                <span>📝 {category.threadCount} threads</span>
                <span>💬 {category.postCount} posts</span>
              </div>
            </div>

            {/* Latest Activity */}
            {category.lastThreadTitle && (
              <div style={{
                padding: '1.5rem',
                background: 'rgba(10, 10, 10, 0.5)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                minWidth: '280px',
                border: '1px solid rgba(255, 107, 53, 0.2)',
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                }}>
                  Latest:
                </div>
                <div style={{
                  color: '#ffffff',
                  fontSize: '1rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {category.lastThreadTitle}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Thread List View - Kontext Style
// ═══════════════════════════════════════════════════════════════════════════

const ThreadList: React.FC<{
  category: ForumCategory;
  threads: ForumThread[];
  onSelectThread: (thread: ForumThread) => void;
  onRefresh: () => void;
}> = ({ category, threads: initialThreads, onSelectThread, onRefresh }) => {
  const { identity } = useAppStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [threads, setThreads] = useState<ForumThread[]>(initialThreads);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalThreads, setTotalThreads] = useState(category.threadCount || initialThreads.length);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const THREADS_PER_PAGE = 25;

  // Load paginated threads
  const loadThreads = async (page: number = 1) => {
    if (!identity) return;
    try {
      setLoadingThreads(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      const offset = (page - 1) * THREADS_PER_PAGE;
      const { threads: newThreads, total } = await forumService.getThreadsByCategoryPaginated(
        category.categoryId,
        THREADS_PER_PAGE,
        offset
      );
      setThreads(newThreads);
      setTotalThreads(total);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setLoadingThreads(false);
    }
  };

  // Reload threads when category changes
  useEffect(() => {
    if (category.categoryId) {
      loadThreads(1);
    }
  }, [category.categoryId]);

  const totalPages = Math.ceil(totalThreads / THREADS_PER_PAGE);

  return (
    <div>
      {/* Create Thread Button - Kontext Style */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            padding: '1rem 2.5rem',
            background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '1.05rem',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255, 107, 53, 0.4)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 107, 53, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.4)';
          }}
        >
          ✏️ New Thread
        </button>
      </div>

      {/* Thread List - Kontext Style */}
      {loadingThreads && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Loading threads...
        </div>
      )}
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {threads.map((thread) => (
          <div
            key={thread.threadId}
            onClick={() => onSelectThread(thread)}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: '20px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(255, 107, 53, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
              e.currentTarget.style.transform = 'translateX(8px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 107, 53, 0.1)';
            }}
          >
            {/* Side gradient accent */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              background: 'linear-gradient(180deg, #ff6b35, #f59e0b)',
            }}></div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', paddingLeft: '0.5rem' }}>
              {thread.isPinned && (
                <span style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: '#F59E0B',
                }}>
                  📌 Pinned
                </span>
              )}
              {thread.isLocked && (
                <span style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: '#EF4444',
                }}>
                  🔒 Locked
                </span>
              )}
              {thread.hasAcceptedAnswer && (
                <span style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: '#10b981',
                }}>
                  ✓ Solved
                </span>
              )}
            </div>

            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '1rem',
              paddingLeft: '0.5rem',
            }}>
              {thread.title}
            </h3>

            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.6',
              paddingLeft: '0.5rem',
            }}>
              {thread.content}
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.5rem',
              paddingLeft: '0.5rem',
            }}>
              <div style={{
                display: 'flex',
                gap: '2rem',
                fontSize: '0.95rem',
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: '600',
              }}>
                <span>👤 {thread.authorName}</span>
                <span>💬 {thread.replyCount}</span>
                <span>👁️ {thread.viewCount}</span>
                <span>👍 {thread.upvotes}</span>
              </div>
              {thread.lastReplyByName && (
                <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Last: {thread.lastReplyByName}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {threads.length === 0 && !loadingThreads && (
        <div style={{
          textAlign: 'center',
          padding: '5rem 3rem',
          background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
          border: '1px solid rgba(255, 107, 53, 0.2)',
          borderRadius: '24px',
        }}>
          <div style={{ 
            fontSize: '4rem', 
            marginBottom: '1.5rem',
            filter: 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.3))',
          }}>💬</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.75rem' }}>
            No threads yet
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem' }}>
            Be the first to start a discussion!
          </div>
        </div>
      )}

      {/* Thread Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'rgba(10, 10, 10, 0.3)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 107, 53, 0.2)',
        }}>
          <button
            onClick={() => loadThreads(currentPage - 1)}
            disabled={currentPage === 1 || loadingThreads}
            style={{
              padding: '0.75rem 1.5rem',
              background: currentPage === 1 ? 'rgba(107, 114, 128, 0.2)' : 'rgba(255, 107, 53, 0.2)',
              border: `1px solid ${currentPage === 1 ? 'rgba(107, 114, 128, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
              borderRadius: '8px',
              color: currentPage === 1 ? 'rgba(255, 255, 255, 0.4)' : '#ff6b35',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            ← Previous
          </button>
          
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
          }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => loadThreads(pageNum)}
                  disabled={loadingThreads}
                  style={{
                    padding: '0.75rem 1rem',
                    background: currentPage === pageNum 
                      ? 'linear-gradient(135deg, #ff6b35, #f59e0b)' 
                      : 'rgba(255, 107, 53, 0.1)',
                    border: `1px solid ${currentPage === pageNum ? 'rgba(255, 107, 53, 0.5)' : 'rgba(255, 107, 53, 0.3)'}`,
                    borderRadius: '8px',
                    color: currentPage === pageNum ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                    cursor: loadingThreads ? 'not-allowed' : 'pointer',
                    fontWeight: currentPage === pageNum ? '700' : '600',
                    fontSize: '0.95rem',
                    minWidth: '40px',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => loadThreads(currentPage + 1)}
            disabled={currentPage === totalPages || loadingThreads}
            style={{
              padding: '0.75rem 1.5rem',
              background: currentPage === totalPages ? 'rgba(107, 114, 128, 0.2)' : 'rgba(255, 107, 53, 0.2)',
              border: `1px solid ${currentPage === totalPages ? 'rgba(107, 114, 128, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
              borderRadius: '8px',
              color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.4)' : '#ff6b35',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            Next →
          </button>
        </div>
      )}

      {showCreateDialog && (
        <CreateThreadDialog
          categoryId={category.categoryId}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            loadThreads(currentPage); // Reload current page
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Thread View (Full Thread with Replies) - Kontext Style
// ═══════════════════════════════════════════════════════════════════════════

const ThreadView: React.FC<{
  thread: ForumThread;
  replies: ForumReply[];
  onRefresh: () => void;
}> = ({ thread, replies: initialReplies, onRefresh }) => {
  const { identity, principal } = useAppStore();
  const principalId = principal?.toText();
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingThread, setEditingThread] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editThreadTitle, setEditThreadTitle] = useState(thread.title);
  const [editThreadContent, setEditThreadContent] = useState(thread.content);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [voting, setVoting] = useState<{ threadId?: string; replyId?: string }>({});
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Pagination state
  const [replies, setReplies] = useState<ForumReply[]>(initialReplies);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReplies, setTotalReplies] = useState(thread.replyCount || initialReplies.length);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const REPLIES_PER_PAGE = 20;

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!identity) {
        setIsAdmin(false);
        return;
      }
      try {
        const { PlatformCanisterService } = await import('../services/PlatformCanisterService');
        const platformService = PlatformCanisterService.createWithIdentity(identity);
        await platformService.initialize();
        const adminStatus = await platformService.isAdmin();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [identity]);

  // Load paginated replies
  const loadReplies = async (page: number = 1) => {
    if (!identity) return;
    try {
      setLoadingReplies(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      const offset = (page - 1) * REPLIES_PER_PAGE;
      const { replies: newReplies, total } = await forumService.getRepliesPaginated(
        thread.threadId,
        REPLIES_PER_PAGE,
        offset
      );
      setReplies(newReplies);
      setTotalReplies(total);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load replies:', error);
      // Fallback to loading all replies if pagination fails
      try {
        const { HttpAgent } = await import('@dfinity/agent');
        const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
        const forumService = createForumService(identity, agent);
        const allReplies = await forumService.getReplies(thread.threadId);
        setReplies(allReplies);
        setTotalReplies(allReplies.length);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoadingReplies(false);
    }
  };

  // Initialize: Load first page if we have more than one page worth of replies
  useEffect(() => {
    if (thread.threadId) {
      // Always load first page to get accurate total count
      // This ensures pagination works correctly even if initialReplies was passed
      loadReplies(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.threadId]);

  const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

  const handleSubmitReply = async () => {
    if (!identity || !replyText.trim()) return;

    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.createReply(thread.threadId, replyText);
      setReplyText('');
      alert('✅ Reply posted!');
      // Reload replies to show the new one (go to last page if there are multiple pages)
      const newTotalPages = Math.ceil((totalReplies + 1) / REPLIES_PER_PAGE);
      loadReplies(newTotalPages > 0 ? newTotalPages : 1);
      onRefresh();
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('❌ Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteThread = async (voteType: 'upvote' | 'downvote') => {
    if (!identity) return;
    try {
      setVoting({ threadId: thread.threadId });
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.voteOnThread(thread.threadId, voteType);
      loadReplies(currentPage); // Reload to update vote counts
      onRefresh();
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('❌ Failed to vote. Please try again.');
    } finally {
      setVoting({});
    }
  };

  const handleVoteReply = async (replyId: string, voteType: 'upvote' | 'downvote') => {
    if (!identity) return;
    try {
      setVoting({ replyId });
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.voteOnReply(thread.threadId, replyId, voteType);
      loadReplies(currentPage); // Reload to update vote counts
      onRefresh();
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('❌ Failed to vote. Please try again.');
    } finally {
      setVoting({});
    }
  };

  const handleEditThread = async () => {
    if (!identity) return;
    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.updateThread(thread.threadId, {
        title: editThreadTitle,
        content: editThreadContent
      });
      setEditingThread(false);
      alert('✅ Thread updated!');
      onRefresh();
    } catch (error) {
      console.error('Failed to update thread:', error);
      alert('❌ Failed to update thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!identity || !confirm('Are you sure you want to delete this thread?')) return;
    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.deleteThread(thread.threadId);
      alert('✅ Thread deleted!');
      // Navigate back to category
      window.location.reload(); // Simple way to go back
    } catch (error) {
      console.error('Failed to delete thread:', error);
      alert('❌ Failed to delete thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReply = async (replyId: string) => {
    if (!identity || !editReplyContent.trim()) return;
    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.updateReply(thread.threadId, replyId, editReplyContent);
      setEditingReplyId(null);
      setEditReplyContent('');
      alert('✅ Reply updated!');
      loadReplies(currentPage); // Reload current page
      onRefresh();
    } catch (error) {
      console.error('Failed to update reply:', error);
      alert('❌ Failed to update reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!identity || !confirm('Are you sure you want to delete this reply?')) return;
    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.deleteReply(thread.threadId, replyId);
      alert('✅ Reply deleted!');
      loadReplies(currentPage); // Reload current page
      onRefresh();
    } catch (error) {
      console.error('Failed to delete reply:', error);
      alert('❌ Failed to delete reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAccepted = async (replyId: string) => {
    if (!identity) return;
    try {
      setSubmitting(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      await forumService.markAcceptedAnswer(thread.threadId, replyId);
      alert('✅ Marked as accepted answer!');
      loadReplies(currentPage); // Reload current page
      onRefresh();
    } catch (error) {
      console.error('Failed to mark accepted answer:', error);
      alert('❌ Failed to mark accepted answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isThreadAuthor = principalId === thread.author;
  const isReplyAuthor = (replyAuthor: string) => principalId === replyAuthor;
  const canEditThread = isThreadAuthor || isAdmin;
  const canDeleteThread = isThreadAuthor || isAdmin;
  const canEditReply = (replyAuthor: string) => isReplyAuthor(replyAuthor) || isAdmin;
  const canDeleteReply = (replyAuthor: string) => isReplyAuthor(replyAuthor) || isAdmin;

  return (
    <div>
      {/* Original Post - Kontext Style */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
        border: '2px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '24px',
        padding: '3rem',
        marginBottom: '3rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(255, 107, 53, 0.15)',
      }}>
        {/* Top gradient bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ff6b35, #f59e0b, #10b981)',
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#ffffff',
            lineHeight: '1.3',
            flex: 1,
            margin: 0,
          }}>
            {editingThread ? (
              <input
                type="text"
                value={editThreadTitle}
                onChange={(e) => setEditThreadTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(10, 10, 10, 0.5)',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '2rem',
                  fontWeight: '700',
                }}
              />
            ) : (
              thread.title
            )}
          </h2>
          {canEditThread && !editingThread && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {isAdmin && !isThreadAuthor && (
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: 'rgba(168, 85, 247, 0.2)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '6px',
                  color: '#a855f7',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  marginRight: '0.5rem',
                }}>
                  👑 Admin
                </span>
              )}
              {isThreadAuthor && (
                <button
                  onClick={() => setEditingThread(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '8px',
                    color: '#10b981',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                  }}
                >
                  ✏️ Edit
                </button>
              )}
              <button
                onClick={handleDeleteThread}
                disabled={submitting}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#EF4444',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                🗑️ {isAdmin && !isThreadAuthor ? 'Delete (Admin)' : 'Delete'}
              </button>
            </div>
          )}
        </div>
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '2rem',
          fontSize: '1rem',
          color: 'rgba(255, 255, 255, 0.6)',
          fontWeight: '600',
          alignItems: 'center',
        }}>
          <span>👤 {thread.authorName}</span>
          <span>•</span>
          <span>📅 {new Date(Number(thread.createdAt) / 1_000_000).toLocaleString()}</span>
          <span>•</span>
          <span>👁️ {thread.viewCount} views</span>
          {/* Voting buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button
              onClick={() => handleVoteThread('upvote')}
              disabled={!identity || !!voting.threadId}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                color: '#10b981',
                cursor: (!identity || !!voting.threadId) ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                opacity: (!identity || !!voting.threadId) ? 0.5 : 1,
              }}
            >
              👍 {thread.upvotes}
            </button>
            <button
              onClick={() => handleVoteThread('downvote')}
              disabled={!identity || !!voting.threadId}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#EF4444',
                cursor: (!identity || !!voting.threadId) ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                opacity: (!identity || !!voting.threadId) ? 0.5 : 1,
              }}
            >
              👎 {thread.downvotes}
            </button>
          </div>
        </div>
        {editingThread ? (
          <div>
            <textarea
              value={editThreadContent}
              onChange={(e) => setEditThreadContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '1rem',
                background: 'rgba(10, 10, 10, 0.5)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '1.1rem',
                lineHeight: 1.8,
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleEditThread}
                disabled={submitting || !editThreadTitle.trim() || !editThreadContent.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (submitting || !editThreadTitle.trim() || !editThreadContent.trim()) ? '#6B7280' : 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: (submitting || !editThreadTitle.trim() || !editThreadContent.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                💾 Save
              </button>
              <button
                onClick={() => {
                  setEditingThread(false);
                  setEditThreadTitle(thread.title);
                  setEditThreadContent(thread.content);
                }}
                disabled={submitting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.4)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '1.1rem',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}>
            {thread.content}
          </div>
        )}
      </div>

      {/* Replies - Kontext Style */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{
            fontSize: '2rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            💬 {totalReplies} {totalReplies === 1 ? 'Reply' : 'Replies'}
            {totalReplies > REPLIES_PER_PAGE && (
              <span style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.6)', marginLeft: '1rem' }}>
                (Showing {((currentPage - 1) * REPLIES_PER_PAGE) + 1}-{Math.min(currentPage * REPLIES_PER_PAGE, totalReplies)})
              </span>
            )}
          </h3>
        </div>
        {loadingReplies && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Loading replies...
          </div>
        )}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {replies.map((reply) => (
            <div
              key={reply.replyId}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                borderRadius: '20px',
                padding: '2rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(255, 107, 53, 0.1)',
              }}
            >
              {/* Side gradient accent */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '3px',
                background: 'linear-gradient(180deg, #10b981, #059669)',
              }}></div>

              {reply.isAcceptedAnswer && (
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: '#10b981',
                }}>
                  ✓ Accepted Answer
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingLeft: '0.5rem',
              }}>
                <div style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.95rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                }}>
                  <span>👤 {reply.authorName}</span>
                  <span>•</span>
                  <span>📅 {new Date(Number(reply.createdAt) / 1_000_000).toLocaleString()}</span>
                  {reply.isEdited && <span>• ✏️ Edited</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Voting buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleVoteReply(reply.replyId, 'upvote')}
                      disabled={!identity || !!voting.replyId}
                      style={{
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '6px',
                        color: '#10b981',
                        cursor: (!identity || !!voting.replyId) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        opacity: (!identity || !!voting.replyId) ? 0.5 : 1,
                      }}
                    >
                      👍 {reply.upvotes}
                    </button>
                    <button
                      onClick={() => handleVoteReply(reply.replyId, 'downvote')}
                      disabled={!identity || !!voting.replyId}
                      style={{
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '6px',
                        color: '#EF4444',
                        cursor: (!identity || !!voting.replyId) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        opacity: (!identity || !!voting.replyId) ? 0.5 : 1,
                      }}
                    >
                      👎 {reply.downvotes}
                    </button>
                  </div>
                  {/* Mark accepted answer (thread author only) */}
                  {isThreadAuthor && !thread.hasAcceptedAnswer && !reply.isDeleted && (
                    <button
                      onClick={() => handleMarkAccepted(reply.replyId)}
                      disabled={submitting}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '6px',
                        color: '#10b981',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      ✓ Accept
                    </button>
                  )}
                  {/* Edit/Delete buttons (reply author or admin) */}
                  {canEditReply(reply.author) && !reply.isDeleted && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isAdmin && !isReplyAuthor(reply.author) && (
                        <span style={{
                          padding: '0.2rem 0.4rem',
                          background: 'rgba(168, 85, 247, 0.2)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          borderRadius: '4px',
                          color: '#a855f7',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          marginRight: '0.25rem',
                        }}>
                          👑
                        </span>
                      )}
                      {isReplyAuthor(reply.author) && (
                        <button
                          onClick={() => {
                            setEditingReplyId(reply.replyId);
                            setEditReplyContent(reply.content);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '6px',
                            color: '#10b981',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                          }}
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteReply(reply.replyId)}
                        disabled={submitting}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '6px',
                          color: '#EF4444',
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          opacity: submitting ? 0.5 : 1,
                        }}
                        title={isAdmin && !isReplyAuthor(reply.author) ? 'Delete as Admin' : 'Delete'}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {editingReplyId === reply.replyId ? (
                <div style={{ paddingLeft: '0.5rem' }}>
                  <textarea
                    value={editReplyContent}
                    onChange={(e) => setEditReplyContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '1rem',
                      background: 'rgba(10, 10, 10, 0.5)',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '1rem',
                      lineHeight: 1.7,
                      marginBottom: '1rem',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => handleEditReply(reply.replyId)}
                      disabled={submitting || !editReplyContent.trim()}
                      style={{
                        padding: '0.5rem 1rem',
                        background: (submitting || !editReplyContent.trim()) ? '#6B7280' : 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        cursor: (submitting || !editReplyContent.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                      }}
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingReplyId(null);
                        setEditReplyContent('');
                      }}
                      disabled={submitting}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(107, 114, 128, 0.2)',
                        border: '1px solid rgba(107, 114, 128, 0.4)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  color: reply.isDeleted ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: '1.05rem',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  paddingLeft: '0.5rem',
                  fontStyle: reply.isDeleted ? 'italic' : 'normal',
                }}>
                  {reply.content}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'rgba(10, 10, 10, 0.3)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 107, 53, 0.2)',
          }}>
            <button
              onClick={() => loadReplies(currentPage - 1)}
              disabled={currentPage === 1 || loadingReplies}
              style={{
                padding: '0.75rem 1.5rem',
                background: currentPage === 1 ? 'rgba(107, 114, 128, 0.2)' : 'rgba(255, 107, 53, 0.2)',
                border: `1px solid ${currentPage === 1 ? 'rgba(107, 114, 128, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
                borderRadius: '8px',
                color: currentPage === 1 ? 'rgba(255, 255, 255, 0.4)' : '#ff6b35',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem',
              }}
            >
              ← Previous
            </button>
            
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => loadReplies(pageNum)}
                    disabled={loadingReplies}
                    style={{
                      padding: '0.75rem 1rem',
                      background: currentPage === pageNum 
                        ? 'linear-gradient(135deg, #ff6b35, #f59e0b)' 
                        : 'rgba(255, 107, 53, 0.1)',
                      border: `1px solid ${currentPage === pageNum ? 'rgba(255, 107, 53, 0.5)' : 'rgba(255, 107, 53, 0.3)'}`,
                      borderRadius: '8px',
                      color: currentPage === pageNum ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                      cursor: loadingReplies ? 'not-allowed' : 'pointer',
                      fontWeight: currentPage === pageNum ? '700' : '600',
                      fontSize: '0.95rem',
                      minWidth: '40px',
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => loadReplies(currentPage + 1)}
              disabled={currentPage === totalPages || loadingReplies}
              style={{
                padding: '0.75rem 1.5rem',
                background: currentPage === totalPages ? 'rgba(107, 114, 128, 0.2)' : 'rgba(255, 107, 53, 0.2)',
                border: `1px solid ${currentPage === totalPages ? 'rgba(107, 114, 128, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
                borderRadius: '8px',
                color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.4)' : '#ff6b35',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Reply Box - Kontext Style */}
      {!thread.isLocked && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          borderRadius: '20px',
          padding: '2.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(255, 107, 53, 0.15)',
        }}>
          {/* Top gradient bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #ff6b35, #10b981)',
          }}></div>

          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '1.5rem',
          }}>
            ✍️ Post a Reply
          </h3>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Share your thoughts..."
            style={{
              width: '100%',
              minHeight: '140px',
              padding: '1.5rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '16px',
              color: '#ffffff',
              fontSize: '1.05rem',
              resize: 'vertical',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#ff6b35';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleSubmitReply}
            disabled={submitting || !replyText.trim()}
            style={{
              padding: '1rem 2.5rem',
              background: (submitting || !replyText.trim()) ? '#6B7280' : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '1.05rem',
              cursor: (submitting || !replyText.trim()) ? 'not-allowed' : 'pointer',
              opacity: (submitting || !replyText.trim()) ? 0.5 : 1,
              boxShadow: (submitting || !replyText.trim()) ? 'none' : '0 8px 24px rgba(255, 107, 53, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting && replyText.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 107, 53, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting && replyText.trim()) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.4)';
              }
            }}
          >
            {submitting ? '⏳ Posting...' : '📤 Post Reply'}
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Create Thread Dialog - Kontext Style
// ═══════════════════════════════════════════════════════════════════════════

const CreateThreadDialog: React.FC<{
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ categoryId, onClose, onSuccess }) => {
  const { identity } = useAppStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    console.log('🚀 [CreateThread] handleSubmit called');
    console.log('🔍 [CreateThread] Validation:', {
      hasIdentity: !!identity,
      title: title.trim(),
      content: content.trim(),
      categoryId
    });

    if (!identity || !title.trim() || !content.trim()) {
      console.warn('⚠️ [CreateThread] Validation failed, not proceeding');
      return;
    }

    try {
      setSubmitting(true);
      console.log('📡 [CreateThread] Creating agent and forum service...');
      
      // Create agent dynamically (same pattern as other forum operations)
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);
      
      console.log('✏️ [CreateThread] Calling createThread with:', { categoryId, title, tagsCount: tags.length });
      await forumService.createThread(categoryId, title, content, tags);
      console.log('✅ [CreateThread] Thread created successfully!');
      alert('✅ Thread created successfully!');
      onSuccess();
    } catch (error) {
      console.error('❌ [CreateThread] Failed to create thread:', error);
      console.error('❌ [CreateThread] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      alert('❌ Failed to create thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
      padding: '2rem',
    }}>
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
        border: '2px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(255, 107, 53, 0.3)',
      }}>
        {/* Top gradient bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ff6b35, #f59e0b, #10b981)',
        }}></div>

        <h3 style={{
          fontSize: '2rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '2rem',
        }}>
          ✏️ Create New Thread
        </h3>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '700' }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your thread a clear, descriptive title"
            style={{
              width: '100%',
              padding: '1.25rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1.05rem',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#ff6b35';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '700' }}>
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your question, idea, or feedback..."
            style={{
              width: '100%',
              minHeight: '220px',
              padding: '1.25rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1.05rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#ff6b35';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '700' }}>
            Tags (optional)
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleAddTag(); }}
              placeholder="Add a tag"
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'rgba(10, 10, 10, 0.5)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddTag}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                color: '#10b981',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '700',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
              }}
            >
              Add
            </button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '1.2rem',
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

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '1rem 2.5rem',
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.4)',
              borderRadius: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '1rem',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            style={{
              padding: '1rem 2.5rem',
              background: (submitting || !title.trim() || !content.trim()) ? '#6B7280' : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: (submitting || !title.trim() || !content.trim()) ? 'not-allowed' : 'pointer',
              opacity: (submitting || !title.trim() || !content.trim()) ? 0.5 : 1,
              boxShadow: (submitting || !title.trim() || !content.trim()) ? 'none' : '0 8px 24px rgba(255, 107, 53, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting && title.trim() && content.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 107, 53, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting && title.trim() && content.trim()) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.4)';
              }
            }}
          >
            {submitting ? '⏳ Creating...' : '✏️ Create Thread'}
          </button>
        </div>
      </div>
    </div>
  );
};
