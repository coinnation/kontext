/**
 * Kontext University App Container
 * Main container managing navigation between all university views
 */

import React, { useState } from 'react';
import { UniversityHomepage } from './UniversityHomepage';
import { ProgramDetail } from './ProgramDetail';
import { CourseDetail } from './CourseDetail';
import { LearningPathDetail } from './LearningPathDetail';
import { VideoPlayer } from './VideoPlayer';
import { MyLearningDashboard } from './MyLearningDashboard';

interface UniversityAppProps {
  onClose?: () => void;
}

type ViewType = 
  | { type: 'homepage' }
  | { type: 'program'; programId: string }
  | { type: 'course'; courseId: string }
  | { type: 'path'; pathId: string }
  | { type: 'lesson'; lessonId: string }
  | { type: 'dashboard' };

export const UniversityApp: React.FC<UniversityAppProps> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<ViewType>({ type: 'homepage' });
  const [viewHistory, setViewHistory] = useState<ViewType[]>([{ type: 'homepage' }]);

  const navigateTo = (view: ViewType) => {
    setViewHistory(prev => [...prev, view]);
    setCurrentView(view);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = viewHistory.slice(0, -1);
      setViewHistory(newHistory);
      setCurrentView(newHistory[newHistory.length - 1]);
    } else {
      // If at root, close the university app
      if (onClose) {
        onClose();
      }
    }
  };

  const handleProgramClick = (programId: string) => {
    navigateTo({ type: 'program', programId });
  };

  const handleCourseClick = (courseId: string) => {
    navigateTo({ type: 'course', courseId });
  };

  const handlePathClick = (pathId: string) => {
    navigateTo({ type: 'path', pathId });
  };

  const handleLessonClick = (lessonId: string) => {
    navigateTo({ type: 'lesson', lessonId });
  };

  const handleDashboardClick = () => {
    navigateTo({ type: 'dashboard' });
  };

  // Render current view
  switch (currentView.type) {
    case 'homepage':
      return (
        <UniversityHomepage 
          onClose={onClose}
          onProgramClick={handleProgramClick}
          onCourseClick={handleCourseClick}
          onPathClick={handlePathClick}
        />
      );

    case 'program':
      return (
        <ProgramDetail
          programId={currentView.programId}
          onBack={goBack}
          onCourseClick={handleCourseClick}
        />
      );

    case 'course':
      return (
        <CourseDetail
          courseId={currentView.courseId}
          onBack={goBack}
          onLessonClick={handleLessonClick}
        />
      );

    case 'path':
      return (
        <LearningPathDetail
          pathId={currentView.pathId}
          onBack={goBack}
          onProgramClick={handleProgramClick}
          onCourseClick={handleCourseClick}
        />
      );

    case 'lesson':
      return (
        <VideoPlayer
          lessonId={currentView.lessonId}
          onBack={goBack}
        />
      );

    case 'dashboard':
      return (
        <MyLearningDashboard
          onCourseClick={handleCourseClick}
          onProgramClick={handleProgramClick}
          onBack={goBack}
        />
      );

    default:
      return (
        <UniversityHomepage 
          onClose={onClose}
          onProgramClick={handleProgramClick}
          onCourseClick={handleCourseClick}
          onPathClick={handlePathClick}
        />
      );
  }
};

// Export everything for external use
export { UniversityHomepage } from './UniversityHomepage';
export { ProgramDetail } from './ProgramDetail';
export { CourseDetail } from './CourseDetail';
export { LearningPathDetail } from './LearningPathDetail';
export { VideoPlayer } from './VideoPlayer';
export { MyLearningDashboard } from './MyLearningDashboard';


