/**
 * University Content Manager
 * 
 * Admin interface for creating and managing university content:
 * - Academic Programs
 * - Courses
 * - Lessons
 */

import React, { useState, useEffect } from 'react';
import { GraduationCap, BookOpen, Video, Plus, Trash2, Save, Settings, Eye, EyeOff } from 'lucide-react';
import { platformCanisterService } from '../services/PlatformCanisterService';
import { createUniversityService } from '../services/UniversityService';
import { useAppStore } from '../store/appStore';

type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type DegreeType = 'certificate' | 'associate' | 'bachelor' | 'master' | 'doctorate';
type AccessTier = 'free' | 'starter' | 'developer' | 'pro' | 'enterprise';

interface ProgramForm {
  title: string;
  description: string;
  shortDescription: string;
  thumbnailUrl: string;
  instructorName: string;
  courseIds: string[];
  requiredCourses: string[];
  electiveCourses: string[];
  totalCredits: number;
  estimatedHours: number;
  difficulty: DifficultyLevel;
  category: string;
  tags: string[];
  prerequisites: string[];
  degreeType: DegreeType;
}

interface CourseForm {
  programId: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnailUrl: string;
  instructorName: string;
  lessonIds: string[];
  credits: number;
  estimatedHours: number;
  difficulty: DifficultyLevel;
  category: string;
  tags: string[];
  prerequisites: string[];
  accessTier: AccessTier;
  syllabus: Array<{ week: number; topic: string; }>;
}

interface LessonForm {
  courseId: string;
  title: string;
  description: string;
  youtubeVideoId: string;
  duration: number;
  orderIndex: number;
  accessTier: AccessTier;
  isFree: boolean;
  resources: Array<{ 
    title: string; 
    url: string; 
    resourceType: 'pdf' | 'video' | 'article' | 'code' | 'quiz' | 'other';
  }>;
  transcript: string;
}

interface LearningPathForm {
  title: string;
  description: string;
  programIds: string[];
  courseIds: string[];
  estimatedHours: number;
  difficulty: DifficultyLevel;
  forRole: string;
}

