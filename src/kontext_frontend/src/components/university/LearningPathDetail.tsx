/**
 * Learning Path Detail View
 * Shows detailed information about a learning path and its included programs/courses
 */

import React, { useState, useEffect } from 'react';
import { HttpAgent } from '@dfinity/agent';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { LearningPath, AcademicProgram, Course } from '../../types';

interface LearningPathDetailProps {
  pathId: string;
  onBack: () => void;
  onProgramClick?: (programId: string) => void;
  onCourseClick?: (courseId: string) => void;
}

export const LearningPathDetail: React.FC<LearningPathDetailProps> = ({
  pathId,
  onBack,
  onProgramClick,
  onCourseClick
}) => {
  const identity = useAppStore(state => state.identity);
  const principalId = useAppStore(state => state.principal?.toString());
  
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
      
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        httpAgent.fetchRootKey().catch(err => {
          console.warn('⚠️ [LearningPathDetail] Failed to fetch root key:', err);
        });
      }
      
      return httpAgent;
    } catch (error) {
      console.error('❌ [LearningPathDetail] Failed to create agent:', error);
      return null;
    }
  }, [identity]);
  
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    loadPathData();
  }, [pathId, identity, agent]);

  const loadPathData = async () => {
    if (!identity || !agent) {
      console.warn('⚠️ [LearningPathDetail] Identity or agent not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const service = createUniversityService(identity, agent);

      // Load the learning path
      const paths = await service.getLearningPaths();
      const pathData = paths.find((p: any) => p.pathId === pathId);

      if (pathData) {
        setPath(pathData);

        // Load associated programs
        if (pathData.programIds && pathData.programIds.length > 0) {
          const programsData = await Promise.all(
            pathData.programIds.map((id: string) => service.getProgram(id))
          );
          setPrograms(programsData.filter((p): p is AcademicProgram => p !== null));
        }

        // Load associated courses
        if (pathData.courseIds && pathData.courseIds.length > 0) {
          const coursesData = await Promise.all(
            pathData.courseIds.map((id: string) => service.getCourse(id))
          );
          setCourses(coursesData.filter((c): c is Course => c !== null));
        }
      }
    } catch (error) {
      console.error('❌ [LearningPathDetail] Failed to load path data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: any): string => {
    const diffStr = typeof difficulty === 'object' && difficulty !== null 
      ? Object.keys(difficulty)[0] 
      : String(difficulty);
    
    switch (diffStr?.toLowerCase()) {
      case 'beginner': return '#10b981';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      case 'expert': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" 
            style={{ borderColor: 'rgba(168, 85, 247, 0.3)', borderTopColor: '#a855f7' }}></div>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Loading learning path...</p>
        </div>
      </div>
    );
  }

  if (!path) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div className="text-center">
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗺️</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Learning Path Not Found</h2>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ← Back to University
          </button>
        </div>
      </div>
    );
  }

  const difficultyColor = getDifficultyColor(path.difficulty);
  const difficultyText = typeof path.difficulty === 'object' && path.difficulty !== null
    ? Object.keys(path.difficulty)[0]
    : String(path.difficulty);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
      color: '#ffffff',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        padding: '2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: 'pointer',
            marginBottom: '1rem',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          ← Back
        </button>
      </div>

      {/* Hero Section */}
      <div style={{
        padding: '4rem 2rem',
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.1))',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗺️</div>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '1rem' }}>
          {path.title}
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          {path.description}
        </p>

        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <div style={{
            padding: '1rem 2rem',
            background: 'rgba(168, 85, 247, 0.2)',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>Role</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{path.forRole}</div>
          </div>

          <div style={{
            padding: '1rem 2rem',
            background: `${difficultyColor}20`,
            borderRadius: '12px',
            border: `1px solid ${difficultyColor}50`
          }}>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>Difficulty</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: difficultyColor, textTransform: 'capitalize' }}>
              {difficultyText}
            </div>
          </div>

          <div style={{
            padding: '1rem 2rem',
            background: 'rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>Duration</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{path.estimatedHours} hours</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Programs Section */}
        {programs.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>🎓</span>
              <span>Included Programs ({programs.length})</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {programs.map(program => (
                <div
                  key={program.programId}
                  onClick={() => onProgramClick && onProgramClick(program.programId)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.1))',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    cursor: onProgramClick ? 'pointer' : 'default',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (onProgramClick) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onProgramClick) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    {program.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
                    {program.description.substring(0, 120)}...
                  </p>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {program.estimatedHours} hours
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Courses Section */}
        {courses.length > 0 && (
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>📚</span>
              <span>Included Courses ({courses.length})</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {courses.map(course => (
                <div
                  key={course.courseId}
                  onClick={() => onCourseClick && onCourseClick(course.courseId)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(168, 85, 247, 0.1))',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: onCourseClick ? 'pointer' : 'default',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (onCourseClick) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onCourseClick) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
                    {course.description.substring(0, 120)}...
                  </p>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {course.estimatedHours} hours
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


