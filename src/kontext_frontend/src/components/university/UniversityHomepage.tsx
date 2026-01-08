/**
 * Kontext University Homepage
 * Stunning landing page with Kontext's signature design DNA
 */

import React, { useState, useEffect, useMemo } from 'react';
import { HttpAgent } from '@dfinity/agent';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type {
  AcademicProgram,
  Course,
  LearningPath,
  UniversityStats,
  DifficultyLevel,
} from '../../types';

interface UniversityHomepageProps {
  onClose?: () => void;
  onProgramClick?: (programId: string) => void;
  onCourseClick?: (courseId: string) => void;
  onPathClick?: (pathId: string) => void;
}

export const UniversityHomepage: React.FC<UniversityHomepageProps> = ({ onClose, onProgramClick, onCourseClick, onPathClick }) => {
  // 🔥 FIX: Use selector to get identity reactively
  const identity = useAppStore(state => state.identity);
  
  // 🔥 FIX: Create agent from identity when available
  const agent = useMemo(() => {
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
          console.warn('⚠️ [UniversityHomepage] Failed to fetch root key:', err);
        });
      }
      
      return httpAgent;
    } catch (error) {
      console.error('❌ [UniversityHomepage] Failed to create agent:', error);
      return null;
    }
  }, [identity]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'programs' | 'courses' | 'paths'>('programs');
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  
  // Pagination state
  const [programsPage, setProgramsPage] = useState(1);
  const [coursesPage, setCoursesPage] = useState(1);
  const [totalPrograms, setTotalPrograms] = useState(0);
  const [totalCourses, setTotalCourses] = useState(0);
  const ITEMS_PER_PAGE = 12; // 3x4 grid

  // 🔥 FIX: Helper to extract variant value from Motoko variant object (defined early for use in filters)
  const extractVariantValue = (variant: any): string | null => {
    if (!variant || typeof variant !== 'object') {
      return typeof variant === 'string' ? variant : null;
    }
    // Motoko variants come as { variantName: null }
    const keys = Object.keys(variant);
    if (keys.length > 0) {
      return keys[0]; // Return the variant name
    }
    return null;
  };

  useEffect(() => {
    loadData();
  }, [identity, agent, programsPage, coursesPage, activeTab]); // 🔥 FIX: Re-run when pagination changes

  const loadData = async () => {
    // 🔥 CRITICAL FIX: Set loading to false if identity/agent not available
    if (!identity || !agent) {
      console.warn('⚠️ [UniversityHomepage] Identity or agent not available, waiting...');
      setLoading(false); // Don't show spinner if we can't load
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 [UniversityHomepage] Loading university data (paginated)...');
      const universityService = createUniversityService(identity, agent);

      // Load based on active tab with pagination
      if (activeTab === 'programs') {
        const offset = (programsPage - 1) * ITEMS_PER_PAGE;
        const { programs: programsData, total } = await universityService.getPublishedProgramsPaginated(ITEMS_PER_PAGE, offset);
        setPrograms(programsData);
        setTotalPrograms(total);
        console.log(`✅ [UniversityHomepage] Loaded ${programsData.length} programs (page ${programsPage}, ${total} total)`);
      } else if (activeTab === 'courses') {
        const offset = (coursesPage - 1) * ITEMS_PER_PAGE;
        const { courses: coursesData, total } = await universityService.getPublishedCoursesPaginated(ITEMS_PER_PAGE, offset);
        setCourses(coursesData);
        setTotalCourses(total);
        console.log(`✅ [UniversityHomepage] Loaded ${coursesData.length} courses (page ${coursesPage}, ${total} total)`);
      }

      // Always load stats and learning paths (these are typically small)
      const [pathsData, statsData] = await Promise.all([
        universityService.getLearningPaths(),
        universityService.getUniversityStats(),
      ]);

      setLearningPaths(pathsData);
      setStats(statsData);
    } catch (error) {
      console.error('❌ [UniversityHomepage] Failed to load university data:', error);
      // Set empty arrays on error so UI doesn't show spinner forever
      setPrograms([]);
      setCourses([]);
      setLearningPaths([]);
      setStats({
        totalPrograms: 0,
        totalCourses: 0,
        totalLessons: 0,
        totalStudents: 0,
        totalInstructors: 0,
        totalDegreesIssued: 0,
        totalWatchHours: 0,
        averageCourseRating: 0,
        courseCompletionRate: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    // 🔥 FIX: Extract variant value for comparison
    const programDifficulty = extractVariantValue(p.difficulty) || p.difficulty || '';
    const matchesDifficulty = selectedDifficulty === 'all' || programDifficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    // 🔥 FIX: Extract variant value for comparison
    const courseDifficulty = extractVariantValue(c.difficulty) || c.difficulty || '';
    const matchesDifficulty = selectedDifficulty === 'all' || courseDifficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: DifficultyLevel | any): string => {
    // 🔥 FIX: Extract variant value if it's a Motoko variant object
    const difficultyStr = extractVariantValue(difficulty) || difficulty || 'beginner';
    
    switch (difficultyStr) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#a855f7';
      case 'expert': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatDegreeType = (type: string | any): string => {
    // 🔥 FIX: Extract variant value if it's a Motoko variant object
    const typeStr = extractVariantValue(type) || type || 'certificate';
    
    switch (typeStr) {
      case 'certificate': return 'Certificate';
      case 'associate': return 'Associate Degree';
      case 'bachelor': return 'Bachelor Degree';
      case 'master': return 'Master Degree';
      case 'doctorate': return 'Doctorate';
      default: return typeof typeStr === 'string' ? typeStr : 'Certificate';
    }
  };

  // 🔥 FIX: Helper to get difficulty as string for display
  const getDifficultyString = (difficulty: DifficultyLevel | any): string => {
    const difficultyStr = extractVariantValue(difficulty) || difficulty || 'beginner';
    return typeof difficultyStr === 'string' ? difficultyStr : 'beginner';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.15) 0%, transparent 50%), linear-gradient(135deg, rgb(10, 10, 10) 0%, #0a0a0a 50%, rgb(10, 10, 10) 100%)',
      overflowY: 'auto',
      zIndex: 9999,
    }}>
      {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h1 style={{
              fontSize: '2.2rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              🎓 Kontext University
            </h1>
            {stats && (
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#a855f7' }}>📚</span>
                  <span>{stats.totalPrograms} Programs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#ff6b35' }}>📖</span>
                  <span>{stats.totalCourses} Courses</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>👨‍🎓</span>
                  <span>{stats.totalStudents} Students</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#a855f7' }}>🎓</span>
                  <span>{stats.totalDegreesIssued} Degrees</span>
                </div>
              </div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))';
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.1)';
              }}
            >
              ← Back to Kontext
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Hero Section - Kontext Style */}
        <div className="kontext-hero-card" style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          borderRadius: '24px',
          padding: '4rem 3rem',
          marginBottom: '3rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
        }}>
          {/* Gradient Accent Bar - Tri-Color DNA */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
          }}></div>

          <h2 style={{
            fontSize: '3rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #a855f7, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1.5rem',
          }}>
            Master the Internet Computer
          </h2>
          <p style={{
            fontSize: '1.3rem',
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto 3rem',
            lineHeight: '1.6',
          }}>
            Learn Motoko, build dApps, earn blockchain-verified degrees.<br/>
            <span style={{ color: '#10b981', fontWeight: '600' }}>The first decentralized university.</span>
          </p>

          {/* Search Bar - Kontext Style */}
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            position: 'relative',
          }}>
            <input
              type="text"
              placeholder="Search programs, courses, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '1.25rem 1.25rem 1.25rem 3.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '16px',
                color: '#ffffff',
                fontSize: '1.1rem',
                outline: 'none',
                transition: 'all 0.3s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#a855f7';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <span style={{
              position: 'absolute',
              left: '1.25rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '1.5rem',
            }}>
              🔍
            </span>
          </div>

          {/* Difficulty Filter */}
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {(['all', 'beginner', 'intermediate', 'advanced', 'expert'] as const).map(diff => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: selectedDifficulty === diff 
                    ? 'linear-gradient(135deg, #a855f7, #c084fc)' 
                    : 'rgba(168, 85, 247, 0.1)',
                  border: `1px solid ${selectedDifficulty === diff ? '#a855f7' : 'rgba(168, 85, 247, 0.3)'}`,
                  borderRadius: '12px',
                  color: selectedDifficulty === diff ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  textTransform: 'capitalize',
                }}
                onMouseOver={(e) => {
                  if (selectedDifficulty !== diff) {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                    e.currentTarget.style.borderColor = '#a855f7';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedDifficulty !== diff) {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                  }
                }}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs - Kontext Style */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '3rem',
          borderBottom: '2px solid rgba(168, 85, 247, 0.2)',
          padding: '0 1rem',
        }}>
          {([
            { key: 'programs', label: '📚 Programs', icon: '📚' },
            { key: 'courses', label: '📖 Courses', icon: '📖' },
            { key: 'paths', label: '🗺️ Learning Paths', icon: '🗺️' }
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '1.25rem 2rem',
                background: activeTab === tab.key 
                  ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(16, 185, 129, 0.1))' 
                  : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid #a855f7' : '3px solid transparent',
                color: activeTab === tab.key ? '#a855f7' : 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                borderRadius: '12px 12px 0 0',
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(168, 85, 247, 0.2)',
              borderTopColor: '#a855f7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem',
            }}></div>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem' }}>
              Loading educational content...
            </p>
          </div>
        ) : (
          <>
            {/* Programs Tab */}
            {activeTab === 'programs' && (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                {filteredPrograms.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '4rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}>
                    <p style={{ fontSize: '1.2rem' }}>No programs found matching your criteria.</p>
                  </div>
                ) : (
                  filteredPrograms.map(program => (
                    <div
                      key={program.programId || (program as any).id}
                      className="kontext-program-card"
                      onClick={() => {
                        if (onProgramClick) {
                          onProgramClick(program.programId || (program as any).id);
                        }
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        borderRadius: '20px',
                        padding: '2rem',
                        cursor: onProgramClick ? 'pointer' : 'default',
                        transition: 'all 0.5s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        if (onProgramClick) {
                        e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 20px 60px rgba(168, 85, 247, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (onProgramClick) {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                        }
                      }}
                    >
                      {/* Gradient Top Bar - Tri-Color DNA */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
                      }}></div>

                      {/* Icon Badge - Orange Accent */}
                      <div style={{
                        width: '70px',
                        height: '70px',
                        background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        marginBottom: '1.5rem',
                        boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3)',
                      }}>
                        {(program as any).icon || '🎓'}
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '0.75rem',
                      }}>
                        {program.title}
                      </h3>

                      {/* Description */}
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '1rem',
                        lineHeight: '1.6',
                        marginBottom: '1.5rem',
                      }}>
                        {program.description}
                      </p>

                      {/* Meta Info */}
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <div style={{
                          padding: '0.5rem 1rem',
                          background: `${getDifficultyColor(program.difficulty)}20`,
                          border: `1px solid ${getDifficultyColor(program.difficulty)}50`,
                          borderRadius: '8px',
                          color: getDifficultyColor(program.difficulty),
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}>
                          {getDifficultyString(program.difficulty)}
                        </div>
                        <div style={{
                          padding: '0.5rem 1rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '8px',
                          color: '#10b981',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                        }}>
                          {formatDegreeType(program.degreeType)}
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        <span>📚 {
                          // 🔥 FIX: Safe access - check for courseIds, requiredCourses, or electiveCourses
                          (() => {
                            const courseIds = (program as any).courseIds || [];
                            const requiredCourses = program.requiredCourses || [];
                            const electiveCourses = program.electiveCourses || [];
                            const totalCourses = courseIds.length || (requiredCourses.length + electiveCourses.length);
                            return totalCourses;
                          })()
                        } Courses</span>
                        <span>⏱️ {
                          // 🔥 FIX: Safe access - check for durationWeeks or calculate from estimatedHours
                          (() => {
                            const durationWeeks = (program as any).durationWeeks;
                            const estimatedHours = (program as any).estimatedHours;
                            if (durationWeeks) return durationWeeks;
                            if (estimatedHours) return Math.ceil(estimatedHours / 40); // Assume 40 hours per week
                            return 0;
                          })()
                        } weeks</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Programs Pagination */}
              {totalPrograms > ITEMS_PER_PAGE && (
                <div style={{
                  marginTop: '3rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1rem',
                }}>
                  <button
                    onClick={() => setProgramsPage(p => Math.max(1, p - 1))}
                    disabled={programsPage === 1 || loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      background: programsPage === 1 
                        ? 'rgba(50, 50, 50, 0.5)' 
                        : 'rgba(16, 185, 129, 0.1)',
                      color: programsPage === 1 ? '#666' : '#10b981',
                      cursor: programsPage === 1 ? 'not-allowed' : 'pointer',
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
                    Page {programsPage} of {Math.ceil(totalPrograms / ITEMS_PER_PAGE)}
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginLeft: '0.5rem' }}>
                      ({totalPrograms} total)
                    </span>
                  </div>

                  <button
                    onClick={() => setProgramsPage(p => Math.min(Math.ceil(totalPrograms / ITEMS_PER_PAGE), p + 1))}
                    disabled={programsPage >= Math.ceil(totalPrograms / ITEMS_PER_PAGE) || loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      background: programsPage >= Math.ceil(totalPrograms / ITEMS_PER_PAGE)
                        ? 'rgba(50, 50, 50, 0.5)'
                        : 'rgba(16, 185, 129, 0.1)',
                      color: programsPage >= Math.ceil(totalPrograms / ITEMS_PER_PAGE) ? '#666' : '#10b981',
                      cursor: programsPage >= Math.ceil(totalPrograms / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
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

            {/* Courses Tab */}
            {activeTab === 'courses' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                {filteredCourses.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '4rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}>
                    <p style={{ fontSize: '1.2rem' }}>No courses found matching your criteria.</p>
                  </div>
                ) : (
                  filteredCourses.map(course => (
                    <div
                      key={course.courseId || (course as any).id}
                      className="kontext-course-card"
                      onClick={() => onCourseClick && onCourseClick(course.courseId || (course as any).id)}
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        borderRadius: '20px',
                        padding: '2rem',
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
                      {/* Gradient Top Bar - Tri-Color DNA */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #a855f7, #ff6b35, #10b981)',
                      }}></div>

                      {/* Icon Badge - Green Accent */}
                      <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.75rem',
                        marginBottom: '1.5rem',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                      }}>
                        {(course as any).icon || '📖'}
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: '1.4rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '0.75rem',
                      }}>
                        {course.title}
                      </h3>

                      {/* Description */}
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        marginBottom: '1.5rem',
                      }}>
                        {course.description}
                      </p>

                      {/* Difficulty Badge */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '0.5rem 1rem',
                          background: `${getDifficultyColor(course.difficulty)}20`,
                          border: `1px solid ${getDifficultyColor(course.difficulty)}50`,
                          borderRadius: '8px',
                          color: getDifficultyColor(course.difficulty),
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}>
                          {getDifficultyString(course.difficulty)}
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        <span>📹 {
                          // 🔥 FIX: Safe access - check for lessonIds
                          (() => {
                            const lessonIds = (course as any).lessonIds || [];
                            const lessons = (course as any).lessons || [];
                            return lessonIds.length || lessons.length || 0;
                          })()
                        } Lessons</span>
                        <span>⏱️ {
                          // 🔥 FIX: Safe access - check for estimatedHours or calculate from durationWeeks
                          (() => {
                            const estimatedHours = (course as any).estimatedHours;
                            const durationWeeks = (course as any).durationWeeks;
                            if (estimatedHours) return estimatedHours;
                            if (durationWeeks) return durationWeeks * 40; // Assume 40 hours per week
                            return 0;
                          })()
                        }h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Courses Pagination */}
              {totalCourses > ITEMS_PER_PAGE && (
                <div style={{
                  marginTop: '3rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1rem',
                }}>
                  <button
                    onClick={() => setCoursesPage(p => Math.max(1, p - 1))}
                    disabled={coursesPage === 1 || loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      background: coursesPage === 1 
                        ? 'rgba(50, 50, 50, 0.5)' 
                        : 'rgba(168, 85, 247, 0.1)',
                      color: coursesPage === 1 ? '#666' : '#a855f7',
                      cursor: coursesPage === 1 ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    ← Previous
                  </button>

                  <div style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    background: 'rgba(168, 85, 247, 0.1)',
                    color: '#a855f7',
                    fontWeight: '600',
                  }}>
                    Page {coursesPage} of {Math.ceil(totalCourses / ITEMS_PER_PAGE)}
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginLeft: '0.5rem' }}>
                      ({totalCourses} total)
                    </span>
                  </div>

                  <button
                    onClick={() => setCoursesPage(p => Math.min(Math.ceil(totalCourses / ITEMS_PER_PAGE), p + 1))}
                    disabled={coursesPage >= Math.ceil(totalCourses / ITEMS_PER_PAGE) || loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      background: coursesPage >= Math.ceil(totalCourses / ITEMS_PER_PAGE)
                        ? 'rgba(50, 50, 50, 0.5)'
                        : 'rgba(168, 85, 247, 0.1)',
                      color: coursesPage >= Math.ceil(totalCourses / ITEMS_PER_PAGE) ? '#666' : '#a855f7',
                      cursor: coursesPage >= Math.ceil(totalCourses / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
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

            {/* Learning Paths Tab */}
            {activeTab === 'paths' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
                {learningPaths.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '4rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}>
                    <p style={{ fontSize: '1.2rem' }}>No learning paths available yet.</p>
                  </div>
                ) : (
                  learningPaths.map(path => (
                    <div
                      key={path.pathId || (path as any).id}
                      className="kontext-path-card"
                      onClick={() => {
                        if (onPathClick) {
                          onPathClick(path.pathId || (path as any).id);
                        }
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.08), rgba(168, 85, 247, 0.05))',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '20px',
                        padding: '2rem',
                        cursor: onPathClick ? 'pointer' : 'default',
                        transition: 'all 0.5s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        if (onPathClick) {
                        e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 20px 60px rgba(245, 158, 11, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (onPathClick) {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(245, 158, 11, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                        }
                      }}
                    >
                      {/* Gradient Top Bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #c084fc, #a855f7)',
                      }}></div>

                      {/* Icon Badge */}
                      <div style={{
                        width: '70px',
                        height: '70px',
                        background: 'linear-gradient(135deg, #c084fc, #a855f7)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        marginBottom: '1.5rem',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
                      }}>
                        🗺️
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        marginBottom: '0.75rem',
                      }}>
                        {path.title}
                      </h3>

                      {/* Description */}
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '1rem',
                        lineHeight: '1.6',
                        marginBottom: '1.5rem',
                      }}>
                        {path.description}
                      </p>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        <span>📚 {
                          // 🔥 FIX: Safe access - check for courseIds
                          (() => {
                            const courseIds = path.courseIds || [];
                            const courses = (path as any).courses || [];
                            return courseIds.length || courses.length || 0;
                          })()
                        } Courses</span>
                        <span>⏱️ {
                          // 🔥 FIX: Safe access - check for estimatedWeeks or calculate from estimatedHours
                          (() => {
                            const estimatedWeeks = (path as any).estimatedWeeks;
                            const estimatedHours = path.estimatedHours;
                            if (estimatedWeeks) return estimatedWeeks;
                            if (estimatedHours) return Math.ceil(estimatedHours / 40); // Assume 40 hours per week
                            return 0;
                          })()
                        } weeks</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Global Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .kontext-hero-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(168, 85, 247, 0.1) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .kontext-hero-card:hover::after {
          opacity: 1;
        }

        .kontext-program-card::before,
        .kontext-course-card::before,
        .kontext-path-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #a855f7, #10b981);
          transform: scaleX(0.3);
          transform-origin: left;
          transition: transform 0.5s ease;
        }

        .kontext-program-card:hover::before,
        .kontext-course-card:hover::before,
        .kontext-path-card:hover::before {
          transform: scaleX(1);
        }
      `}</style>
    </div>
  );
};
