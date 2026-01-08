/**
 * Video Player Component - Kontext Style
 * YouTube player with progress tracking and stunning UI
 */

import React, { useState, useEffect, useRef } from 'react';
import { createUniversityService } from '../../services/UniversityService';
import { useAppStore } from '../../store/appStore';
import type { Lesson, VideoProgress } from '../../types';

interface VideoPlayerProps {
  lessonId: string;
  onBack: () => void;
  onNext?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ lessonId, onBack, onNext }) => {
  const { identity, agent, principalId } = useAppStore();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadLessonData();
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [lessonId]);

  useEffect(() => {
    // Auto-save progress every 10 seconds while playing
    if (isPlaying && lesson) {
      saveIntervalRef.current = setInterval(() => {
        saveProgress(false);
      }, 10000);
    } else {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [isPlaying, currentTime, lesson]);

  const loadLessonData = async () => {
    if (!identity || !agent) return;

    try {
      const universityService = createUniversityService(identity, agent);
      const lessonData = await universityService.getLesson(lessonId);
      setLesson(lessonData);

      if (principalId) {
        const progressData = await universityService.getVideoProgress(lessonId, principalId);
        setProgress(progressData);
        if (progressData) {
          setCurrentTime(progressData.lastPosition);
        }
      }
    } catch (error) {
      console.error('Failed to load lesson:', error);
    }
  };

  const saveProgress = async (completed: boolean = false) => {
    if (!identity || !agent || !lesson) return;

    try {
      const universityService = createUniversityService(identity, agent);
      await universityService.updateVideoProgress(
        lessonId,
        Math.floor(currentTime),
        lesson.videoDuration,
        completed || currentTime >= lesson.videoDuration * 0.95,
        Math.floor(currentTime)
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const handleVideoEnd = () => {
    saveProgress(true);
    setIsPlaying(false);
  };

  const getYouTubeEmbedUrl = (url: string): string => {
    // Extract video ID from YouTube URL
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(currentTime)}`;
    }
    return url;
  };

  if (!lesson) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#000000',
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
            Loading lesson...
          </p>
        </div>
      </div>
    );
  }

  const progressPercent = progress ? progress.percentComplete : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#000000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header - Kontext Style */}
      <div style={{
        background: 'rgba(10, 10, 10, 0.98)',
        backdropFilter: 'blur(20px)',
        borderBottom: '2px solid rgba(168, 85, 247, 0.3)',
        padding: '1.25rem 2rem',
        boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, minWidth: 0 }}>
            <button
              onClick={onBack}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 107, 53, 0.15)',
                border: '1px solid rgba(255, 107, 53, 0.4)',
                borderRadius: '12px',
                color: '#ff6b35',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.25)';
                e.currentTarget.style.borderColor = '#ff6b35';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 53, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.4)';
              }}
            >
              ← Back
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700',
                background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {lesson.title}
              </h2>
              <div style={{ 
                fontSize: '0.95rem', 
                color: 'rgba(255, 255, 255, 0.6)', 
                marginTop: '0.5rem',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
              }}>
                <span>⏱️ {Math.floor(lesson.videoDuration / 60)} min</span>
                <span>•</span>
                <div style={{
                  padding: '0.4rem 1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: '#10b981',
                }}>
                  {progressPercent.toFixed(0)}% Complete
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
            {lesson.resourceUrls.length > 0 && (
              <button
                onClick={() => setShowResources(!showResources)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: showResources ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${showResources ? 'rgba(245, 158, 11, 0.5)' : 'rgba(245, 158, 11, 0.3)'}`,
                  borderRadius: '12px',
                  color: '#f59e0b',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                }}
                onMouseLeave={(e) => {
                  if (!showResources) {
                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                  }
                }}
              >
                📎 Resources
              </button>
            )}
            {lesson.transcriptUrl && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: showTranscript ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${showTranscript ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.3)'}`,
                  borderRadius: '12px',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  if (!showTranscript) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                📝 Transcript
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 107, 53, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 53, 0.4)';
                }}
              >
                Next Lesson →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        position: 'relative',
      }}>
        <iframe
          src={getYouTubeEmbedUrl(lesson.videoUrl)}
          title={lesson.title}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsPlaying(true)}
        />

        {/* Transcript Overlay - Kontext Style */}
        {showTranscript && lesson.transcriptUrl && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '50%',
            background: 'linear-gradient(180deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            borderTop: '2px solid rgba(255, 107, 53, 0.3)',
            overflowY: 'auto',
            padding: '2.5rem',
            boxShadow: '0 -8px 40px rgba(255, 107, 53, 0.2)',
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
            }}>
              <h3 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700',
                background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <span>📝</span>
                <span>Transcript</span>
              </h3>
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                lineHeight: '2', 
                fontSize: '1.05rem',
                padding: '1.5rem',
                background: 'rgba(255, 107, 53, 0.05)',
                border: '1px solid rgba(255, 107, 53, 0.15)',
                borderRadius: '16px',
              }}>
                {/* Transcript content would be loaded here */}
                <p>Transcript available at: <a href={lesson.transcriptUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ff6b35', textDecoration: 'underline' }}>{lesson.transcriptUrl}</a></p>
              </div>
            </div>
          </div>
        )}

        {/* Resources Overlay - Kontext Style */}
        {showResources && lesson.resourceUrls.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '400px',
            height: '100%',
            background: 'linear-gradient(270deg, rgba(10, 10, 10, 0.98) 0%, rgba(10, 10, 10, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderLeft: '2px solid rgba(245, 158, 11, 0.3)',
            overflowY: 'auto',
            padding: '2.5rem',
            boxShadow: '-8px 0 40px rgba(245, 158, 11, 0.2)',
          }}>
            <h3 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              background: 'linear-gradient(135deg, #f59e0b, #ff6b35)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span>📎</span>
              <span>Resources</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lesson.resourceUrls.map((resource, index) => (
                <a
                  key={index}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(255, 107, 53, 0.05))',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '16px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(255, 107, 53, 0.1))';
                    e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                    e.currentTarget.style.transform = 'translateX(-4px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(255, 107, 53, 0.05))';
                    e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.1)';
                  }}
                >
                  <div style={{ 
                    fontSize: '2rem', 
                    flexShrink: 0,
                    filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3))',
                  }}>
                    {resource.resourceType === 'pdf' && '📄'}
                    {resource.resourceType === 'code' && '💻'}
                    {resource.resourceType === 'link' && '🔗'}
                    {resource.resourceType === 'video' && '🎥'}
                    {resource.resourceType === 'article' && '📰'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: '700', 
                      marginBottom: '0.5rem',
                      color: '#f59e0b',
                    }}>
                      {resource.title}
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: 'rgba(255, 255, 255, 0.5)',
                      textTransform: 'capitalize',
                    }}>
                      {resource.resourceType}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar - Kontext Style */}
      <div style={{
        height: '6px',
        background: 'rgba(255, 107, 53, 0.15)',
        position: 'relative',
        boxShadow: '0 -2px 10px rgba(255, 107, 53, 0.1)',
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: 'linear-gradient(90deg, #ff6b35, #f59e0b, #10b981)',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 20px rgba(255, 107, 53, 0.6)',
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

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
