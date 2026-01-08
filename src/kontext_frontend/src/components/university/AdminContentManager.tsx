/**
 * Admin Content Manager
 * Comprehensive admin interface for creating and managing university content
 */

import React, { useState } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { DifficultyLevel, DegreeType, AssessmentType, Question } from '../../types';

export const AdminContentManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'programs' | 'courses' | 'lessons' | 'assessments'>('programs');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      overflowY: 'auto',
      zIndex: 9999,
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        padding: '1.5rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          🎓 University Content Manager
        </h1>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
          {(['programs', 'courses', 'lessons', 'assessments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 2rem',
                background: activeTab === tab ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #8B5CF6' : '2px solid transparent',
                color: activeTab === tab ? '#8B5CF6' : '#9CA3AF',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'programs' && '🎯 Programs'}
              {tab === 'courses' && '📚 Courses'}
              {tab === 'lessons' && '🎥 Lessons'}
              {tab === 'assessments' && '📝 Assessments'}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'programs' && <CreateProgramForm />}
        {activeTab === 'courses' && <CreateCourseForm />}
        {activeTab === 'lessons' && <CreateLessonForm />}
        {activeTab === 'assessments' && <CreateAssessmentForm />}
      </div>
    </div>
  );
};

// Create Program Form
const CreateProgramForm: React.FC = () => {
  const { identity, agent } = useAppStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [degreeType, setDegreeType] = useState<DegreeType>('certificate');
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [totalCredits, setTotalCredits] = useState(30);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner');
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!identity || !agent) return;

    try {
      setSubmitting(true);
      const universityService = createUniversityService(identity, agent);
      await universityService.createProgram(
        title,
        description,
        degreeType,
        durationWeeks,
        totalCredits,
        [], // requiredCourses - add later
        [], // electiveCourses - add later
        [],
        subscriptionTier,
        imageUrl,
        difficulty
      );
      alert('✅ Program created successfully!');
      // Reset form
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create program:', error);
      alert('❌ Failed to create program. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '16px',
      padding: '2rem',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '2rem' }}>
        Create Academic Program
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bachelor of Science in Computer Science"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Degree Type *
          </label>
          <select
            value={degreeType}
            onChange={(e) => setDegreeType(e.target.value as DegreeType)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            <option value="certificate">Certificate</option>
            <option value="associate">Associate Degree</option>
            <option value="bachelor">Bachelor Degree</option>
            <option value="master">Master Degree</option>
            <option value="doctorate">Doctorate</option>
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the program..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Duration (weeks) *
          </label>
          <input
            type="number"
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Total Credits *
          </label>
          <input
            type="number"
            value={totalCredits}
            onChange={(e) => setTotalCredits(parseInt(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Difficulty *
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Subscription Tier *
          </label>
          <select
            value={subscriptionTier}
            onChange={(e) => setSubscriptionTier(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="professional">Professional</option>
            <option value="team">Team</option>
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Image URL
          </label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
            }}
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          marginTop: '2rem',
          padding: '1rem 3rem',
          background: submitting ? '#6B7280' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          border: 'none',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '1.1rem',
          fontWeight: '700',
          cursor: submitting ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
        }}
      >
        {submitting ? 'Creating...' : '✨ Create Program'}
      </button>
    </div>
  );
};

// Create Course Form (Simplified - similar pattern)
const CreateCourseForm: React.FC = () => {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '16px',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
        📚 Create Course
      </h2>
      <p style={{ color: '#9CA3AF' }}>
        Course creation form - similar structure to Programs
      </p>
    </div>
  );
};

// Create Lesson Form (Simplified)
const CreateLessonForm: React.FC = () => {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '16px',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
        🎥 Create Lesson
      </h2>
      <p style={{ color: '#9CA3AF' }}>
        Lesson creation form - YouTube URL, duration, resources
      </p>
    </div>
  );
};

// Create Assessment Form (Simplified)
const CreateAssessmentForm: React.FC = () => {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '16px',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
        📝 Create Assessment
      </h2>
      <p style={{ color: '#9CA3AF' }}>
        Assessment creation form - Questions, answers, grading
      </p>
    </div>
  );
};


