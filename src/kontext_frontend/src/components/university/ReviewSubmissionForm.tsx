/**
 * Review Submission Form
 * Submit reviews for courses, lessons, or programs
 */

import React, { useState } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { DifficultyLevel } from '../../types';

interface ReviewSubmissionFormProps {
  courseId?: string;
  lessonId?: string;
  programId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const ReviewSubmissionForm: React.FC<ReviewSubmissionFormProps> = ({
  courseId,
  lessonId,
  programId,
  onClose,
  onSubmitted,
}) => {
  const { identity, agent } = useAppStore();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [pros, setPros] = useState<string[]>(['']);
  const [cons, setCons] = useState<string[]>(['']);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | ''>('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleAddPro = () => {
    setPros([...pros, '']);
  };

  const handleRemovePro = (index: number) => {
    setPros(pros.filter((_, i) => i !== index));
  };

  const handleProChange = (index: number, value: string) => {
    const newPros = [...pros];
    newPros[index] = value;
    setPros(newPros);
  };

  const handleAddCon = () => {
    setCons([...cons, '']);
  };

  const handleRemoveCon = (index: number) => {
    setCons(cons.filter((_, i) => i !== index));
  };

  const handleConChange = (index: number, value: string) => {
    const newCons = [...cons];
    newCons[index] = value;
    setCons(newCons);
  };

  const handleSubmit = async () => {
    if (!identity || !agent) return;
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    if (!comment.trim()) {
      alert('Please write a review');
      return;
    }

    try {
      setSubmitting(true);
      const universityService = createUniversityService(identity, agent);

      const filteredPros = pros.filter(p => p.trim() !== '');
      const filteredCons = cons.filter(c => c.trim() !== '');

      await universityService.submitReview(
        courseId || null,
        lessonId || null,
        programId || null,
        rating,
        title,
        comment,
        filteredPros,
        filteredCons,
        difficulty || null,
        wouldRecommend,
        false // isVerifiedCompletion - would be determined by backend
      );

      alert('✅ Review submitted successfully!');
      if (onSubmitted) {
        onSubmitted();
      }
      onClose();
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('❌ Failed to submit review. Please try again.');
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
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '2rem',
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '16px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
            ✍️ Write a Review
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Rating */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: '600' }}>
            Rating *
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '2.5rem',
                  cursor: 'pointer',
                  color: (hoverRating || rating) >= star ? '#F59E0B' : '#374151',
                  transition: 'all 0.2s',
                  padding: 0,
                }}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your experience in one sentence"
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

        {/* Comment */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Review *
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your detailed experience..."
            rows={6}
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

        {/* Pros */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            👍 Pros (Optional)
          </label>
          {pros.map((pro, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={pro}
                onChange={(e) => handleProChange(index, e.target.value)}
                placeholder="What did you like?"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                }}
              />
              {pros.length > 1 && (
                <button
                  onClick={() => handleRemovePro(index)}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#EF4444',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddPro}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#10B981',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginTop: '0.5rem',
            }}
          >
            + Add Pro
          </button>
        </div>

        {/* Cons */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            👎 Cons (Optional)
          </label>
          {cons.map((con, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={con}
                onChange={(e) => handleConChange(index, e.target.value)}
                placeholder="What could be improved?"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                }}
              />
              {cons.length > 1 && (
                <button
                  onClick={() => handleRemoveCon(index)}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#EF4444',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddCon}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginTop: '0.5rem',
            }}
          >
            + Add Con
          </button>
        </div>

        {/* Difficulty */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#D1D5DB', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
            Difficulty Level (Optional)
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel | '')}
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
            <option value="">Select difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        {/* Would Recommend */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            color: '#D1D5DB',
            fontSize: '0.95rem',
          }}>
            <input
              type="checkbox"
              checked={wouldRecommend}
              onChange={(e) => setWouldRecommend(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
              }}
            />
            I would recommend this to others
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '8px',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '0.75rem 2rem',
              background: submitting ? '#6B7280' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};


