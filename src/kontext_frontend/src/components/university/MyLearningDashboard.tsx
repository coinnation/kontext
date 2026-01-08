/**
 * My Learning Dashboard - Kontext Style
 * Student's stunning personalized dashboard with Kontext design DNA
 */

import React, { useState, useEffect } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type {
  ProgramEnrollment,
  CourseEnrollment,
  Degree,
  UserAchievement,
  Achievement,
  AcademicProgram,
  Course,
} from '../../types';

interface MyLearningDashboardProps {
  onCourseClick: (courseId: string) => void;
  onProgramClick: (programId: string) => void;
  onBack?: () => void;
}

export const MyLearningDashboard: React.FC<MyLearningDashboardProps> = ({
  onCourseClick,
  onProgramClick,
  onBack,
}) => {
  const { identity, agent, principalId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'programs' | 'degrees' | 'achievements'>('courses');
  const [programEnrollments, setProgramEnrollments] = useState<ProgramEnrollment[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>([]);
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [programs, setPrograms] = useState<Map<string, AcademicProgram>>(new Map());
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (!identity || !agent || !principalId) return;

    try {
      setLoading(true);
      const universityService = createUniversityService(identity, agent);

      const [enrollmentsData, degreesData, achievementsData, allAchievementsData, allProgramsData, allCoursesData] = await Promise.all([
        universityService.getStudentEnrollments(principalId),
        universityService.getStudentDegrees(principalId),
        universityService.getUserAchievements(principalId),
        universityService.getAllAchievements(),
        universityService.getAllPrograms(),
        universityService.getAllCourses(),
      ]);

      setProgramEnrollments(enrollmentsData.programs);
      setCourseEnrollments(enrollmentsData.courses);
      setDegrees(degreesData);
      setUserAchievements(achievementsData);
      setAchievements(allAchievementsData);

      // Create lookup maps
      const programsMap = new Map(allProgramsData.map(p => [p.programId, p]));
      const coursesMap = new Map(allCoursesData.map(c => [c.courseId, c]));
      setPrograms(programsMap);
      setCourses(coursesMap);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'paused': return '#6B7280';
      case 'dropped': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#9CA3AF';
      case 'uncommon': return '#10B981';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
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
            Loading your learning journey...
          </p>
        </div>
      </div>
    );
  }

  const totalCourses = courseEnrollments.length;
  const completedCourses = courseEnrollments.filter(e => e.status === 'completed').length;
  const activeCourses = courseEnrollments.filter(e => e.status === 'active').length;
  const totalAchievements = userAchievements.length;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.15) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
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
          <h1 style={{
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
            <span>📚</span>
            <span>My Learning</span>
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '12px',
                color: '#a855f7',
                cursor: 'pointer',
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
              ← Back
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Stats Cards - Kontext Style */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem',
        }}>
          <div className="kontext-stat-card" style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(245, 158, 11, 0.05))',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
            }}></div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>📚</div>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
              {totalCourses}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem', fontWeight: '600' }}>Total Courses</div>
          </div>

          <div className="kontext-stat-card" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.05))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #10b981, #059669)',
            }}></div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))' }}>✅</div>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: '#10B981', marginBottom: '0.5rem' }}>
              {completedCourses}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem', fontWeight: '600' }}>Completed</div>
          </div>

          <div className="kontext-stat-card" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.05))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.1)',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            }}></div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 8px rgba(245, 158, 11, 0.3))' }}>🔥</div>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: '#F59E0B', marginBottom: '0.5rem' }}>
              {activeCourses}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem', fontWeight: '600' }}>In Progress</div>
          </div>

          <div className="kontext-stat-card" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.1)',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
            }}></div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))' }}>🏆</div>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: '#8B5CF6', marginBottom: '0.5rem' }}>
              {totalAchievements}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem', fontWeight: '600' }}>Achievements</div>
          </div>
        </div>

        {/* Tabs - Kontext Style */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2.5rem',
          borderBottom: '2px solid rgba(168, 85, 247, 0.2)',
          flexWrap: 'wrap',
        }}>
          {(['courses', 'programs', 'degrees', 'achievements'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1.25rem 2rem',
                background: activeTab === tab ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid #a855f7' : '3px solid transparent',
                color: activeTab === tab ? '#a855f7' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '700',
                textTransform: 'capitalize',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                }
              }}
            >
              {tab === 'courses' && `📚 Courses (${courseEnrollments.length})`}
              {tab === 'programs' && `🎯 Programs (${programEnrollments.length})`}
              {tab === 'degrees' && `🎓 Degrees (${degrees.length})`}
              {tab === 'achievements' && `🏆 Achievements (${userAchievements.length})`}
            </button>
          ))}
        </div>

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '2rem' }}>
            {courseEnrollments.map(enrollment => {
              const course = courses.get(enrollment.courseId);
              if (!course) return null;

              return (
                <div
                  key={enrollment.enrollmentId}
                  onClick={() => onCourseClick(enrollment.courseId)}
                  className="kontext-course-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.5s ease',
                    boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 20px 60px rgba(168, 85, 247, 0.25)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                  }}
                >
                  <div style={{
                    height: '180px',
                    background: `url(${course.thumbnailUrl}) center/cover, linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(16, 185, 129, 0.3))`,
                    position: 'relative',
                  }}>
                    {/* Overlay gradient */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(10, 10, 10, 0.7) 100%)',
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      top: '1.25rem',
                      right: '1.25rem',
                      padding: '0.75rem 1.25rem',
                      background: getStatusColor(enrollment.status) + 'E6',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: '#ffffff',
                      textTransform: 'capitalize',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    }}>
                      {enrollment.status}
                    </div>
                  </div>

                  <div style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                      {course.title}
                    </h3>

                    {/* Progress Bar - Kontext Style */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1rem', fontWeight: '600' }}>Progress</span>
                        <span style={{ 
                          color: '#a855f7', 
                          fontSize: '1.1rem', 
                          fontWeight: '700',
                        }}>
                          {enrollment.progress.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${enrollment.progress}%`,
                          background: 'linear-gradient(90deg, #a855f7, #f59e0b, #10b981)',
                          transition: 'width 0.3s ease',
                          boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)',
                          position: 'relative',
                        }}>
                          {/* Animated shimmer */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                            animation: 'shimmer 2s infinite',
                          }}></div>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      📅 Last accessed: {new Date(Number(enrollment.lastAccessedAt) / 1_000_000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}

            {courseEnrollments.length === 0 && (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '5rem',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
                border: '1px solid rgba(168, 85, 247, 0.1)',
                borderRadius: '24px',
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>📚</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem' }}>
                  You haven't enrolled in any courses yet
                </div>
              </div>
            )}
          </div>
        )}

        {/* Programs Tab */}
        {activeTab === 'programs' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '2rem' }}>
            {programEnrollments.map(enrollment => {
              const program = programs.get(enrollment.programId);
              if (!program) return null;

              return (
                <div
                  key={enrollment.enrollmentId}
                  onClick={() => onProgramClick(enrollment.programId)}
                  className="kontext-program-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '20px',
                    padding: '2.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.5s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 20px 60px rgba(168, 85, 247, 0.25)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
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
                    <div style={{
                      padding: '0.75rem 1.5rem',
                      background: getStatusColor(enrollment.status) + '20',
                      border: `1px solid ${getStatusColor(enrollment.status)}50`,
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: getStatusColor(enrollment.status),
                      textTransform: 'capitalize',
                    }}>
                      {enrollment.status}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff', marginBottom: '1.5rem' }}>
                    {program.title}
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div style={{
                      padding: '1.5rem',
                      background: 'rgba(168, 85, 247, 0.08)',
                      borderRadius: '16px',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                    }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Credits Earned</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#a855f7' }}>
                        {enrollment.creditsEarned}<span style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.5)' }}>/{program.totalCredits}</span>
                      </div>
                    </div>
                    <div style={{
                      padding: '1.5rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: '16px',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Current GPA</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10B981' }}>
                        {enrollment.currentGPA.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '1rem',
                    padding: '1rem',
                    background: 'rgba(168, 85, 247, 0.05)',
                    borderRadius: '12px',
                  }}>
                    📊 {enrollment.completedCourseIds.length} / {program.requiredCourses.length} required courses
                  </div>
                </div>
              );
            })}

            {programEnrollments.length === 0 && (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '5rem',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
                border: '1px solid rgba(168, 85, 247, 0.1)',
                borderRadius: '24px',
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>🎯</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem' }}>
                  You haven't enrolled in any programs yet
                </div>
              </div>
            )}
          </div>
        )}

        {/* Degrees Tab */}
        {activeTab === 'degrees' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '2.5rem' }}>
            {degrees.map(degree => (
              <div
                key={degree.degreeId}
                className="kontext-degree-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '24px',
                  padding: '3rem',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(168, 85, 247, 0.15)',
                  transition: 'all 0.5s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(168, 85, 247, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.15)';
                }}
              >
                {/* Top gradient bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #a855f7, #f59e0b, #10b981)',
                }}></div>

                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <div style={{ 
                    fontSize: '5rem', 
                    marginBottom: '1.5rem',
                    filter: 'drop-shadow(0 6px 12px rgba(168, 85, 247, 0.4))',
                  }}>🎓</div>
                  <h3 style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                    {degree.title}
                  </h3>
                  <div style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))',
                    borderRadius: '12px',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#a855f7',
                    textTransform: 'capitalize',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                  }}>
                    {degree.degreeType}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <div style={{
                    flex: 1,
                    padding: '1.5rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    marginRight: '1rem',
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>GPA</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10B981' }}>
                      {degree.gpa.toFixed(2)}
                    </div>
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '1.5rem',
                    background: 'rgba(168, 85, 247, 0.1)',
                    borderRadius: '16px',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Credits</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#a855f7' }}>
                      {degree.creditsEarned}
                    </div>
                  </div>
                </div>

                {degree.honors && (
                  <div style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    borderRadius: '16px',
                    marginBottom: '2rem',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌟</div>
                    <div style={{ color: '#F59E0B', fontWeight: '700', fontSize: '1.2rem', textTransform: 'capitalize' }}>
                      {degree.honors.replace(/_/g, ' ')}
                    </div>
                  </div>
                )}

                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(168, 85, 247, 0.08)',
                  borderRadius: '16px',
                  fontSize: '0.95rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                }}>
                  <div style={{ marginBottom: '1rem', color: '#ffffff', fontWeight: '700', fontSize: '1rem' }}>
                    🔐 Verification Code:
                  </div>
                  <code style={{
                    display: 'block',
                    padding: '1rem',
                    background: 'rgba(10, 10, 10, 0.5)',
                    borderRadius: '12px',
                    color: '#a855f7',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    fontWeight: '600',
                    letterSpacing: '0.05em',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                  }}>
                    {degree.verificationCode}
                  </code>
                </div>

                <div style={{ marginTop: '1.5rem', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                  📅 Issued: {new Date(Number(degree.issuedAt) / 1_000_000).toLocaleDateString()}
                </div>
              </div>
            ))}

            {degrees.length === 0 && (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '5rem',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
                border: '1px solid rgba(168, 85, 247, 0.1)',
                borderRadius: '24px',
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>🎓</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem' }}>
                  Complete programs to earn degrees
                </div>
              </div>
            )}
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
            {achievements.map(achievement => {
              const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.achievementId);
              const isEarned = !!userAchievement;
              const isSecret = achievement.isSecret && !isEarned;

              return (
                <div
                  key={achievement.achievementId}
                  className="kontext-achievement-card"
                  style={{
                    background: isEarned 
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))' 
                      : 'rgba(15, 23, 42, 0.5)',
                    border: `2px solid ${isEarned ? getRarityColor(achievement.rarity) : 'rgba(107, 114, 128, 0.2)'}`,
                    borderRadius: '20px',
                    padding: '2rem',
                    textAlign: 'center',
                    opacity: isEarned ? 1 : 0.5,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isEarned ? `0 8px 32px ${getRarityColor(achievement.rarity)}30` : 'none',
                    transition: 'all 0.5s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (isEarned) {
                      e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                      e.currentTarget.style.boxShadow = `0 20px 60px ${getRarityColor(achievement.rarity)}50`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isEarned) {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = `0 8px 32px ${getRarityColor(achievement.rarity)}30`;
                    }
                  }}
                >
                  {isEarned && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: `linear-gradient(90deg, ${getRarityColor(achievement.rarity)}, ${getRarityColor(achievement.rarity)}AA)`,
                    }}></div>
                  )}

                  <div style={{
                    fontSize: '4rem',
                    marginBottom: '1.5rem',
                    filter: isEarned ? `drop-shadow(0 4px 8px ${getRarityColor(achievement.rarity)}60)` : 'grayscale(100%)',
                  }}>
                    {isSecret ? '❓' : '🏆'}
                  </div>

                  <h3 style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '1rem',
                  }}>
                    {isSecret ? 'Secret Achievement' : achievement.title}
                  </h3>

                  <p style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '1rem',
                    marginBottom: '1.5rem',
                    lineHeight: '1.6',
                  }}>
                    {isSecret ? 'Keep exploring to unlock!' : achievement.description}
                  </p>

                  <div style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: getRarityColor(achievement.rarity) + '20',
                    border: `1px solid ${getRarityColor(achievement.rarity)}50`,
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: getRarityColor(achievement.rarity),
                    textTransform: 'capitalize',
                  }}>
                    {achievement.rarity}
                  </div>

                  {isEarned && userAchievement && (
                    <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      📅 Earned: {new Date(Number(userAchievement.earnedAt) / 1_000_000).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}

            {achievements.length === 0 && (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '5rem',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(16, 185, 129, 0.03))',
                border: '1px solid rgba(168, 85, 247, 0.1)',
                borderRadius: '24px',
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 4px 8px rgba(168, 85, 247, 0.3))' }}>🏆</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.3rem' }}>
                  No achievements available yet
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .kontext-stat-card:hover {
          transform: translateY(-8px) scale(1.05);
          box-shadow: 0 20px 60px rgba(168, 85, 247, 0.25) !important;
        }
      `}</style>
    </div>
  );
};
