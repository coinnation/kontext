/**
 * Program Detail Page - Kontext Style
 * Stunning program details with Kontext's signature design DNA
 */

import React, { useState, useEffect } from 'react';
import { HttpAgent } from '@dfinity/agent';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { AcademicProgram, Course } from '../../types';

interface ProgramDetailProps {
  programId: string;
  onBack: () => void;
  onCourseClick: (courseId: string) => void;
}

export const ProgramDetail: React.FC<ProgramDetailProps> = ({ programId, onBack, onCourseClick }) => {
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
          console.warn('⚠️ [ProgramDetail] Failed to fetch root key:', err);
        });
      }
      
      return httpAgent;
    } catch (error) {
      console.error('❌ [ProgramDetail] Failed to create agent:', error);
      return null;
    }
  }, [identity]);
  
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [program, setProgram] = useState<AcademicProgram | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    loadProgramData();
  }, [programId, identity, agent]); // 🔥 FIX: Re-run when identity/agent becomes available

  const loadProgramData = async () => {
    // 🔥 FIX: Set loading to false if identity/agent not available
    if (!identity || !agent) {
      console.warn('⚠️ [ProgramDetail] Identity or agent not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 [ProgramDetail] Loading program:', programId);
      const universityService = createUniversityService(identity, agent);

      // First load the program
      const programData = await universityService.getProgram(programId);
      console.log('✅ [ProgramDetail] Program loaded:', programData);

      if (!programData) {
        console.error('❌ [ProgramDetail] Program not found');
        setLoading(false);
        return;
      }

      setProgram(programData);

      // Then load courses by their IDs from the program
      const courseIds = programData.courseIds || [];
      const requiredIds = programData.requiredCourses || [];
      const electiveIds = programData.electiveCourses || [];
      const allCourseIds = [...new Set([...courseIds, ...requiredIds, ...electiveIds])];

      console.log('🔄 [ProgramDetail] Loading', allCourseIds.length, 'courses');

      if (allCourseIds.length > 0) {
        const coursesData = await Promise.all(
          allCourseIds.map(id => universityService.getCourse(id))
        );
        const validCourses = coursesData.filter(c => c !== null) as Course[];
        console.log('✅ [ProgramDetail] Courses loaded:', validCourses.length);
        setCourses(validCourses);
      } else {
        console.log('ℹ️ [ProgramDetail] No courses associated with this program');
        setCourses([]);
      }

      // Check enrollment status
      if (principalId) {
        const enrollments = await universityService.getStudentEnrollments(principalId);
        setIsEnrolled(enrollments.programs.some(e => e.programId === programId));
      }
    } catch (error) {
      console.error('❌ [ProgramDetail] Failed to load program:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!identity || !agent || isEnrolled) return;

    try {
      setEnrolling(true);
      const universityService = createUniversityService(identity, agent);
      await universityService.enrollInProgram(programId);
      setIsEnrolled(true);
      alert('🎉 Successfully enrolled in program!');
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
            Loading program details...
          </p>
        </div>
      </div>
    );
  }

  if (!program) {
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
            Program not found
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

  const requiredCourses = courses.filter(c => program.requiredCourses.includes(c.courseId));
  const electiveCourses = courses.filter(c => program.electiveCourses.includes(c.courseId));

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
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            ← Back to Programs
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
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(168, 85, 247, 0.6)';
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
              ✓ Enrolled
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Hero Section - Kontext Style */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
          border: '1px solid rgba(255, 107, 53, 0.2)',
          borderRadius: '24px',
          padding: '4rem 3rem',
          marginBottom: '3rem',
          position: 'relative',
          overflow: 'hidden',
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

          {/* Badges */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#ffffff',
              textTransform: 'capitalize',
              boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
            }}>
              {program.degreeType}
            </div>
            <div style={{
              padding: '0.75rem 1.5rem',
              background: `${getDifficultyColor(program.difficulty)}20`,
              border: `1px solid ${getDifficultyColor(program.difficulty)}50`,
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '700',
              color: getDifficultyColor(program.difficulty),
              textTransform: 'capitalize',
            }}>
              {program.difficulty}
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #a855f7, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1.5rem',
            lineHeight: '1.2',
          }}>
            {program.title}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '1.3rem',
            color: 'rgba(255, 255, 255, 0.8)',
            maxWidth: '900px',
            lineHeight: '1.8',
            marginBottom: '3rem',
          }}>
            {program.description}
          </p>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '2rem',
          }}>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Duration</div>
              <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>⏱️ {program.durationWeeks} weeks</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Credits</div>
              <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>📖 {program.totalCredits} credits</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Students</div>
              <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>👥 {program.enrollmentCount}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Rating</div>
              <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>⭐ {program.averageRating.toFixed(1)}/5.0</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Graduates</div>
              <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff' }}>🎓 {program.completionCount}</div>
            </div>
          </div>
        </div>

        {/* Required Courses */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #a855f7, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span>📚</span>
            <span>Required Courses ({requiredCourses.length})</span>
          </h2>
          {requiredCourses.length === 0 && electiveCourses.length === 0 ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '20px',
              padding: '4rem 2rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '1.5rem',
              }}>
                📚
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '1rem',
              }}>
                No Courses Available Yet
              </h3>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem',
                lineHeight: '1.6',
                maxWidth: '600px',
                margin: '0 auto',
              }}>
                This program is currently being developed. Courses will be added soon. Check back later!
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}>
              {requiredCourses.map(course => (
              <div
                key={course.courseId}
                onClick={() => onCourseClick(course.courseId)}
                className="kontext-course-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
                  border: '1px solid rgba(255, 107, 53, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  cursor: 'pointer',
                  transition: 'all 0.5s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(255, 107, 53, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                }}
              >
                {/* Gradient Top Bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
                }}></div>

                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '0.75rem',
                }}>
                  {course.title}
                </h3>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1rem',
                  marginBottom: '1.5rem',
                  lineHeight: '1.6',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {course.description}
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <span>⏱️ {course.durationWeeks}w</span>
                  <span>📖 {course.credits}cr</span>
                  <span>⭐ {course.averageRating.toFixed(1)}</span>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {/* Elective Courses */}
        {electiveCourses.length > 0 && (
          <div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span>✨</span>
              <span>Elective Courses ({electiveCourses.length})</span>
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}>
              {electiveCourses.map(course => (
                <div
                  key={course.courseId}
                  onClick={() => onCourseClick(course.courseId)}
                  className="kontext-course-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 107, 53, 0.05))',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '20px',
                    padding: '2rem',
                    cursor: 'pointer',
                    transition: 'all 0.5s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 20px 60px rgba(16, 185, 129, 0.25)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                  }}
                >
                  {/* Gradient Top Bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
                  }}></div>

                  <h3 style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '0.75rem',
                  }}>
                    {course.title}
                  </h3>
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '1rem',
                    marginBottom: '1.5rem',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {course.description}
                  </p>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    <span>⏱️ {course.durationWeeks}w</span>
                    <span>📖 {course.credits}cr</span>
                    <span>⭐ {course.averageRating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .kontext-course-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          transform: scaleX(0.3);
          transform-origin: left;
          transition: transform 0.5s ease;
        }

        .kontext-course-card:hover::before {
          transform: scaleX(1);
        }
      `}</style>
    </div>
  );
};
