/**
 * Assessment Interface - Kontext Style
 * Take quizzes, tests, midterms, finals, and projects with stunning UI
 */

import React, { useState, useEffect, useRef } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { Assessment, AssessmentSubmission, Answer, Question } from '../../types';

interface AssessmentInterfaceProps {
  assessmentId: string;
  onBack: () => void;
  onComplete?: () => void;
}

export const AssessmentInterface: React.FC<AssessmentInterfaceProps> = ({
  assessmentId,
  onBack,
  onComplete,
}) => {
  const { identity, agent, principalId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [currentView, setCurrentView] = useState<'overview' | 'taking' | 'results'>('overview');
  
  // Assessment taking state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<AssessmentSubmission | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAssessmentData();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [assessmentId]);

  useEffect(() => {
    if (currentView === 'taking' && assessment?.timeLimit && timeRemaining !== null) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [currentView, timeRemaining]);

  const loadAssessmentData = async () => {
    if (!identity || !agent) return;

    try {
      setLoading(true);
      const universityService = createUniversityService(identity, agent);
      
      // In a real implementation, we'd need an endpoint to get assessments
      // For now, we'll simulate the data structure
      // const assessmentData = await universityService.getAssessment(assessmentId);
      
      if (principalId) {
        const submissionsData = await universityService.getStudentSubmissions(principalId, assessmentId);
        setSubmissions(submissionsData.sort((a, b) => Number(b.submittedAt - a.submittedAt)));
      }
    } catch (error) {
      console.error('Failed to load assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = () => {
    setCurrentView('taking');
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
    setStartTime(Date.now());
    
    if (assessment?.timeLimit) {
      setTimeRemaining(assessment.timeLimit * 60); // Convert minutes to seconds
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => new Map(prev).set(questionId, answer));
  };

  const handleNextQuestion = () => {
    if (assessment && currentQuestionIndex < assessment.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleAutoSubmit = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    await handleSubmitAssessment();
  };

  const handleSubmitAssessment = async () => {
    if (!identity || !agent || !assessment || !startTime) return;

    try {
      setSubmitting(true);
      const universityService = createUniversityService(identity, agent);
      
      // Build answers array with grading
      const answersArray: Answer[] = assessment.questions.map(question => {
        const studentAnswer = answers.get(question.questionId) || '';
        const isCorrect = question.correctAnswer === studentAnswer;
        const pointsEarned = isCorrect ? question.points : 0;

        return {
          questionId: question.questionId,
          selectedAnswer: studentAnswer,
          isCorrect,
          pointsEarned,
        };
      });

      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      
      const submissionId = await universityService.submitAssessment(
        assessmentId,
        answersArray,
        timeSpent
      );

      // Reload submissions to show the new one
      if (principalId) {
        const submissionsData = await universityService.getStudentSubmissions(principalId, assessmentId);
        const sortedSubmissions = submissionsData.sort((a, b) => Number(b.submittedAt - a.submittedAt));
        setSubmissions(sortedSubmissions);
        setLastSubmission(sortedSubmissions[0]);
      }

      setCurrentView('results');
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      alert('❌ Failed to submit assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeLabel = (type: string): string => {
    switch (type) {
      case 'multiple_choice': return 'Multiple Choice';
      case 'true_false': return 'True/False';
      case 'short_answer': return 'Short Answer';
      case 'essay': return 'Essay';
      case 'code': return 'Code';
      default: return type;
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
            Loading assessment...
          </p>
        </div>
      </div>
    );
  }

  if (!assessment) {
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
            Assessment not found
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check if student can still attempt
  const attemptsUsed = submissions.length;
  const canAttempt = attemptsUsed < assessment.attemptsAllowed;
  const bestScore = submissions.length > 0 ? Math.max(...submissions.map(s => s.score)) : 0;

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
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
            <div>
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700',
                background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
              }}>
                {assessment.title}
              </h2>
              <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.5rem' }}>
                📝 {assessment.questions.length} questions • ✅ Passing: {assessment.passingScore}%
              </div>
            </div>
          </div>

          {/* Timer (if active) - Kontext Style */}
          {currentView === 'taking' && timeRemaining !== null && (
            <div style={{
              padding: '1rem 2rem',
              background: timeRemaining < 300 
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))' 
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))',
              border: `2px solid ${timeRemaining < 300 ? '#EF4444' : 'rgba(168, 85, 247, 0.5)'}`,
              borderRadius: '16px',
              color: timeRemaining < 300 ? '#EF4444' : '#a855f7',
              fontSize: '1.5rem',
              fontWeight: '700',
              boxShadow: timeRemaining < 300 
                ? '0 0 20px rgba(239, 68, 68, 0.3)' 
                : '0 0 20px rgba(168, 85, 247, 0.2)',
              animation: timeRemaining < 60 ? 'pulse 1s infinite' : 'none',
            }}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Overview View - Kontext Style */}
        {currentView === 'overview' && (
          <div>
            {/* Assessment Info */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '24px',
              padding: '3rem',
              marginBottom: '3rem',
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

              <h3 style={{ 
                fontSize: '2rem', 
                fontWeight: '700',
                background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '1.5rem',
              }}>
                📋 About This Assessment
              </h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '2.5rem' }}>
                {assessment.description}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '2rem',
              }}>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(168, 85, 247, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Type</div>
                  <div style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700', textTransform: 'capitalize' }}>
                    {assessment.assessmentType}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Questions</div>
                  <div style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: '700' }}>
                    {assessment.questions.length}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Time Limit</div>
                  <div style={{ color: '#f59e0b', fontSize: '1.2rem', fontWeight: '700' }}>
                    {assessment.timeLimit ? `${assessment.timeLimit} min` : 'No limit'}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(139, 92, 246, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Attempts</div>
                  <div style={{ color: '#8b5cf6', fontSize: '1.2rem', fontWeight: '700' }}>
                    {attemptsUsed} / {assessment.attemptsAllowed}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(168, 85, 247, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Passing Score</div>
                  <div style={{ color: '#a855f7', fontSize: '1.2rem', fontWeight: '700' }}>
                    {assessment.passingScore}%
                  </div>
                </div>
                {submissions.length > 0 && (
                  <div style={{
                    padding: '1.5rem',
                    background: bestScore >= assessment.passingScore 
                      ? 'rgba(16, 185, 129, 0.08)' 
                      : 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '16px',
                    border: `1px solid ${bestScore >= assessment.passingScore ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Best Score</div>
                    <div style={{
                      color: bestScore >= assessment.passingScore ? '#10B981' : '#EF4444',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                    }}>
                      {bestScore}%
                    </div>
                  </div>
                )}
              </div>

              {canAttempt ? (
                <button
                  onClick={handleStartAssessment}
                  style={{
                    marginTop: '3rem',
                    padding: '1.25rem 4rem',
                    background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#ffffff',
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 36px rgba(168, 85, 247, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(168, 85, 247, 0.4)';
                  }}
                >
                  {submissions.length === 0 ? '🚀 Start Assessment' : '🔄 Retake Assessment'}
                </button>
              ) : (
                <div style={{
                  marginTop: '3rem',
                  padding: '1.25rem 3rem',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))',
                  border: '2px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '16px',
                  color: '#EF4444',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                }}>
                  ⚠️ No attempts remaining
                </div>
              )}
            </div>

            {/* Previous Submissions - Kontext Style */}
            {submissions.length > 0 && (
              <div>
                <h3 style={{ 
                  fontSize: '2rem', 
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '2rem',
                }}>
                  📊 Previous Attempts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {submissions.map((submission, index) => (
                    <div
                      key={submission.submissionId}
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                        border: `2px solid ${submission.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        borderRadius: '20px',
                        padding: '2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: submission.passed 
                          ? '0 8px 32px rgba(16, 185, 129, 0.1)'
                          : '0 8px 32px rgba(239, 68, 68, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Top gradient bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: submission.passed 
                          ? 'linear-gradient(90deg, #10b981, #059669)'
                          : 'linear-gradient(90deg, #ef4444, #dc2626)',
                      }}></div>

                      <div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.75rem' }}>
                          🎯 Attempt #{submission.attemptNumber}
                        </div>
                        <div style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                          📅 {new Date(Number(submission.submittedAt) / 1_000_000).toLocaleString()} • 
                          ⏱️ Time: {Math.floor(submission.timeSpent / 60)}:{(submission.timeSpent % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '3rem',
                          fontWeight: '700',
                          color: submission.passed ? '#10B981' : '#EF4444',
                          marginBottom: '0.5rem',
                          textShadow: `0 0 20px ${submission.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}>
                          {submission.score}%
                        </div>
                        <div style={{
                          padding: '0.75rem 1.5rem',
                          background: submission.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          border: `1px solid ${submission.passed ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                          borderRadius: '12px',
                          fontSize: '1rem',
                          fontWeight: '700',
                          color: submission.passed ? '#10B981' : '#EF4444',
                        }}>
                          {submission.passed ? '✓ Passed' : '✗ Failed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Taking Assessment View - Kontext Style */}
        {currentView === 'taking' && (
          <div>
            {/* Question Progress - Kontext Style */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '20px',
              padding: '1.5rem 2.5rem',
              marginBottom: '2.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)',
            }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem', fontWeight: '600' }}>
                Question {currentQuestionIndex + 1} of {assessment.questions.length}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {assessment.questions.map((_, index) => (
                  <div
                    key={index}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: index === currentQuestionIndex ? 'linear-gradient(135deg, #a855f7, #f59e0b)' : 
                                 answers.has(assessment.questions[index].questionId) ? 'rgba(16, 185, 129, 0.6)' : 
                                 'rgba(107, 114, 128, 0.3)',
                      boxShadow: index === currentQuestionIndex ? '0 0 12px rgba(168, 85, 247, 0.6)' : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Current Question - Kontext Style */}
            {(() => {
              const question = assessment.questions[currentQuestionIndex];
              const currentAnswer = answers.get(question.questionId) || '';

              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(16, 185, 129, 0.05))',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '24px',
                  padding: '4rem 3rem',
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

                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: '#a855f7',
                    }}>
                      {getQuestionTypeLabel(question.questionType)} • {question.points} points
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '3rem',
                    lineHeight: '1.6',
                  }}>
                    {question.questionText}
                  </h3>

                  {/* Multiple Choice / True-False - Kontext Style */}
                  {(question.questionType === 'multiple_choice' || question.questionType === 'true_false') && question.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {question.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswerChange(question.questionId, option)}
                          className="kontext-option-button"
                          style={{
                            padding: '2rem',
                            background: currentAnswer === option 
                              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))' 
                              : 'rgba(10, 10, 10, 0.5)',
                            border: `2px solid ${currentAnswer === option ? '#a855f7' : 'rgba(168, 85, 247, 0.2)'}`,
                            borderRadius: '16px',
                            color: '#ffffff',
                            fontSize: '1.1rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.5rem',
                            boxShadow: currentAnswer === option 
                              ? '0 8px 24px rgba(168, 85, 247, 0.3)' 
                              : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (currentAnswer !== option) {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                              e.currentTarget.style.transform = 'translateX(8px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentAnswer !== option) {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: currentAnswer === option 
                              ? 'linear-gradient(135deg, #a855f7, #f59e0b)' 
                              : 'rgba(168, 85, 247, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            flexShrink: 0,
                          }}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span>{option}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Short Answer - Kontext Style */}
                  {question.questionType === 'short_answer' && (
                    <input
                      type="text"
                      value={currentAnswer}
                      onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                      placeholder="Type your answer here..."
                      style={{
                        width: '100%',
                        padding: '1.5rem',
                        background: 'rgba(10, 10, 10, 0.5)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '16px',
                        color: '#ffffff',
                        fontSize: '1.1rem',
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
                  )}

                  {/* Essay - Kontext Style */}
                  {question.questionType === 'essay' && (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                      placeholder="Write your essay here..."
                      rows={10}
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
                        lineHeight: '1.8',
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
                  )}

                  {/* Code - Kontext Style */}
                  {question.questionType === 'code' && (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                      placeholder="// Write your code here..."
                      rows={15}
                      style={{
                        width: '100%',
                        padding: '1.5rem',
                        background: 'rgba(10, 10, 10, 0.8)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '16px',
                        color: '#ffffff',
                        fontSize: '1rem',
                        resize: 'vertical',
                        fontFamily: 'monospace',
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
                  )}

                  {/* Navigation Buttons - Kontext Style */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4rem',
                    gap: '1.5rem',
                  }}>
                    <button
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      style={{
                        padding: '1rem 3rem',
                        background: currentQuestionIndex === 0 ? 'rgba(107, 114, 128, 0.2)' : 'rgba(168, 85, 247, 0.1)',
                        border: `1px solid ${currentQuestionIndex === 0 ? 'rgba(107, 114, 128, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                        borderRadius: '12px',
                        color: currentQuestionIndex === 0 ? '#6B7280' : '#a855f7',
                        fontSize: '1.05rem',
                        fontWeight: '700',
                        cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (currentQuestionIndex !== 0) {
                          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentQuestionIndex !== 0) {
                          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                        }
                      }}
                    >
                      ← Previous
                    </button>

                    {currentQuestionIndex < assessment.questions.length - 1 ? (
                      <button
                        onClick={handleNextQuestion}
                        style={{
                          padding: '1rem 3rem',
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          borderRadius: '12px',
                          color: '#a855f7',
                          fontSize: '1.05rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(245, 158, 11, 0.25))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(245, 158, 11, 0.15))';
                        }}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitAssessment}
                        disabled={submitting}
                        style={{
                          padding: '1rem 3rem',
                          background: submitting ? '#6B7280' : 'linear-gradient(135deg, #a855f7, #f59e0b)',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '1.05rem',
                          fontWeight: '700',
                          cursor: submitting ? 'not-allowed' : 'pointer',
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
                        {submitting ? '⏳ Submitting...' : '✓ Submit Assessment'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Results View - Kontext Style */}
        {currentView === 'results' && lastSubmission && (
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              background: lastSubmission.passed 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.05))' 
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.05))',
              border: `3px solid ${lastSubmission.passed ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
              borderRadius: '32px',
              padding: '5rem 3rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: lastSubmission.passed 
                ? '0 20px 60px rgba(16, 185, 129, 0.2)' 
                : '0 20px 60px rgba(239, 68, 68, 0.2)',
            }}>
              {/* Top gradient bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: lastSubmission.passed 
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #ef4444, #dc2626)',
              }}></div>

              <div style={{ 
                fontSize: '6rem', 
                marginBottom: '2rem',
                filter: `drop-shadow(0 8px 16px ${lastSubmission.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'})`,
              }}>
                {lastSubmission.passed ? '🎉' : '😔'}
              </div>
              
              <h2 style={{
                fontSize: '3.5rem',
                fontWeight: '700',
                background: lastSubmission.passed 
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '2rem',
              }}>
                {lastSubmission.passed ? 'Congratulations!' : 'Keep Trying!'}
              </h2>

              <div style={{
                fontSize: '6rem',
                fontWeight: '700',
                color: lastSubmission.passed ? '#10B981' : '#EF4444',
                marginBottom: '2rem',
                textShadow: `0 0 40px ${lastSubmission.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              }}>
                {lastSubmission.score}%
              </div>

              <p style={{
                fontSize: '1.4rem',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '3rem',
                lineHeight: '1.8',
              }}>
                {lastSubmission.passed 
                  ? `You passed with a score of ${lastSubmission.score}%! Great job!`
                  : `You scored ${lastSubmission.score}%. The passing score is ${assessment.passingScore}%.`
                }
              </p>

              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setCurrentView('overview')}
                  style={{
                    padding: '1rem 3rem',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '12px',
                    color: '#a855f7',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                  }}
                >
                  View Details
                </button>
                
                {canAttempt && !lastSubmission.passed && (
                  <button
                    onClick={handleStartAssessment}
                    style={{
                      padding: '1rem 3rem',
                      background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      cursor: 'pointer',
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
                    🔄 Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};