export const UniversityContentManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'programs' | 'courses' | 'lessons' | 'paths' | 'manage'>('programs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Management view state
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allPaths, setAllPaths] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const { identity } = useAppStore();

  // Program form state
  const [programForm, setProgramForm] = useState<ProgramForm>({
    title: '',
    description: '',
    shortDescription: '',
    thumbnailUrl: '',
    instructorName: '',
    courseIds: [],
    requiredCourses: [],
    electiveCourses: [],
    totalCredits: 0,
    estimatedHours: 0,
    difficulty: 'beginner',
    category: '',
    tags: [],
    prerequisites: [],
    degreeType: 'certificate'
  });

  // Course form state
  const [courseForm, setCourseForm] = useState<CourseForm>({
    programId: '',
    title: '',
    description: '',
    shortDescription: '',
    thumbnailUrl: '',
    instructorName: '',
    lessonIds: [],
    credits: 0,
    estimatedHours: 0,
    difficulty: 'beginner',
    category: '',
    tags: [],
    prerequisites: [],
    accessTier: 'free',
    syllabus: []
  });

  // Lesson form state
  const [lessonForm, setLessonForm] = useState<LessonForm>({
    courseId: '',
    title: '',
    description: '',
    youtubeVideoId: '',
    duration: 0,
    orderIndex: 0,
    accessTier: 'free',
    isFree: true,
    resources: [],
    transcript: ''
  });

  const [pathForm, setPathForm] = useState<LearningPathForm>({
    title: '',
    description: '',
    programIds: [],
    courseIds: [],
    estimatedHours: 0,
    difficulty: 'beginner',
    forRole: ''
  });

  const handleSubmitProgram = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('📚 [UniversityContentManager] Creating program with platformCanisterService...');
      
      const programId = await platformCanisterService.createProgram(
        programForm.title,
        programForm.description,
        programForm.shortDescription,
        programForm.thumbnailUrl,
        programForm.instructorName,
        programForm.courseIds,
        programForm.requiredCourses,
        programForm.electiveCourses,
        programForm.totalCredits,
        programForm.estimatedHours,
        programForm.difficulty,
        programForm.category,
        programForm.tags,
        programForm.prerequisites,
        programForm.degreeType
      );
      
      setSuccess(`✅ Program created successfully! ID: ${programId}`);
      // Reset form
      setProgramForm({
        title: '',
        description: '',
        shortDescription: '',
        thumbnailUrl: '',
        instructorName: '',
        courseIds: [],
        requiredCourses: [],
        electiveCourses: [],
        totalCredits: 0,
        estimatedHours: 0,
        difficulty: 'beginner',
        category: '',
        tags: [],
        prerequisites: [],
        degreeType: 'certificate'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCourse = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('📖 [UniversityContentManager] Creating course with platformCanisterService...');
      
      const courseId = await platformCanisterService.createCourse(
        courseForm.programId,
        courseForm.title,
        courseForm.description,
        courseForm.shortDescription,
        courseForm.thumbnailUrl,
        courseForm.instructorName,
        courseForm.lessonIds,
        courseForm.credits,
        courseForm.estimatedHours,
        courseForm.difficulty,
        courseForm.category,
        courseForm.tags,
        courseForm.prerequisites,
        courseForm.accessTier,
        courseForm.syllabus
      );
      
      setSuccess(`✅ Course created successfully! ID: ${courseId}`);
      // Reset form
      setCourseForm({
        programId: '',
        title: '',
        description: '',
        shortDescription: '',
        thumbnailUrl: '',
        instructorName: '',
        lessonIds: [],
        credits: 0,
        estimatedHours: 0,
        difficulty: 'beginner',
        category: '',
        tags: [],
        prerequisites: [],
        accessTier: 'free',
        syllabus: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLesson = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('🎥 [UniversityContentManager] Creating lesson with platformCanisterService...');
      
      const lessonId = await platformCanisterService.createLesson(
        lessonForm.courseId,
        lessonForm.title,
        lessonForm.description,
        lessonForm.youtubeVideoId,
        lessonForm.duration,
        lessonForm.orderIndex,
        lessonForm.accessTier,
        lessonForm.isFree,
        lessonForm.resources,
        lessonForm.transcript
      );
      
      setSuccess(`✅ Lesson created successfully! ID: ${lessonId}`);
      // Reset form
      setLessonForm({
        courseId: '',
        title: '',
        description: '',
        youtubeVideoId: '',
        duration: 0,
        orderIndex: 0,
        accessTier: 'free',
        isFree: true,
        resources: [],
        transcript: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPath = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('🗺️ [UniversityContentManager] Creating learning path...');
      
      const pathId = await platformCanisterService.createLearningPath(
        pathForm.title,
        pathForm.description,
        pathForm.programIds,
        pathForm.courseIds,
        pathForm.estimatedHours,
        pathForm.difficulty,
        pathForm.forRole
      );
      
      setSuccess(`✅ Learning Path created successfully! ID: ${pathId}`);
      // Reset form
      setPathForm({
        title: '',
        description: '',
        programIds: [],
        courseIds: [],
        estimatedHours: 0,
        difficulty: 'beginner',
        forRole: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create learning path');
    } finally {
      setLoading(false);
    }
  };

  // Load all programs and courses for management view
  const loadAllContent = async () => {
    if (!identity) {
      setError('Identity not available');
      return;
    }
    
    setLoadingContent(true);
    setError(null);
    
    try {
      const { HttpAgent } = await import('@dfinity/agent');
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:4943'
        : 'https://icp0.io';
      const agent = new HttpAgent({ host, identity });
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      const universityService = createUniversityService(identity, agent);
      const [programs, courses, paths] = await Promise.all([
        universityService.getAllPrograms(),
        universityService.getAllCourses(),
        platformCanisterService.getLearningPaths()
      ]);
      
      setAllPrograms(programs);
      setAllCourses(courses);
      setAllPaths(paths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoadingContent(false);
    }
  };

  // Load content when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage' && identity) {
      loadAllContent();
    }
  }, [activeTab, identity]);

  // Handle publish/unpublish program
  const handleToggleProgramPublish = async (programId: string, currentStatus: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await platformCanisterService.publishProgram(programId, !currentStatus);
      if ('ok' in result) {
        setSuccess(`✅ Program ${!currentStatus ? 'published' : 'unpublished'} successfully!`);
        await loadAllContent(); // Reload to show updated status
      } else {
        setError(result.err || 'Failed to update program');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update program');
    } finally {
      setLoading(false);
    }
  };

  // Handle publish/unpublish course
  const handleToggleCoursePublish = async (courseId: string, currentStatus: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await platformCanisterService.publishCourse(courseId, !currentStatus);
      if ('ok' in result) {
        setSuccess(`✅ Course ${!currentStatus ? 'published' : 'unpublished'} successfully!`);
        await loadAllContent(); // Reload to show updated status
      } else {
        setError(result.err || 'Failed to update course');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update course');
    } finally {
      setLoading(false);
    }
  };

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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '0.5rem'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease'
  };

  return (
    <div style={{
      background: 'rgb(17, 17, 17)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '1200px',
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
          <GraduationCap size={28} color="#f97316" />
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            University Content Manager
          </h2>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
          Create and manage educational content
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#ef4444',
          fontSize: '0.9rem'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          fontSize: '0.9rem'
        }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('programs')}
          style={{
            ...buttonStyle,
            background: activeTab === 'programs' 
              ? 'linear-gradient(135deg, #f97316, #fbbf24)' 
              : 'rgba(55, 65, 81, 0.5)',
            color: '#ffffff'
          }}
        >
          <GraduationCap size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Programs
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          style={{
            ...buttonStyle,
            background: activeTab === 'courses' 
              ? 'linear-gradient(135deg, #f97316, #fbbf24)' 
              : 'rgba(55, 65, 81, 0.5)',
            color: '#ffffff'
          }}
        >
          <BookOpen size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Courses
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          style={{
            ...buttonStyle,
            background: activeTab === 'lessons' 
              ? 'linear-gradient(135deg, #f97316, #fbbf24)' 
              : 'rgba(55, 65, 81, 0.5)',
            color: '#ffffff'
          }}
        >
          <Video size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Lessons
        </button>
        <button
          onClick={() => setActiveTab('paths')}
          style={{
            ...buttonStyle,
            background: activeTab === 'paths' 
              ? 'linear-gradient(135deg, #f97316, #fbbf24)' 
              : 'rgba(55, 65, 81, 0.5)',
            color: '#ffffff'
          }}
        >
          🗺️ Learning Paths
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            ...buttonStyle,
            background: activeTab === 'manage' 
              ? 'linear-gradient(135deg, #f97316, #fbbf24)' 
              : 'rgba(55, 65, 81, 0.5)',
            color: '#ffffff'
          }}
        >
          <Settings size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Manage
        </button>
      </div>

      {/* Program Form */}
      {activeTab === 'programs' && (
        <div>
          <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Create Program</h3>
          
          <label style={labelStyle}>Program Title</label>
          <input
            type="text"
            value={programForm.title}
            onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
            placeholder="e.g., Full-Stack Web Development Certificate"
            style={inputStyle}
          />

          <label style={labelStyle}>Short Description (one-liner)</label>
          <input
            type="text"
            value={programForm.shortDescription}
            onChange={(e) => setProgramForm({ ...programForm, shortDescription: e.target.value })}
            placeholder="Brief one-line description"
            style={inputStyle}
          />

          <label style={labelStyle}>Full Description</label>
          <textarea
            value={programForm.description}
            onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
            placeholder="Detailed description of the program"
            rows={4}
            style={{...inputStyle, resize: 'vertical'}}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Instructor Name</label>
              <input
                type="text"
                value={programForm.instructorName}
                onChange={(e) => setProgramForm({ ...programForm, instructorName: e.target.value })}
                placeholder="e.g., Dr. Jane Smith"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Thumbnail URL</label>
              <input
                type="text"
                value={programForm.thumbnailUrl}
                onChange={(e) => setProgramForm({ ...programForm, thumbnailUrl: e.target.value })}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Total Credits</label>
              <input
                type="number"
                value={programForm.totalCredits}
                onChange={(e) => setProgramForm({ ...programForm, totalCredits: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Estimated Hours</label>
              <input
                type="number"
                value={programForm.estimatedHours}
                onChange={(e) => setProgramForm({ ...programForm, estimatedHours: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Difficulty Level</label>
              <select
                value={programForm.difficulty}
                onChange={(e) => setProgramForm({ ...programForm, difficulty: e.target.value as DifficultyLevel })}
                style={inputStyle}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                type="text"
                value={programForm.category}
                onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })}
                placeholder="e.g., Web Development"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Degree Type</label>
              <select
                value={programForm.degreeType}
                onChange={(e) => setProgramForm({ ...programForm, degreeType: e.target.value as DegreeType })}
                style={inputStyle}
              >
                <option value="certificate">Certificate</option>
                <option value="associate">Associate</option>
                <option value="bachelor">Bachelor</option>
                <option value="master">Master</option>
                <option value="doctorate">Doctorate</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmitProgram}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: loading 
                ? 'rgba(255, 107, 53, 0.3)' 
                : 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              width: '100%',
              marginTop: '1rem',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: '#fff', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                Creating Program...
              </span>
            ) : (
              <>
                <Save size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Create Program
              </>
            )}
          </button>
        </div>
      )}

      {/* Course Form */}
      {activeTab === 'courses' && (
        <div>
          <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Create Course</h3>
          
          <label style={labelStyle}>Program ID (from user canister)</label>
          <input
            type="text"
            value={courseForm.programId}
            onChange={(e) => setCourseForm({ ...courseForm, programId: e.target.value })}
            placeholder="program_xxx"
            style={inputStyle}
          />

          <label style={labelStyle}>Course Title</label>
          <input
            type="text"
            value={courseForm.title}
            onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
            placeholder="e.g., Introduction to React"
            style={inputStyle}
          />

          <label style={labelStyle}>Short Description</label>
          <input
            type="text"
            value={courseForm.shortDescription}
            onChange={(e) => setCourseForm({ ...courseForm, shortDescription: e.target.value })}
            placeholder="Brief one-line description"
            style={inputStyle}
          />

          <label style={labelStyle}>Full Description</label>
          <textarea
            value={courseForm.description}
            onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
            placeholder="Detailed description of the course"
            rows={4}
            style={{...inputStyle, resize: 'vertical'}}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Instructor Name</label>
              <input
                type="text"
                value={courseForm.instructorName}
                onChange={(e) => setCourseForm({ ...courseForm, instructorName: e.target.value })}
                placeholder="e.g., Dr. Jane Smith"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Thumbnail URL</label>
              <input
                type="text"
                value={courseForm.thumbnailUrl}
                onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Credits</label>
              <input
                type="number"
                value={courseForm.credits}
                onChange={(e) => setCourseForm({ ...courseForm, credits: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Estimated Hours</label>
              <input
                type="number"
                value={courseForm.estimatedHours}
                onChange={(e) => setCourseForm({ ...courseForm, estimatedHours: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Difficulty</label>
              <select
                value={courseForm.difficulty}
                onChange={(e) => setCourseForm({ ...courseForm, difficulty: e.target.value as DifficultyLevel })}
                style={inputStyle}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                type="text"
                value={courseForm.category}
                onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                placeholder="e.g., Frontend Development"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Access Tier</label>
              <select
                value={courseForm.accessTier}
                onChange={(e) => setCourseForm({ ...courseForm, accessTier: e.target.value as AccessTier })}
                style={inputStyle}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="developer">Developer</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmitCourse}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: loading 
                ? 'rgba(255, 107, 53, 0.3)' 
                : 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              width: '100%',
              marginTop: '1rem',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: '#fff', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                Creating Course...
              </span>
            ) : (
              <>
                <Save size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Create Course
              </>
            )}
          </button>
        </div>
      )}

      {/* Lesson Form */}
      {activeTab === 'lessons' && (
        <div>
          <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Create Lesson</h3>
          
          <label style={labelStyle}>Course ID (from user canister)</label>
          <input
            type="text"
            value={lessonForm.courseId}
            onChange={(e) => setLessonForm({ ...lessonForm, courseId: e.target.value })}
            placeholder="course_xxx"
            style={inputStyle}
          />

          <label style={labelStyle}>Lesson Title</label>
          <input
            type="text"
            value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
            placeholder="e.g., Setting Up Your React Environment"
            style={inputStyle}
          />

          <label style={labelStyle}>Description</label>
          <textarea
            value={lessonForm.description}
            onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
            placeholder="Detailed description of the lesson"
            rows={3}
            style={{...inputStyle, resize: 'vertical'}}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>YouTube Video ID</label>
              <input
                type="text"
                value={lessonForm.youtubeVideoId}
                onChange={(e) => setLessonForm({ ...lessonForm, youtubeVideoId: e.target.value })}
                placeholder="dQw4w9WgXcQ"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Duration (minutes)</label>
              <input
                type="number"
                value={lessonForm.duration}
                onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Order Index</label>
              <input
                type="number"
                value={lessonForm.orderIndex}
                onChange={(e) => setLessonForm({ ...lessonForm, orderIndex: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Access Tier</label>
              <select
                value={lessonForm.accessTier}
                onChange={(e) => setLessonForm({ ...lessonForm, accessTier: e.target.value as AccessTier })}
                style={inputStyle}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="developer">Developer</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Is Free Preview?</label>
              <select
                value={lessonForm.isFree ? 'true' : 'false'}
                onChange={(e) => setLessonForm({ ...lessonForm, isFree: e.target.value === 'true' })}
                style={inputStyle}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>Transcript (optional)</label>
          <textarea
            value={lessonForm.transcript}
            onChange={(e) => setLessonForm({ ...lessonForm, transcript: e.target.value })}
            placeholder="Video transcript text..."
            rows={4}
            style={{...inputStyle, resize: 'vertical'}}
          />

          <button
            onClick={handleSubmitLesson}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: loading 
                ? 'rgba(255, 107, 53, 0.3)' 
                : 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              width: '100%',
              marginTop: '1rem',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: '#fff', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                Creating Lesson...
              </span>
            ) : (
              <>
                <Save size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Create Lesson
              </>
            )}
          </button>
        </div>
      )}

      {/* Learning Path Form */}
      {activeTab === 'paths' && (
        <div>
          <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Create Learning Path</h3>
          
          <label style={labelStyle}>Path Title</label>
          <input
            type="text"
            value={pathForm.title}
            onChange={(e) => setPathForm({...pathForm, title: e.target.value})}
            style={inputStyle}
            placeholder="Full Stack Developer Path"
          />

          <label style={labelStyle}>Description</label>
          <textarea
            value={pathForm.description}
            onChange={(e) => setPathForm({...pathForm, description: e.target.value})}
            style={{...inputStyle, minHeight: '100px'}}
            placeholder="Comprehensive path to become a full-stack developer..."
          />

          <label style={labelStyle}>For Role</label>
          <input
            type="text"
            value={pathForm.forRole}
            onChange={(e) => setPathForm({...pathForm, forRole: e.target.value})}
            style={inputStyle}
            placeholder="Full Stack Developer, Frontend Developer, etc."
          />

          <label style={labelStyle}>Program IDs (comma-separated)</label>
          <input
            type="text"
            value={pathForm.programIds.join(', ')}
            onChange={(e) => setPathForm({...pathForm, programIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
            style={inputStyle}
            placeholder="program_xxx, program_yyy"
          />

          <label style={labelStyle}>Course IDs (comma-separated)</label>
          <input
            type="text"
            value={pathForm.courseIds.join(', ')}
            onChange={(e) => setPathForm({...pathForm, courseIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
            style={inputStyle}
            placeholder="course_xxx, course_yyy"
          />

          <label style={labelStyle}>Estimated Hours</label>
          <input
            type="number"
            value={pathForm.estimatedHours}
            onChange={(e) => setPathForm({...pathForm, estimatedHours: parseInt(e.target.value) || 0})}
            style={inputStyle}
            placeholder="120"
          />

          <label style={labelStyle}>Difficulty</label>
          <select
            value={pathForm.difficulty}
            onChange={(e) => setPathForm({...pathForm, difficulty: e.target.value as DifficultyLevel})}
            style={inputStyle}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>

          <button
            onClick={handleSubmitPath}
            disabled={loading}
            style={{
              ...buttonStyle,
              width: '100%',
              marginTop: '1.5rem',
              background: loading 
                ? 'rgba(55, 65, 81, 0.5)' 
                : 'linear-gradient(135deg, #f97316, #fbbf24)',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: '#fff', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                Creating Learning Path...
              </span>
            ) : (
              <>
                <Save size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Create Learning Path
              </>
            )}
          </button>
        </div>
      )}

      {/* Management View */}
      {activeTab === 'manage' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#ffffff', fontSize: '1.25rem' }}>Manage Programs & Courses</h3>
            <button
              onClick={loadAllContent}
              disabled={loadingContent}
              style={{
                ...buttonStyle,
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                opacity: loadingContent ? 0.6 : 1,
                cursor: loadingContent ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingContent ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {loadingContent ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Loading content...
            </div>
          ) : (
            <>
              {/* Programs List */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.1rem' }}>
                  📚 Programs ({allPrograms.length})
                </h4>
                {allPrograms.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: 'rgba(55, 65, 81, 0.3)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    No programs found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {allPrograms.map((program: any) => (
                      <div
                        key={program.programId}
                        style={{
                          padding: '1rem',
                          background: 'rgba(55, 65, 81, 0.3)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {program.title}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                            ID: {program.programId}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Status: {program.isPublished ? '✅ Published' : '⏸️ Draft'} | {program.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleProgramPublish(program.programId, program.isPublished)}
                          disabled={loading}
                          style={{
                            ...buttonStyle,
                            background: program.isPublished 
                              ? 'rgba(239, 68, 68, 0.2)' 
                              : 'rgba(34, 197, 94, 0.2)',
                            color: program.isPublished ? '#f87171' : '#4ade80',
                            border: `1px solid ${program.isPublished ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {program.isPublished ? (
                            <>
                              <EyeOff size={16} />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye size={16} />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Courses List */}
              <div>
                <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.1rem' }}>
                  📖 Courses ({allCourses.length})
                </h4>
                {allCourses.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: 'rgba(55, 65, 81, 0.3)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    No courses found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {allCourses.map((course: any) => (
                      <div
                        key={course.courseId}
                        style={{
                          padding: '1rem',
                          background: 'rgba(55, 65, 81, 0.3)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {course.title}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                            ID: {course.courseId}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Status: {course.isPublished ? '✅ Published' : '⏸️ Draft'} | {course.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleCoursePublish(course.courseId, course.isPublished)}
                          disabled={loading}
                          style={{
                            ...buttonStyle,
                            background: course.isPublished 
                              ? 'rgba(239, 68, 68, 0.2)' 
                              : 'rgba(34, 197, 94, 0.2)',
                            color: course.isPublished ? '#f87171' : '#4ade80',
                            border: `1px solid ${course.isPublished ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {course.isPublished ? (
                            <>
                              <EyeOff size={16} />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye size={16} />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Learning Paths List */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.1rem' }}>
                  🗺️ Learning Paths ({allPaths.length})
                </h4>
                {allPaths.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: 'rgba(55, 65, 81, 0.3)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    No learning paths found. Create one in the "Learning Paths" tab.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {allPaths.map((path: any) => (
                      <div
                        key={path.pathId}
                        style={{
                          padding: '1rem',
                          background: 'rgba(55, 65, 81, 0.3)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {path.title}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                            For: {path.forRole} | {path.estimatedHours}h
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Programs: {path.programIds?.length || 0} | Courses: {path.courseIds?.length || 0}
                          </div>
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.75rem' }}>
                          {path.pathId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
