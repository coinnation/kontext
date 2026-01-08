/**
 * Discussion Forum - Kontext Style
 * Community Q&A and discussions with stunning Kontext design
 */

import React, { useState, useEffect } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { Discussion, Reply } from '../../types';

interface DiscussionForumProps {
  courseId?: string;
  lessonId?: string;
  programId?: string;
}

export const DiscussionForum: React.FC<DiscussionForumProps> = ({
  courseId,
  lessonId,
  programId,
}) => {
  const { identity, agent, principalId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'solved'>('recent');
  const [filterTag, setFilterTag] = useState<string>('all');

  useEffect(() => {
    loadDiscussions();
  }, [courseId, lessonId, programId]);

  const loadDiscussions = async () => {
    if (!identity || !agent) return;

    try {
      setLoading(true);
      const universityService = createUniversityService(identity, agent);
      const discussionsData = await universityService.getDiscussions(courseId, lessonId, programId);
      setDiscussions(discussionsData);
    } catch (error) {
      console.error('Failed to load discussions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDiscussion = async (discussion: Discussion) => {
    setSelectedDiscussion(discussion);
    
    if (!identity || !agent) return;
    try {
      const universityService = createUniversityService(identity, agent);
      const repliesData = await universityService.getReplies(discussion.discussionId);
      setReplies(repliesData);
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
  };

  const getSortedDiscussions = () => {
    let filtered = discussions;
    
    // Filter by tag
    if (filterTag !== 'all') {
      filtered = discussions.filter(d => d.tags.includes(filterTag));
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        return [...filtered].sort((a, b) => b.upvotes - a.upvotes);
      case 'solved':
        return [...filtered].sort((a, b) => (b.isSolved ? 1 : 0) - (a.isSolved ? 1 : 0));
      case 'recent':
      default:
        return [...filtered].sort((a, b) => Number(b.createdAt - a.createdAt));
    }
  };

  const getAllTags = () => {
    const tagsSet = new Set<string>();
    discussions.forEach(d => d.tags.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255, 255, 255, 0.7)' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(168, 85, 247, 0.2)',
          borderTopColor: '#a855f7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem',
        }}></div>
        <div style={{ fontSize: '1.2rem' }}>Loading discussions...</div>
      </div>
    );
  }

  if (selectedDiscussion) {
    return <DiscussionThread discussion={selectedDiscussion} replies={replies} onBack={() => setSelectedDiscussion(null)} />;
  }

  const sortedDiscussions = getSortedDiscussions();
  const allTags = getAllTags();

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
      border: '1px solid rgba(168, 85, 247, 0.2)',
      borderRadius: '24px',
      padding: '3rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
    }}>
      {/* Top gradient bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #a855f7, #f59e0b, #10b981)',
      }}></div>

      {/* Header - Kontext Style */}
      <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <h2 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '700',
          background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span>💬</span>
          <span>Discussions</span>
        </h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            padding: '1rem 2.5rem',
            background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: '700',
            boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(168, 85, 247, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(168, 85, 247, 0.4)';
          }}
        >
          + New Discussion
        </button>
      </div>

      {/* Filters - Kontext Style */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Sort */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', fontWeight: '600' }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              outline: 'none',
            }}
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
            <option value="solved">Solved</option>
          </select>
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', fontWeight: '600' }}>Tags:</span>
            <button
              onClick={() => setFilterTag('all')}
              style={{
                padding: '0.75rem 1.5rem',
                background: filterTag === 'all' 
                  ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))' 
                  : 'rgba(168, 85, 247, 0.1)',
                border: `1px solid ${filterTag === 'all' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.2)'}`,
                borderRadius: '12px',
                color: '#a855f7',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '700',
                transition: 'all 0.3s ease',
              }}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: filterTag === tag 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))' 
                    : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${filterTag === tag ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.2)'}`,
                  borderRadius: '12px',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  transition: 'all 0.3s ease',
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Discussion List - Kontext Style */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sortedDiscussions.map(discussion => (
          <div
            key={discussion.discussionId}
            onClick={() => handleSelectDiscussion(discussion)}
            className="kontext-discussion-card"
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
              border: `2px solid ${discussion.isSolved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.2)'}`,
              borderRadius: '20px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.5s ease',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(12px) scale(1.01)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.2)';
              e.currentTarget.style.borderColor = discussion.isSolved ? 'rgba(16, 185, 129, 0.6)' : 'rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.1)';
              e.currentTarget.style.borderColor = discussion.isSolved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.2)';
            }}
          >
            {/* Side gradient accent */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              background: discussion.isSolved 
                ? 'linear-gradient(180deg, #10b981, #059669)'
                : 'linear-gradient(180deg, #a855f7, #f59e0b)',
            }}></div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'start' }}>
              {/* Upvotes - Kontext Style */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '70px',
                padding: '1rem',
                background: 'rgba(168, 85, 247, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 2px 4px rgba(168, 85, 247, 0.3))' }}>⬆️</div>
                <div style={{ 
                  color: '#a855f7', 
                  fontWeight: '700', 
                  fontSize: '1.5rem',
                  textShadow: '0 0 10px rgba(168, 85, 247, 0.3)',
                }}>
                  {discussion.upvotes}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {discussion.isPinned && (
                    <span style={{
                      padding: '0.75rem 1.25rem',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      📌 Pinned
                    </span>
                  )}
                  {discussion.isSolved && (
                    <span style={{
                      padding: '0.75rem 1.25rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      ✓ Solved
                    </span>
                  )}
                  {discussion.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#10b981',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', lineHeight: '1.4' }}>
                  {discussion.title}
                </h3>

                <p style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1.05rem',
                  marginBottom: '1.5rem',
                  lineHeight: '1.6',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {discussion.content}
                </p>

                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  <span>👤 {discussion.authorName}</span>
                  <span>💬 {discussion.replyCount} replies</span>
                  <span>👁️ {discussion.viewCount} views</span>
                  <span>📅 {new Date(Number(discussion.createdAt) / 1_000_000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {sortedDiscussions.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '5rem',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
            border: '1px solid rgba(168, 85, 247, 0.1)',
            borderRadius: '24px',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>💬</div>
            <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem' }}>
              No discussions yet. Be the first to start one!
            </div>
          </div>
        )}
      </div>

      {/* Create Discussion Dialog */}
      {showCreateDialog && (
        <CreateDiscussionDialog
          courseId={courseId}
          lessonId={lessonId}
          programId={programId}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            loadDiscussions();
          }}
        />
      )}

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Discussion Thread Component - Kontext Style
const DiscussionThread: React.FC<{ discussion: Discussion; replies: Reply[]; onBack: () => void }> = ({
  discussion,
  replies,
  onBack,
}) => {
  const { identity, agent, principalId } = useAppStore();
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!identity || !agent || !principalId || !replyText.trim()) return;

    try {
      setSubmitting(true);
      const universityService = createUniversityService(identity, agent);
      await universityService.replyToDiscussion(
        discussion.discussionId,
        principalId, // authorName would be looked up
        replyText,
        false // isInstructorReply
      );
      setReplyText('');
      alert('✅ Reply posted!');
      // Reload replies
      window.location.reload();
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('❌ Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
      border: '1px solid rgba(168, 85, 247, 0.2)',
      borderRadius: '24px',
      padding: '3rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
    }}>
      {/* Top gradient bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #a855f7, #f59e0b, #10b981)',
      }}></div>

      {/* Back Button - Kontext Style */}
      <button
        onClick={onBack}
        style={{
          padding: '0.75rem 1.5rem',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '12px',
          color: '#a855f7',
          cursor: 'pointer',
          marginBottom: '2.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
          e.currentTarget.style.borderColor = '#a855f7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
        }}
      >
        ← Back to Discussions
      </button>

      {/* Original Post - Kontext Style */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
        border: '2px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '20px',
        padding: '3rem',
        marginBottom: '3rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
      }}>
        {/* Side gradient accent */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          background: 'linear-gradient(180deg, #a855f7, #f59e0b, #10b981)',
        }}></div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {discussion.isPinned && (
            <span style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#f59e0b',
            }}>
              📌 Pinned
            </span>
          )}
          {discussion.isSolved && (
            <span style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#10b981',
            }}>
              ✓ Solved
            </span>
          )}
        </div>

        <h2 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '700', 
          color: '#ffffff', 
          marginBottom: '1.5rem',
          lineHeight: '1.3',
        }}>
          {discussion.title}
        </h2>

        <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '2rem', whiteSpace: 'pre-wrap' }}>
          {discussion.content}
        </p>

        <div style={{ display: 'flex', gap: '2rem', fontSize: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>
          <span>👤 {discussion.authorName}</span>
          <span>📅 {new Date(Number(discussion.createdAt) / 1_000_000).toLocaleString()}</span>
          <span>⬆️ {discussion.upvotes} upvotes</span>
          <span>👁️ {discussion.viewCount} views</span>
        </div>
      </div>

      {/* Replies - Kontext Style */}
      <h3 style={{ 
        fontSize: '2rem', 
        fontWeight: '700',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '2rem',
      }}>
        💬 {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
        {replies.map(reply => (
          <div
            key={reply.replyId}
            style={{
              background: reply.isAcceptedAnswer 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))' 
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
              border: `2px solid ${reply.isAcceptedAnswer ? 'rgba(16, 185, 129, 0.5)' : 'rgba(168, 85, 247, 0.2)'}`,
              borderRadius: '20px',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: reply.isAcceptedAnswer 
                ? '0 8px 32px rgba(16, 185, 129, 0.15)'
                : '0 8px 32px rgba(168, 85, 247, 0.05)',
            }}
          >
            {/* Side gradient accent */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              background: reply.isAcceptedAnswer 
                ? 'linear-gradient(180deg, #10b981, #059669)'
                : 'linear-gradient(180deg, #a855f7, #f59e0b)',
            }}></div>

            {reply.isAcceptedAnswer && (
              <div style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '1rem',
                fontWeight: '700',
                color: '#10b981',
              }}>
                ✓ Accepted Answer
              </div>
            )}

            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.05rem', lineHeight: '1.7', marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
              {reply.content}
            </p>

            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)', alignItems: 'center' }}>
              <span style={{ fontWeight: '600' }}>
                {reply.isInstructorReply && '🎓 '}
                {reply.authorName}
              </span>
              <span>📅 {new Date(Number(reply.createdAt) / 1_000_000).toLocaleString()}</span>
              <span>⬆️ {reply.upvotes}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Form - Kontext Style */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '20px',
        padding: '2.5rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
      }}>
        {/* Top gradient bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #a855f7, #10b981)',
        }}></div>

        <h4 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '700', 
          color: '#ffffff', 
          marginBottom: '1.5rem',
        }}>
          ✍️ Post a Reply
        </h4>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Share your thoughts..."
          rows={6}
          style={{
            width: '100%',
            padding: '1.5rem',
            background: 'rgba(10, 10, 10, 0.5)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '16px',
            color: '#ffffff',
            fontSize: '1.05rem',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '1.5rem',
            lineHeight: '1.6',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#a855f7';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={handleSubmitReply}
          disabled={submitting || !replyText.trim()}
          style={{
            padding: '1rem 3rem',
            background: (submitting || !replyText.trim()) ? '#6B7280' : 'linear-gradient(135deg, #a855f7, #f59e0b)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            cursor: (submitting || !replyText.trim()) ? 'not-allowed' : 'pointer',
            fontSize: '1.05rem',
            fontWeight: '700',
            boxShadow: (submitting || !replyText.trim()) ? 'none' : '0 8px 24px rgba(168, 85, 247, 0.4)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!submitting && replyText.trim()) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(168, 85, 247, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!submitting && replyText.trim()) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(168, 85, 247, 0.4)';
            }
          }}
        >
          {submitting ? '⏳ Posting...' : '📤 Post Reply'}
        </button>
      </div>
    </div>
  );
};

// Create Discussion Dialog Component - Kontext Style
const CreateDiscussionDialog: React.FC<{
  courseId?: string;
  lessonId?: string;
  programId?: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ courseId, lessonId, programId, onClose, onCreated }) => {
  const { identity, agent, principalId } = useAppStore();
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
    if (!identity || !agent || !principalId || !title.trim() || !content.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const universityService = createUniversityService(identity, agent);
      await universityService.createDiscussion(
        courseId || null,
        lessonId || null,
        programId || null,
        principalId, // authorName would be looked up
        title,
        content,
        tags
      );
      alert('✅ Discussion created!');
      onCreated();
    } catch (error) {
      console.error('Failed to create discussion:', error);
      alert('❌ Failed to create discussion. Please try again.');
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
      zIndex: 10000,
      padding: '2rem',
    }}>
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
        border: '2px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '24px',
        maxWidth: '800px',
        width: '100%',
        padding: '3rem',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(168, 85, 247, 0.3)',
      }}>
        {/* Top gradient bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #a855f7, #f59e0b, #10b981)',
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <h2 style={{ 
            fontSize: '2rem', 
            fontWeight: '700',
            background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            💬 New Discussion
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '2rem',
              cursor: 'pointer',
              padding: '0.5rem',
              transition: 'color 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#a855f7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: '700' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your question or topic?"
            style={{
              width: '100%',
              padding: '1.25rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1.05rem',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: '700' }}>
            Content *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Provide details about your question..."
            rows={10}
            style={{
              width: '100%',
              padding: '1.25rem',
              background: 'rgba(10, 10, 10, 0.5)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1.05rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: '700' }}>
            Tags
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: '12px',
                  color: '#10b981',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: 'transparent',
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
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add a tag..."
              style={{
                flex: 1,
                padding: '1rem',
                background: 'rgba(10, 10, 10, 0.5)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddTag}
              style={{
                padding: '1rem 2rem',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                color: '#10b981',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '1rem 2.5rem',
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              fontSize: '1.05rem',
              fontWeight: '700',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '1rem 3rem',
              background: submitting ? '#6B7280' : 'linear-gradient(135deg, #a855f7, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '1.05rem',
              fontWeight: '700',
              boxShadow: submitting ? 'none' : '0 8px 24px rgba(168, 85, 247, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(168, 85, 247, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(168, 85, 247, 0.4)';
              }
            }}
          >
            {submitting ? '⏳ Creating...' : '🚀 Create Discussion'}
          </button>
        </div>
      </div>
    </div>
  );
};
