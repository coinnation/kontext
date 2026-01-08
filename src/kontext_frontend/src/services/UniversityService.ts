/**
 * Kontext University Service
 * Frontend service wrapper for all university backend functions
 * 
 * Provides typed interfaces for:
 * - Programs, Courses, Lessons (Phase 1)
 * - Assessments, Reviews, Discussions (Phase 2)
 * - Degrees, Achievements, Instructors (Phase 2)
 * - Learning Paths, Statistics (Phase 2)
 */

import { Actor, ActorSubclass, Identity, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { icpData } from '../icpData';
import type {
  AcademicProgram,
  Course,
  Lesson,
  ProgramEnrollment,
  CourseEnrollment,
  VideoProgress,
  Assessment,
  AssessmentSubmission,
  Answer,
  Question,
  CourseReview,
  Discussion,
  Reply,
  Degree,
  Achievement,
  UserAchievement,
  Instructor,
  LearningPath,
  UniversityStats,
  DifficultyLevel,
  DegreeType,
  AssessmentType,
  Rarity,
  AchievementCriteria,
  SocialLink,
  ResourceLink,
} from '../types';

/**
 * Kontext University Service Class
 * All methods are async and return typed results
 * 
 * 🔥 FIXED: Creates its own actor with proper IDL for platform canister
 */
export class UniversityService {
  private platformActor: ActorSubclass<_SERVICE>;
  private agent: HttpAgent;
  private identity: Identity;

  constructor(identity: Identity, agent: HttpAgent) {
    this.identity = identity;
    this.agent = agent;
    
    // Create platform canister actor with proper IDL
    const platformCanisterId = 'pkmhr-fqaaa-aaaaa-qcfeq-cai'; // Platform canister ID
    
    const canisterActor = Actor.createActor<_SERVICE>(idlFactory, {
      agent,
      canisterId: platformCanisterId,
    });
    
    // Wrap with auto-converting proxy for BigInt handling
    this.platformActor = new Proxy(canisterActor, {
      get(target, prop) {
        if (typeof target[prop] === 'function') {
          return async (...args: any[]) => {
            try {
              const result = await target[prop](...args);
              return icpData.fromCanister(result);
            } catch (error) {
              console.error(`❌ [UniversityService] Error in ${String(prop)}:`, error);
              throw error;
            }
          };
        }
        return target[prop];
      }
    });
    
    console.log('✅ [UniversityService] Platform actor created');
  }

  // 🔥 FIX: Helper to extract variant value from Motoko variant object
  private extractVariantValue(variant: any): string | null {
    if (!variant || typeof variant !== 'object') {
      return typeof variant === 'string' ? variant : null;
    }
    // Motoko variants come as { variantName: null }
    const keys = Object.keys(variant);
    if (keys.length > 0) {
      return keys[0]; // Return the variant name
    }
    return null;
  }

  // 🔥 FIX: Normalize program data - convert variants to strings
  private normalizeProgram(program: any): any {
    if (!program) return program;
    
    return {
      ...program,
      difficulty: this.extractVariantValue(program.difficulty) || program.difficulty || 'beginner',
      degreeType: this.extractVariantValue(program.degreeType) || program.degreeType || 'certificate',
    };
  }

  // 🔥 FIX: Normalize course data - convert variants to strings
  private normalizeCourse(course: any): any {
    if (!course) return course;
    
    return {
      ...course,
      difficulty: this.extractVariantValue(course.difficulty) || course.difficulty || 'beginner',
      accessTier: this.extractVariantValue(course.accessTier) || course.accessTier || 'free',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRAM MANAGEMENT (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new academic program (Admin only)
   */
  async createProgram(
    title: string,
    description: string,
    degreeType: DegreeType,
    durationWeeks: number,
    totalCredits: number,
    requiredCourses: string[],
    electiveCourses: string[],
    prerequisites: string[],
    subscriptionTier: string,
    imageUrl: string,
    difficulty: DifficultyLevel
  ): Promise<string> {
    try {
      const programId = await this.platformActor.createProgram(
        title,
        description,
        { [degreeType]: null },
        durationWeeks,
        totalCredits,
        requiredCourses,
        electiveCourses,
        prerequisites,
        subscriptionTier,
        imageUrl,
        { [difficulty]: null }
      );
      console.log('✅ [University] Program created:', programId);
      return programId;
    } catch (error) {
      console.error('❌ [University] Failed to create program:', error);
      throw error;
    }
  }

  /**
   * Get a specific program by ID
   */
  async getProgram(programId: string): Promise<AcademicProgram | null> {
    try {
      const result = await this.platformActor.getAcademicProgram(programId);
      const program = result[0] || null;
      // 🔥 FIX: Normalize variant types to strings
      return program ? this.normalizeProgram(program) : null;
    } catch (error) {
      console.error('❌ [University] Failed to get program:', error);
      return null;
    }
  }

  /**
   * Get all programs (including unpublished for admin)
   */
  async getAllPrograms(): Promise<AcademicProgram[]> {
    try {
      // 🔥 FIX: Try getAllPrograms first (if admin method exists), fallback to getPublishedPrograms
      let programs: AcademicProgram[] = [];
      
      if (typeof this.platformActor.getAllPrograms === 'function') {
        const result = await this.platformActor.getAllPrograms();
        // Handle Result type: { ok: [...] } or { err: "..." }
        if (result && typeof result === 'object') {
          if ('ok' in result && Array.isArray(result.ok)) {
            programs = result.ok;
            console.log(`✅ [University] Fetched ${programs.length} programs (all, including unpublished)`);
          } else if ('err' in result) {
            console.warn(`⚠️ [University] getAllPrograms returned error: ${result.err}, falling back to published programs`);
            // Fall through to getPublishedPrograms
          } else {
            // If it's not a Result type, treat it as a direct array
            programs = Array.isArray(result) ? result : [];
            console.log(`✅ [University] Fetched ${programs.length} programs (direct array)`);
          }
        }
      }
      
      // If we didn't get programs from getAllPrograms, try getPublishedPrograms
      if (programs.length === 0 && typeof this.platformActor.getPublishedPrograms === 'function') {
        programs = await this.platformActor.getPublishedPrograms();
        console.log(`✅ [University] Fetched ${programs.length} published programs`);
      } else if (programs.length === 0) {
        console.error('❌ [University] No method found to get programs');
        return [];
      }
      
      // 🔥 FIX: Normalize variant types to strings
      return programs.map(p => this.normalizeProgram(p));
    } catch (error) {
      console.error('❌ [University] Failed to get programs:', error);
      // Try fallback to published programs
      try {
        if (typeof this.platformActor.getPublishedPrograms === 'function') {
          const published = await this.platformActor.getPublishedPrograms();
          console.log(`⚠️ [University] Fallback: Fetched ${published.length} published programs`);
          // 🔥 FIX: Normalize variant types to strings
          return published.map(p => this.normalizeProgram(p));
        }
      } catch (fallbackError) {
        console.error('❌ [University] Fallback also failed:', fallbackError);
      }
      return [];
    }
  }

  /**
   * Get published programs (paginated)
   */
  async getPublishedProgramsPaginated(limit: number, offset: number): Promise<{ programs: AcademicProgram[]; total: number }> {
    try {
      const [programs, total] = await this.platformActor.getPublishedProgramsPaginated(BigInt(limit), BigInt(offset));
      const normalized = programs.map((p: any) => this.normalizeProgram(p));
      console.log(`✅ [University] Fetched ${normalized.length} programs (page, ${Number(total)} total)`);
      return { programs: normalized, total: Number(total) };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated programs:', error);
      return { programs: [], total: 0 };
    }
  }

  /**
   * Get all programs (paginated, admin only)
   */
  async getAllProgramsPaginated(limit: number, offset: number): Promise<{ programs: AcademicProgram[]; total: number }> {
    try {
      const result = await this.platformActor.getAllProgramsPaginated(BigInt(limit), BigInt(offset));
      if (result && typeof result === 'object' && 'ok' in result && Array.isArray(result.ok)) {
        const [programs, total] = result.ok as [any[], bigint];
        const normalized = programs.map((p: any) => this.normalizeProgram(p));
        console.log(`✅ [University] Fetched ${normalized.length} programs (admin page, ${Number(total)} total)`);
        return { programs: normalized, total: Number(total) };
      }
      return { programs: [], total: 0 };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated programs (admin):', error);
      return { programs: [], total: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE MANAGEMENT (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new course (Admin only)
   */
  async createCourse(
    title: string,
    description: string,
    instructor: string,
    programIds: string[],
    durationWeeks: number,
    credits: number,
    subscriptionTier: string,
    thumbnailUrl: string,
    introVideoUrl: string | null,
    difficulty: DifficultyLevel,
    tags: string[],
    prerequisites: string[]
  ): Promise<string> {
    try {
      const instructorPrincipal = Principal.fromText(instructor);
      const courseId = await this.platformActor.createCourse(
        title,
        description,
        instructorPrincipal,
        programIds,
        durationWeeks,
        credits,
        subscriptionTier,
        thumbnailUrl,
        introVideoUrl ? [introVideoUrl] : [],
        { [difficulty]: null },
        tags,
        prerequisites
      );
      console.log('✅ [University] Course created:', courseId);
      return courseId;
    } catch (error) {
      console.error('❌ [University] Failed to create course:', error);
      throw error;
    }
  }

  /**
   * Get a specific course by ID
   */
  async getCourse(courseId: string): Promise<Course | null> {
    try {
      const result = await this.platformActor.getCourse(courseId);
      const course = result[0] || null;
      // 🔥 FIX: Normalize variant types to strings
      return course ? this.normalizeCourse(course) : null;
    } catch (error) {
      console.error('❌ [University] Failed to get course:', error);
      return null;
    }
  }

  /**
   * Get all courses (including unpublished for admin)
   */
  async getAllCourses(): Promise<Course[]> {
    try {
      // 🔥 FIX: Try getAllCourses first (if admin method exists), fallback to getPublishedCourses
      let courses: Course[] = [];
      
      if (typeof this.platformActor.getAllCourses === 'function') {
        const result = await this.platformActor.getAllCourses();
        // Handle Result type: { ok: [...] } or { err: "..." }
        if (result && typeof result === 'object') {
          if ('ok' in result && Array.isArray(result.ok)) {
            courses = result.ok;
            console.log(`✅ [University] Fetched ${courses.length} courses (all, including unpublished)`);
          } else if ('err' in result) {
            console.warn(`⚠️ [University] getAllCourses returned error: ${result.err}, falling back to published courses`);
            // Fall through to getPublishedCourses
          } else {
            // If it's not a Result type, treat it as a direct array
            courses = Array.isArray(result) ? result : [];
            console.log(`✅ [University] Fetched ${courses.length} courses (direct array)`);
          }
        }
      }
      
      // If we didn't get courses from getAllCourses, try getPublishedCourses
      if (courses.length === 0 && typeof this.platformActor.getPublishedCourses === 'function') {
        courses = await this.platformActor.getPublishedCourses();
        console.log(`✅ [University] Fetched ${courses.length} published courses`);
      } else if (courses.length === 0) {
        console.error('❌ [University] No method found to get courses');
        return [];
      }
      
      // 🔥 FIX: Normalize variant types to strings
      return courses.map(c => this.normalizeCourse(c));
    } catch (error) {
      console.error('❌ [University] Failed to get courses:', error);
      // Try fallback to published courses
      try {
        if (typeof this.platformActor.getPublishedCourses === 'function') {
          const published = await this.platformActor.getPublishedCourses();
          console.log(`⚠️ [University] Fallback: Fetched ${published.length} published courses`);
          // 🔥 FIX: Normalize variant types to strings
          return published.map(c => this.normalizeCourse(c));
        }
      } catch (fallbackError) {
        console.error('❌ [University] Fallback also failed:', fallbackError);
      }
      return [];
    }
  }

  /**
   * Get courses for a specific program
   * Note: Fetches courses by IDs from the program's courseIds array
   */
  async getCoursesByProgram(programId: string): Promise<Course[]> {
    try {
      // First get the program to get its course IDs
      const programResult = await this.platformActor.getAcademicProgram(programId);
      const program = programResult[0];
      
      if (!program) {
        console.warn('⚠️ [University] Program not found:', programId);
        return [];
      }

      // Collect all course IDs from the program
      const courseIds = program.courseIds || [];
      const requiredIds = program.requiredCourses || [];
      const electiveIds = program.electiveCourses || [];
      const allCourseIds = [...new Set([...courseIds, ...requiredIds, ...electiveIds])];

      if (allCourseIds.length === 0) {
        console.log('ℹ️ [University] No courses associated with program:', programId);
        return [];
      }

      // Fetch all courses in parallel
      const coursesData = await Promise.all(
        allCourseIds.map(async (id) => {
          const result = await this.platformActor.getCourse(id);
          return result[0] || null;
        })
      );

      // Filter out nulls and normalize
      const validCourses = coursesData
        .filter((c): c is Course => c !== null)
        .map(c => this.normalizeCourse(c));

      console.log(`✅ [University] Fetched ${validCourses.length} courses for program ${programId}`);
      return validCourses;
    } catch (error) {
      console.error('❌ [University] Failed to get courses by program:', error);
      return [];
    }
  }

  /**
   * Get published courses (paginated)
   */
  async getPublishedCoursesPaginated(limit: number, offset: number): Promise<{ courses: Course[]; total: number }> {
    try {
      const [courses, total] = await this.platformActor.getPublishedCoursesPaginated(BigInt(limit), BigInt(offset));
      const normalized = courses.map((c: any) => this.normalizeCourse(c));
      console.log(`✅ [University] Fetched ${normalized.length} courses (page, ${Number(total)} total)`);
      return { courses: normalized, total: Number(total) };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated courses:', error);
      return { courses: [], total: 0 };
    }
  }

  /**
   * Get all courses (paginated, admin only)
   */
  async getAllCoursesPaginated(limit: number, offset: number): Promise<{ courses: Course[]; total: number }> {
    try {
      const result = await this.platformActor.getAllCoursesPaginated(BigInt(limit), BigInt(offset));
      if (result && typeof result === 'object' && 'ok' in result && Array.isArray(result.ok)) {
        const [courses, total] = result.ok as [any[], bigint];
        const normalized = courses.map((c: any) => this.normalizeCourse(c));
        console.log(`✅ [University] Fetched ${normalized.length} courses (admin page, ${Number(total)} total)`);
        return { courses: normalized, total: Number(total) };
      }
      return { courses: [], total: 0 };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated courses (admin):', error);
      return { courses: [], total: 0 };
    }
  }

  /**
   * Get courses by tier (paginated)
   */
  async getCoursesByTierPaginated(tier: string, limit: number, offset: number): Promise<{ courses: Course[]; total: number }> {
    try {
      const tierVariant = { [tier]: null };
      const [courses, total] = await this.platformActor.getCoursesByTierPaginated(tierVariant, BigInt(limit), BigInt(offset));
      const normalized = courses.map((c: any) => this.normalizeCourse(c));
      console.log(`✅ [University] Fetched ${normalized.length} courses for tier ${tier} (page, ${Number(total)} total)`);
      return { courses: normalized, total: Number(total) };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated courses by tier:', error);
      return { courses: [], total: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LESSON MANAGEMENT (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new lesson (Admin only)
   */
  async createLesson(
    courseId: string,
    title: string,
    description: string,
    videoUrl: string,
    videoDuration: number,
    orderIndex: number,
    isFree: boolean,
    transcriptUrl: string | null,
    resourceUrls: ResourceLink[]
  ): Promise<string> {
    try {
      const lessonId = await this.platformActor.createLesson(
        courseId,
        title,
        description,
        videoUrl,
        videoDuration,
        orderIndex,
        isFree,
        transcriptUrl ? [transcriptUrl] : [],
        resourceUrls
      );
      console.log('✅ [University] Lesson created:', lessonId);
      return lessonId;
    } catch (error) {
      console.error('❌ [University] Failed to create lesson:', error);
      throw error;
    }
  }

  /**
   * Get a specific lesson by ID
   */
  async getLesson(lessonId: string): Promise<Lesson | null> {
    try {
      const result = await this.platformActor.getLesson(lessonId);
      return result[0] || null;
    } catch (error) {
      console.error('❌ [University] Failed to get lesson:', error);
      return null;
    }
  }

  /**
   * Get all lessons for a course
   */
  async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
    try {
      const lessons = await this.platformActor.getLessonsByCourse(courseId);
      return lessons;
    } catch (error) {
      console.error('❌ [University] Failed to get lessons:', error);
      return [];
    }
  }

  /**
   * Get lessons by course (paginated)
   */
  async getLessonsByCoursePaginated(courseId: string, limit: number, offset: number): Promise<{ lessons: Lesson[]; total: number }> {
    try {
      const [lessons, total] = await this.platformActor.getLessonsByCoursePaginated(courseId, BigInt(limit), BigInt(offset));
      console.log(`✅ [University] Fetched ${lessons.length} lessons for course ${courseId} (page, ${Number(total)} total)`);
      return { lessons, total: Number(total) };
    } catch (error) {
      console.error('❌ [University] Failed to get paginated lessons:', error);
      return { lessons: [], total: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENROLLMENT (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enroll in a program
   */
  async enrollInProgram(programId: string): Promise<string> {
    try {
      const enrollmentId = await this.platformActor.enrollInProgram(programId);
      console.log('✅ [University] Enrolled in program:', programId);
      return enrollmentId;
    } catch (error) {
      console.error('❌ [University] Failed to enroll in program:', error);
      throw error;
    }
  }

  /**
   * Enroll in a course
   */
  async enrollInCourse(courseId: string): Promise<string> {
    try {
      const enrollmentId = await this.platformActor.enrollInCourse(courseId);
      console.log('✅ [University] Enrolled in course:', courseId);
      return enrollmentId;
    } catch (error) {
      console.error('❌ [University] Failed to enroll in course:', error);
      throw error;
    }
  }

  /**
   * Get student enrollments
   */
  async getStudentEnrollments(student: string): Promise<{
    programs: ProgramEnrollment[];
    courses: CourseEnrollment[];
  }> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const result = await this.platformActor.getStudentEnrollments(studentPrincipal);
      return result;
    } catch (error) {
      console.error('❌ [University] Failed to get enrollments:', error);
      return { programs: [], courses: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIDEO PROGRESS (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update video progress
   */
  async updateVideoProgress(
    lessonId: string,
    watchedDuration: number,
    totalDuration: number,
    completed: boolean,
    lastPosition: number
  ): Promise<boolean> {
    try {
      const success = await this.platformActor.updateVideoProgress(
        lessonId,
        watchedDuration,
        totalDuration,
        completed,
        lastPosition
      );
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to update video progress:', error);
      return false;
    }
  }

  /**
   * Get video progress for a lesson
   */
  async getVideoProgress(lessonId: string, student: string): Promise<VideoProgress | null> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const result = await this.platformActor.getVideoProgress(lessonId, studentPrincipal);
      return result[0] || null;
    } catch (error) {
      console.error('❌ [University] Failed to get video progress:', error);
      return null;
    }
  }

  /**
   * Get overall course progress percentage
   */
  async getCourseProgress(courseId: string, student: string): Promise<number> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const progress = await this.platformActor.getCourseProgress(courseId, studentPrincipal);
      return progress;
    } catch (error) {
      console.error('❌ [University] Failed to get course progress:', error);
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSESSMENTS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create an assessment (Admin only)
   */
  async createAssessment(
    courseId: string,
    lessonId: string | null,
    title: string,
    description: string,
    assessmentType: AssessmentType,
    questions: Question[],
    passingScore: number,
    timeLimit: number | null,
    attemptsAllowed: number,
    isRequired: boolean,
    orderIndex: number
  ): Promise<string> {
    try {
      const assessmentId = await this.platformActor.createAssessment(
        courseId,
        lessonId ? [lessonId] : [],
        title,
        description,
        { [assessmentType]: null },
        questions,
        passingScore,
        timeLimit !== null ? [timeLimit] : [],
        attemptsAllowed,
        isRequired,
        orderIndex
      );
      console.log('✅ [University] Assessment created:', assessmentId);
      return assessmentId;
    } catch (error) {
      console.error('❌ [University] Failed to create assessment:', error);
      throw error;
    }
  }

  /**
   * Submit an assessment
   */
  async submitAssessment(
    assessmentId: string,
    answers: Answer[],
    timeSpent: number
  ): Promise<string> {
    try {
      const submissionId = await this.platformActor.submitAssessment(
        assessmentId,
        answers,
        timeSpent
      );
      console.log('✅ [University] Assessment submitted:', submissionId);
      return submissionId;
    } catch (error) {
      console.error('❌ [University] Failed to submit assessment:', error);
      throw error;
    }
  }

  /**
   * Get student submissions for an assessment
   */
  async getStudentSubmissions(
    student: string,
    assessmentId: string
  ): Promise<AssessmentSubmission[]> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const submissions = await this.platformActor.getStudentSubmissions(
        studentPrincipal,
        assessmentId
      );
      return submissions;
    } catch (error) {
      console.error('❌ [University] Failed to get submissions:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEWS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a review
   */
  async submitReview(
    courseId: string | null,
    lessonId: string | null,
    programId: string | null,
    rating: number,
    title: string,
    comment: string,
    pros: string[],
    cons: string[],
    difficulty: DifficultyLevel | null,
    wouldRecommend: boolean,
    isVerifiedCompletion: boolean
  ): Promise<string> {
    try {
      const reviewId = await this.platformActor.submitReview(
        courseId ? [courseId] : [],
        lessonId ? [lessonId] : [],
        programId ? [programId] : [],
        rating,
        title,
        comment,
        pros,
        cons,
        difficulty ? [{ [difficulty]: null }] : [],
        wouldRecommend,
        isVerifiedCompletion
      );
      console.log('✅ [University] Review submitted:', reviewId);
      return reviewId;
    } catch (error) {
      console.error('❌ [University] Failed to submit review:', error);
      throw error;
    }
  }

  /**
   * Get reviews
   */
  async getReviews(
    courseId?: string,
    lessonId?: string,
    programId?: string
  ): Promise<CourseReview[]> {
    try {
      const reviews = await this.platformActor.getReviews(
        courseId ? [courseId] : [],
        lessonId ? [lessonId] : [],
        programId ? [programId] : []
      );
      return reviews;
    } catch (error) {
      console.error('❌ [University] Failed to get reviews:', error);
      return [];
    }
  }

  /**
   * Vote a review as helpful
   */
  async voteReviewHelpful(reviewId: string): Promise<boolean> {
    try {
      const success = await this.platformActor.voteReviewHelpful(reviewId);
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to vote review:', error);
      return false;
    }
  }

  /**
   * Respond to a review (Instructor only)
   */
  async respondToReview(reviewId: string, responseText: string): Promise<boolean> {
    try {
      const success = await this.platformActor.respondToReview(reviewId, responseText);
      console.log('✅ [University] Responded to review:', reviewId);
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to respond to review:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCUSSIONS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a discussion
   */
  async createDiscussion(
    courseId: string | null,
    lessonId: string | null,
    programId: string | null,
    authorName: string,
    title: string,
    content: string,
    tags: string[]
  ): Promise<string> {
    try {
      const discussionId = await this.platformActor.createDiscussion(
        courseId ? [courseId] : [],
        lessonId ? [lessonId] : [],
        programId ? [programId] : [],
        authorName,
        title,
        content,
        tags
      );
      console.log('✅ [University] Discussion created:', discussionId);
      return discussionId;
    } catch (error) {
      console.error('❌ [University] Failed to create discussion:', error);
      throw error;
    }
  }

  /**
   * Reply to a discussion
   */
  async replyToDiscussion(
    discussionId: string,
    authorName: string,
    content: string,
    isInstructorReply: boolean
  ): Promise<boolean> {
    try {
      const success = await this.platformActor.replyToDiscussion(
        discussionId,
        authorName,
        content,
        isInstructorReply
      );
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to reply to discussion:', error);
      return false;
    }
  }

  /**
   * Mark discussion as solved
   */
  async markDiscussionSolved(discussionId: string): Promise<boolean> {
    try {
      const success = await this.platformActor.markDiscussionSolved(discussionId);
      console.log('✅ [University] Discussion marked as solved:', discussionId);
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to mark discussion solved:', error);
      return false;
    }
  }

  /**
   * Get discussions
   */
  async getDiscussions(
    courseId?: string,
    lessonId?: string,
    programId?: string
  ): Promise<Discussion[]> {
    try {
      const discussions = await this.platformActor.getDiscussions(
        courseId ? [courseId] : [],
        lessonId ? [lessonId] : [],
        programId ? [programId] : []
      );
      return discussions;
    } catch (error) {
      console.error('❌ [University] Failed to get discussions:', error);
      return [];
    }
  }

  /**
   * Get replies for a discussion
   */
  async getReplies(discussionId: string): Promise<Reply[]> {
    try {
      const replies = await this.platformActor.getReplies(discussionId);
      return replies;
    } catch (error) {
      console.error('❌ [University] Failed to get replies:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEGREES (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check degree eligibility
   */
  async checkDegreeEligibility(programId: string, student: string): Promise<boolean> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const eligible = await this.platformActor.checkDegreeEligibility(programId, studentPrincipal);
      return eligible;
    } catch (error) {
      console.error('❌ [University] Failed to check degree eligibility:', error);
      return false;
    }
  }

  /**
   * Verify a degree by verification code
   */
  async verifyDegree(verificationCode: string): Promise<Degree | null> {
    try {
      const result = await this.platformActor.verifyDegree(verificationCode);
      return result[0] || null;
    } catch (error) {
      console.error('❌ [University] Failed to verify degree:', error);
      return null;
    }
  }

  /**
   * Get student degrees
   */
  async getStudentDegrees(student: string): Promise<Degree[]> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const degrees = await this.platformActor.getStudentDegrees(studentPrincipal);
      return degrees;
    } catch (error) {
      console.error('❌ [University] Failed to get student degrees:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACHIEVEMENTS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user achievements
   */
  async getUserAchievements(student: string): Promise<UserAchievement[]> {
    try {
      const studentPrincipal = Principal.fromText(student);
      const achievements = await this.platformActor.getUserAchievements(studentPrincipal);
      return achievements;
    } catch (error) {
      console.error('❌ [University] Failed to get user achievements:', error);
      return [];
    }
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const achievements = await this.platformActor.getAllAchievements();
      return achievements;
    } catch (error) {
      console.error('❌ [University] Failed to get achievements:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTRUCTORS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create instructor profile
   */
  async createInstructorProfile(
    name: string,
    bio: string,
    title: string,
    avatarUrl: string,
    expertise: string[],
    socialLinks: SocialLink[]
  ): Promise<boolean> {
    try {
      const success = await this.platformActor.createInstructorProfile(
        name,
        bio,
        title,
        avatarUrl,
        expertise,
        socialLinks
      );
      console.log('✅ [University] Instructor profile created');
      return success;
    } catch (error) {
      console.error('❌ [University] Failed to create instructor profile:', error);
      return false;
    }
  }

  /**
   * Get instructor profile
   */
  async getInstructor(instructorId: string): Promise<Instructor | null> {
    try {
      const instructorPrincipal = Principal.fromText(instructorId);
      const result = await this.platformActor.getInstructor(instructorPrincipal);
      return result[0] || null;
    } catch (error) {
      console.error('❌ [University] Failed to get instructor:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING PATHS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all learning paths
   */
  async getLearningPaths(): Promise<LearningPath[]> {
    try {
      // 🔥 FIX: Check if method exists before calling
      if (typeof this.platformActor.getLearningPaths === 'function') {
      const paths = await this.platformActor.getLearningPaths();
        console.log(`✅ [University] Fetched ${paths.length} learning paths`);
      return paths;
      } else {
        console.warn('⚠️ [University] getLearningPaths method not available, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('❌ [University] Failed to get learning paths:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get university statistics
   */
  async getUniversityStats(): Promise<UniversityStats> {
    try {
      // 🔥 FIX: Check if method exists before calling
      if (typeof this.platformActor.getUniversityStats === 'function') {
      const stats = await this.platformActor.getUniversityStats();
      console.log('✅ [University] Stats:', stats);
      return stats;
      } else {
        console.warn('⚠️ [University] getUniversityStats method not available, returning default stats');
        return {
          totalPrograms: 0,
          totalCourses: 0,
          totalLessons: 0,
          totalStudents: 0,
          totalInstructors: 0,
          totalDegreesIssued: 0,
          totalWatchHours: 0,
          averageCourseRating: 0,
          courseCompletionRate: 0,
        };
      }
    } catch (error) {
      console.error('❌ [University] Failed to get stats:', error);
      return {
        totalPrograms: 0,
        totalCourses: 0,
        totalLessons: 0,
        totalStudents: 0,
        totalInstructors: 0,
        totalDegreesIssued: 0,
        totalWatchHours: 0,
        averageCourseRating: 0,
        courseCompletionRate: 0,
      };
    }
  }
}

/**
 * Export singleton instance factory
 */
export const createUniversityService = (identity: Identity, agent: any): UniversityService => {
  return new UniversityService(identity, agent);
};


