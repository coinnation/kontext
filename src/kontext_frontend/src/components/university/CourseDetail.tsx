/**
 * Course Detail Page - Kontext Style
 * Stunning course details with Kontext's signature design DNA
 */

import React, { useState, useEffect } from 'react';
import { HttpAgent } from '@dfinity/agent';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { Course, Lesson, CourseReview } from '../../types';

interface CourseDetailProps {
  courseId: string;
  onBack: () => void;
  onLessonClick: (lessonId: string) => void;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({ courseId, onBack, onLessonClick }) => {
  // 🔥 FIX: Use selector to get identity and create agent from it
  const identity = useAppStore(state => state.identity);
  const principalId = useAppStore(state => state.principal?.toString());
  
  // 🔥 FIX: Create agent from identity when available
  const agent = React.useMemo(() => {
    if (!identity) return null;
    
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      
      const httpAgent = new HttpAgent({ 
        identity,
        host 
      });
      
      // Fetch root key for local development
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        httpAgent.fetchRootKey().catch(err => {
          console.warn('⚠️ [CourseDetail] Failed to fetch root key:', err);
        });
      }
      
      return httpAgent;
    } catch (error) {
      console.error('❌ [CourseDetail] Failed to create agent:', error);
      return null;
    }
  }, [identity]);
  
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'lessons' | 'reviews'>('lessons');

  useEffect(() => {
    loadCourseData();
  }, [courseId, identity, agent]); // 🔥 FIX: Re-run when identity/agent becomes available

  const loadCourseData = async () => {
    // 🔥 FIX: Set loading to false if identity/agent not available
    if (!identity || !agent) {
      console.warn('⚠️ [CourseDetail] Identity or agent not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 [CourseDetail] Loading course:', courseId);
      const universityService = createUniversityService(identity, agent);

      const [courseData, lessonsData, reviewsData] = await Promise.all([
        universityService.getCourse(courseId),
        universityService.getLessonsByCourse(courseId),
        universityService.getReviews(courseId),
      ]);

      console.log('✅ [CourseDetail] Course loaded:', courseData);
      console.log('✅ [CourseDetail] Lessons loaded:', lessonsData?.length || 0);

      setCourse(courseData);
      setLessons(lessonsData.sort((a, b) => a.orderIndex - b.orderIndex));
      setReviews(reviewsData.sort((a, b) => Number(b.createdAt - a.createdAt)));

      // Check enrollment and progress
      if (principalId) {
        const enrollments = await universityService.getStudentEnrollments(principalId);
        const enrollment = enrollments.courses.find(e => e.courseId === courseId);
        setIsEnrolled(!!enrollment);
        if (enrollment) {
          const progressPercent = await universityService.getCourseProgress(courseId, principalId);
          setProgress(progressPercent);
        }
      }
    } catch (error) {
      console.error('❌ [CourseDetail] Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!identity || !agent || isEnrolled) return;

    try {
      setEnrolling(true);
      const universityService = createUniversityService(identity, agent);
      await universityService.enrollInCourse(courseId);
      setIsEnrolled(true);
      alert('🎉 Successfully enrolled in course!');
    } catch (error) {
      console.error('Failed to enroll:', error);
      alert('❌ Failed to enroll. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#FF6B35';
      case 'expert': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(168, 85, 247, 0.2)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem',
          }}></div>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.2rem' }}>
            Loading course details...
          </p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.2rem', marginBottom: '2rem' }}>
            Course not found
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const completionRate = course.enrollmentCount > 0 
    ? ((course.completionCount / course.enrollmentCount) * 100).toFixed(0)
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
      overflowY: 'auto',
      zIndex: 9999,
    }}>
      {/* Header - Kontext Style */}
      <div style={{
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '2px solid rgba(168, 85, 247, 0.2)',
        padding: '1.5rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(168, 85, 247, 0.1)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 107, 53, 0.1)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              color: '#ff6b35',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
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
            ← Back to Course List
          </button>
          {!isEnrolled ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                padding: '1rem 2.5rem',
                background: enrolling ? 'rgba(107, 114, 128, 0.3)' : 'linear-gradient(135deg, #a855f7, #c084fc)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                cursor: enrolling ? 'not-allowed' : 'pointer',
                fontSize: '1.1rem',
                fontWeight: '700',
                boxShadow: enrolling ? 'none' : '0 4px 20px rgba(168, 85, 247, 0.4)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!enrolling) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 107, 53, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!enrolling) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 53, 0.4)';
                }
              }}
            >
              {enrolling ? '⏳ Enrolling...' : '🎓 Enroll Now'}
            </button>
          ) : (
            <div style={{
              padding: '1rem 2.5rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '1.1rem',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            }}>
              ✓ Enrolled • {progress.toFixed(0)}% Complete
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }}>
          {/* Main Content */}
          <div>
            {/* Course Hero - Kontext Style */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: '24px',
              overflow: 'hidden',
              marginBottom: '2.5rem',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
            }}>
              {/* Gradient Top Bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
              }}></div>

              {/* Thumbnail */}
              <div style={{
                height: '400px',
                background: `url(${course.thumbnailUrl}) center/cover, linear-gradient(135deg, rgba(255, 107, 53, 0.4), rgba(16, 185, 129, 0.3))`,
                position: 'relative',
              }}>
                {/* Overlay gradient */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, transparent 0%, rgba(10, 10, 10, 0.9) 100%)',
                }}></div>
              </div>

              <div style={{ padding: '3rem' }}>
                {/* Badges */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{
                    padding: '0.75rem 1.5rem',
                    background: `${getDifficultyColor(course.difficulty)}20`,
                    border: `1px solid ${getDifficultyColor(course.difficulty)}50`,
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: getDifficultyColor(course.difficulty),
                    textTransform: 'capitalize',
                  }}>
                    {course.difficulty}
                  </div>
                  <div style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: '#10b981',
                  }}>
                    {completionRate}% Completion Rate
                  </div>
                </div>

                <h1 style={{
                  fontSize: '3rem',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '1.5rem',
                  lineHeight: '1.2',
                }}>
                  {course.title}
                </h1>

                <p style={{
                  fontSize: '1.2rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.8',
                  marginBottom: '2.5rem',
                }}>
                  {course.description}
                </p>

                {/* Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '2rem',
                }}>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Duration</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>⏱️ {course.durationWeeks} weeks</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Credits</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>📖 {course.credits} credits</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Students</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>👥 {course.enrollmentCount}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Rating</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>⭐ {course.averageRating.toFixed(1)}/5.0</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Completed</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>🎓 {course.completionCount}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Watch Time</div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>🕐 {course.totalWatchHours}hrs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs - Kontext Style */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '2rem',
              borderBottom: '2px solid rgba(168, 85, 247, 0.2)',
            }}>
              <button
                onClick={() => setActiveTab('lessons')}
                style={{
                  padding: '1.25rem 2rem',
                  background: activeTab === 'lessons' ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'lessons' ? '3px solid #ff6b35' : '3px solid transparent',
                  color: activeTab === 'lessons' ? '#ff6b35' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'lessons') {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'lessons') {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                  }
                }}
              >
                📚 Lessons ({lessons.length})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                style={{
                  padding: '1.25rem 2rem',
                  background: activeTab === 'reviews' ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'reviews' ? '3px solid #ff6b35' : '3px solid transparent',
                  color: activeTab === 'reviews' ? '#ff6b35' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'reviews') {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'reviews') {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                  }
                }}
              >
                ⭐ Reviews ({reviews.length})
              </button>
            </div>

            {/* Lessons List - Kontext Style */}
            {activeTab === 'lessons' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {lessons.map((lesson, index) => (
                  <div
                    key={lesson.lessonId}
                    onClick={() => (isEnrolled || lesson.isFree) && onLessonClick(lesson.lessonId)}
                    className="kontext-lesson-card"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
                      border: '1px solid rgba(255, 107, 53, 0.2)',
                      borderRadius: '20px',
                      padding: '2rem',
                      cursor: (isEnrolled || lesson.isFree) ? 'pointer' : 'not-allowed',
                      opacity: (isEnrolled || lesson.isFree) ? 1 : 0.5,
                      transition: 'all 0.5s ease',
                      display: 'flex',
                      gap: '2rem',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
                    }}
                    onMouseEnter={(e) => {
                      if (isEnrolled || lesson.isFree) {
                        e.currentTarget.style.transform = 'translateX(8px)';
                        e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 107, 53, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                    }}
                  >
                    {/* Side gradient accent */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: 'linear-gradient(180deg, #a855f7, #10b981)',
                    }}></div>

                    <div style={{
                      minWidth: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.15))',
                      border: '2px solid rgba(255, 107, 53, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      fontWeight: '700',
                      color: '#ff6b35',
                      boxShadow: '0 4px 12px rgba(255, 107, 53, 0.2)',
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <h3 style={{
                          fontSize: '1.4rem',
                          fontWeight: '700',
                          color: '#ffffff',
                          margin: 0,
                        }}>
                          {lesson.title}
                        </h3>
                        {lesson.isFree && (
                          <span style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: '#10b981',
                          }}>
                            🎁 FREE
                          </span>
                        )}
                        {!isEnrolled && !lesson.isFree && (
                          <span style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: '#f59e0b',
                          }}>
                            🔒 Enroll to unlock
                          </span>
                        )}
                      </div>
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '1.05rem',
                        marginBottom: '1rem',
                        lineHeight: '1.6',
                      }}>
                        {lesson.description}
                      </p>
                      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <span>🎥 {Math.floor(lesson.videoDuration / 60)} min</span>
                        <span>👁️ {lesson.viewCount} views</span>
                        <span>⭐ {lesson.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews - Kontext Style */}
            {activeTab === 'reviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {reviews.map(review => (
                  <div
                    key={review.reviewId}
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
                      border: '1px solid rgba(255, 107, 53, 0.2)',
                      borderRadius: '20px',
                      padding: '2rem',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
                    }}
                  >
                    {/* Top gradient bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
                    }}></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} style={{ 
                              color: star <= review.rating ? '#F59E0B' : '#374151', 
                              fontSize: '1.5rem',
                              textShadow: star <= review.rating ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none',
                            }}>
                              ⭐
                            </span>
                          ))}
                        </div>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                          {review.title}
                        </h4>
                      </div>
                      {review.isVerifiedCompletion && (
                        <span style={{
                          padding: '0.75rem 1.25rem',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: '12px',
                          fontSize: '0.9rem',
                          fontWeight: '700',
                          color: '#10b981',
                          height: 'fit-content',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          ✓ Verified Graduate
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.05rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                      {review.comment}
                    </p>
                    <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      👍 {review.helpfulCount} found this helpful
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '4rem', 
                    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
                    border: '1px solid rgba(255, 107, 53, 0.1)',
                    borderRadius: '20px',
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.2rem' }}>
                      No reviews yet. Be the first to review!
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Kontext Style */}
          <div>
            {/* Course Stats */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: '20px',
              padding: '2rem',
              marginBottom: '2rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
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
                background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span>📊</span>
                <span>Course Stats</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(255, 107, 53, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 107, 53, 0.15)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Watch Hours</div>
                  <div style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '700' }}>{course.totalWatchHours}<span style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.6)' }}>hrs</span></div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Completion Rate</div>
                  <div style={{ color: '#10b981', fontSize: '2rem', fontWeight: '700' }}>
                    {completionRate}<span style={{ fontSize: '1.2rem' }}>%</span>
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(245, 158, 11, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Difficulty</div>
                  <div style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.25rem',
                    background: `${getDifficultyColor(course.difficulty)}20`,
                    borderRadius: '12px',
                    color: getDifficultyColor(course.difficulty),
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    textTransform: 'capitalize',
                    border: `1px solid ${getDifficultyColor(course.difficulty)}50`,
                  }}>
                    {course.difficulty}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {course.tags.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 107, 53, 0.05))',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '20px',
                padding: '2rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
              }}>
                {/* Top gradient bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #10b981, #ff6b35)',
                }}></div>

                <h3 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span>🏷️</span>
                  <span>Tags</span>
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {course.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: '#10b981',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
