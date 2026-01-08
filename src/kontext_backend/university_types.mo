// Kontext University types for educational content platform
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";

module UniversityTypes {
    // ═══════════════════════════════════════════════════════════════════════════
    // ACADEMIC PROGRAM STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════

    // Academic Program (e.g., "Full Stack Development Degree")
    public type AcademicProgram = {
        programId: Text;                   // Unique program ID
        title: Text;                       // "Full Stack Development Degree"
        description: Text;
        shortDescription: Text;            // For cards/previews
        thumbnailUrl: Text;                // Program image
        instructor: Principal;             // Program creator/owner
        instructorName: Text;
        courseIds: [Text];                 // Courses in this program (ordered)
        requiredCourses: [Text];           // Must complete these
        electiveCourses: [Text];           // Choose N from these
        totalCredits: Nat;                 // Total credits needed
        estimatedHours: Nat;               // Total time estimate
        difficulty: DifficultyLevel;
        category: Text;                    // "Programming", "Business", etc.
        tags: [Text];
        prerequisites: [Text];             // Required program IDs
        createdAt: Nat64;
        updatedAt: Nat64;
        isPublished: Bool;
        isActive: Bool;
        enrollmentCount: Nat;
        completionCount: Nat;
        averageRating: Float;
        degreeType: DegreeType;            // Certificate, Associate, Bachelor, etc.
    };

    // Course (e.g., "React Fundamentals")
    public type Course = {
        courseId: Text;                    // Unique course ID
        programId: ?Text;                  // Parent program (if any)
        title: Text;
        description: Text;
        shortDescription: Text;
        thumbnailUrl: Text;
        instructor: Principal;
        instructorName: Text;
        lessonIds: [Text];                 // Lessons/videos in order
        credits: Nat;                      // Credits earned
        estimatedHours: Nat;
        difficulty: DifficultyLevel;
        category: Text;
        tags: [Text];
        prerequisites: [Text];             // Required course IDs
        accessTier: AccessTier;            // Who can access
        createdAt: Nat64;
        updatedAt: Nat64;
        isPublished: Bool;
        isActive: Bool;
        enrollmentCount: Nat;
        completionCount: Nat;
        averageRating: Float;
        syllabus: [SyllabusItem];          // Course outline
    };

    // Lesson/Video (individual video)
    public type Lesson = {
        lessonId: Text;                    // Unique lesson ID
        courseId: Text;                    // Parent course
        title: Text;
        description: Text;
        youtubeVideoId: Text;              // YouTube video ID (unlisted)
        duration: Nat;                     // Duration in seconds
        orderIndex: Nat;                   // Position in course
        accessTier: AccessTier;            // Who can access
        isFree: Bool;                      // Free preview?
        resources: [LessonResource];       // Downloadable resources
        transcript: ?Text;                 // Video transcript
        createdAt: Nat64;
        updatedAt: Nat64;
        isPublished: Bool;
        viewCount: Nat;
        averageRating: Float;
        completionRate: Float;             // % who completed
    };

    // Syllabus item
    public type SyllabusItem = {
        sectionTitle: Text;
        lessonIds: [Text];
        description: Text;
    };

    // Lesson resource (PDFs, code files, etc.)
    public type LessonResource = {
        resourceId: Text;
        title: Text;
        description: Text;
        fileUrl: Text;                     // Asset canister URL
        fileType: ResourceType;
        fileSize: Nat;                     // Bytes
    };

    public type ResourceType = {
        #pdf;
        #code;
        #slides;
        #worksheet;
        #other;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // USER PROGRESS & ENROLLMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // Program enrollment
    public type ProgramEnrollment = {
        enrollmentId: Text;
        programId: Text;
        student: Principal;
        enrolledAt: Nat64;
        startedAt: ?Nat64;
        completedAt: ?Nat64;
        creditsEarned: Nat;
        status: EnrollmentStatus;
        progress: Float;                   // 0-100%
        currentCourseId: ?Text;
        completedCourseIds: [Text];
    };

    // Course enrollment
    public type CourseEnrollment = {
        enrollmentId: Text;
        courseId: Text;
        student: Principal;
        enrolledAt: Nat64;
        startedAt: ?Nat64;
        completedAt: ?Nat64;
        status: EnrollmentStatus;
        progress: Float;                   // 0-100%
        currentLessonId: ?Text;
        completedLessonIds: [Text];
        timeSpent: Nat;                    // Total seconds watched
        lastAccessedAt: Nat64;
    };

    // Video progress
    public type VideoProgress = {
        progressId: Text;
        lessonId: Text;
        student: Principal;
        watchedDuration: Nat;              // Seconds watched
        totalDuration: Nat;                // Total video length
        progressPercent: Float;            // 0-100%
        lastPosition: Nat;                 // Last playback position
        completedAt: ?Nat64;
        isCompleted: Bool;
        watchCount: Nat;
        playbackSpeed: Float;              // 1.0, 1.25, 1.5, 2.0
        lastWatchedAt: Nat64;
        notes: [VideoNote];                // Student notes
        bookmarks: [VideoBookmark];        // Timestamp bookmarks
    };

    // Student notes on video
    public type VideoNote = {
        noteId: Text;
        timestamp: Nat;                    // Position in video
        content: Text;
        createdAt: Nat64;
        updatedAt: Nat64;
    };

    // Video bookmarks
    public type VideoBookmark = {
        bookmarkId: Text;
        timestamp: Nat;
        title: Text;
        createdAt: Nat64;
    };

    public type EnrollmentStatus = {
        #notStarted;
        #inProgress;
        #completed;
        #dropped;
        #suspended;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // DEGREES & CERTIFICATES
    // ═══════════════════════════════════════════════════════════════════════════

    // Earned degree/certificate
    public type Degree = {
        degreeId: Text;
        programId: Text;
        student: Principal;
        degreeType: DegreeType;
        title: Text;                       // "Full Stack Development Certificate"
        issuedAt: Nat64;
        completedAt: Nat64;
        creditsEarned: Nat;
        gpa: Float;                        // Overall grade
        certificateUrl: ?Text;             // PDF certificate
        verificationCode: Text;            // Unique verification
        coursesCompleted: [CompletedCourse];
        honors: ?Honors;                   // Distinction level
    };

    public type CompletedCourse = {
        courseId: Text;
        courseTitle: Text;
        completedAt: Nat64;
        grade: Float;
        credits: Nat;
    };

    public type DegreeType = {
        #certificate;                      // Basic certificate
        #specialization;                   // Multiple related courses
        #diploma;                          // Advanced certificate
        #associate;                        // Associate degree
        #bachelor;                         // Bachelor degree
        #master;                           // Master degree
        #nanodegree;                       // Nanodegree/microcredential
    };

    public type Honors = {
        #summa;                            // Summa Cum Laude (3.9+)
        #magna;                            // Magna Cum Laude (3.7+)
        #cum;                              // Cum Laude (3.5+)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RATINGS & REVIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    // Course/Video rating
    public type CourseReview = {
        reviewId: Text;
        courseId: ?Text;                   // If course review
        lessonId: ?Text;                   // If video review
        programId: ?Text;                  // If program review
        student: Principal;
        rating: Nat;                       // 1-5 stars
        title: Text;
        comment: Text;
        pros: [Text];
        cons: [Text];
        difficulty: ?DifficultyLevel;      // How difficult they found it
        wouldRecommend: Bool;
        isVerifiedCompletion: Bool;        // Did they complete it?
        createdAt: Nat64;
        updatedAt: Nat64;
        helpfulCount: Nat;
        instructorResponse: ?InstructorResponse;
    };

    public type InstructorResponse = {
        responseText: Text;
        respondedAt: Nat64;
        updatedAt: Nat64;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ASSESSMENTS & QUIZZES
    // ═══════════════════════════════════════════════════════════════════════════

    // Quiz/Assessment
    public type Assessment = {
        assessmentId: Text;
        courseId: Text;
        lessonId: ?Text;                   // Associated lesson (if any)
        title: Text;
        description: Text;
        assessmentType: AssessmentType;
        questions: [Question];
        passingScore: Nat;                 // Percentage required to pass
        timeLimit: ?Nat;                   // Time limit in seconds
        attemptsAllowed: Nat;              // Max attempts (0 = unlimited)
        isRequired: Bool;                  // Required to complete course?
        orderIndex: Nat;
        createdAt: Nat64;
        isPublished: Bool;
    };

    public type Question = {
        questionId: Text;
        questionText: Text;
        questionType: QuestionType;
        options: [Text];                   // For multiple choice
        correctAnswer: Text;               // Encrypted/hashed
        points: Nat;
        explanation: ?Text;                // Shown after answer
    };

    public type QuestionType = {
        #multipleChoice;
        #trueFalse;
        #shortAnswer;
        #essay;
        #coding;
    };

    public type AssessmentType = {
        #quiz;
        #midterm;
        #final;
        #assignment;
        #project;
    };

    // Assessment submission
    public type AssessmentSubmission = {
        submissionId: Text;
        assessmentId: Text;
        student: Principal;
        answers: [Answer];
        score: Nat;                        // Percentage
        passed: Bool;
        attemptNumber: Nat;
        startedAt: Nat64;
        submittedAt: Nat64;
        timeSpent: Nat;                    // Seconds
        feedback: ?Text;
    };

    public type Answer = {
        questionId: Text;
        studentAnswer: Text;
        isCorrect: Bool;
        pointsEarned: Nat;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // DISCUSSIONS & Q&A
    // ═══════════════════════════════════════════════════════════════════════════

    // Discussion thread
    public type Discussion = {
        discussionId: Text;
        courseId: ?Text;
        lessonId: ?Text;
        programId: ?Text;
        author: Principal;
        authorName: Text;
        title: Text;
        content: Text;
        tags: [Text];
        createdAt: Nat64;
        updatedAt: Nat64;
        replyCount: Nat;
        viewCount: Nat;
        upvotes: Nat;
        isPinned: Bool;
        isSolved: Bool;
        solvedBy: ?Principal;
    };

    // Discussion reply
    public type Reply = {
        replyId: Text;
        discussionId: Text;
        author: Principal;
        authorName: Text;
        content: Text;
        createdAt: Nat64;
        updatedAt: Nat64;
        upvotes: Nat;
        isInstructorReply: Bool;
        isAcceptedAnswer: Bool;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INSTRUCTOR & CONTENT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // Instructor profile
    public type Instructor = {
        instructorId: Principal;
        name: Text;
        bio: Text;
        title: Text;                       // "Senior Developer", "Professor", etc.
        avatarUrl: Text;
        expertise: [Text];                 // Areas of expertise
        socialLinks: [SocialLink];
        coursesCreated: [Text];            // Course IDs
        totalStudents: Nat;
        averageRating: Float;
        joinedAt: Nat64;
        isVerified: Bool;
    };

    public type SocialLink = {
        platform: Text;                    // "Twitter", "LinkedIn", etc.
        url: Text;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ACHIEVEMENTS & GAMIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Achievement badge
    public type Achievement = {
        achievementId: Text;
        title: Text;
        description: Text;
        badgeImageUrl: Text;
        criteria: AchievementCriteria;
        rarity: Rarity;
        isSecret: Bool;                    // Hidden until earned
    };

    public type AchievementCriteria = {
        #completeCourses: Nat;             // Complete N courses
        #earnDegree: Text;                 // Earn specific degree
        #watchHours: Nat;                  // Watch N hours
        #helpOthers: Nat;                  // Get N helpful votes
        #perfectQuiz: Nat;                 // Score 100% on N quizzes
        #streak: Nat;                      // N day learning streak
        #custom: Text;                     // Custom criteria
    };

    public type Rarity = {
        #common;
        #uncommon;
        #rare;
        #epic;
        #legendary;
    };

    // User achievement
    public type UserAchievement = {
        achievementId: Text;
        student: Principal;
        earnedAt: Nat64;
        progress: Float;                   // 0-100% toward earning
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MISC TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    public type DifficultyLevel = {
        #beginner;
        #intermediate;
        #advanced;
        #expert;
    };

    public type AccessTier = {
        #free;                             // Everyone
        #starter;                          // Starter tier+
        #developer;                        // Developer tier+
        #pro;                              // Pro tier only
        #enterprise;                       // Enterprise only
    };

    // Learning path recommendation
    public type LearningPath = {
        pathId: Text;
        title: Text;
        description: Text;
        programIds: [Text];                // Recommended program sequence
        courseIds: [Text];                 // Recommended course sequence
        estimatedHours: Nat;
        difficulty: DifficultyLevel;
        forRole: Text;                     // "Frontend Developer", etc.
    };

    // Platform-wide statistics
    public type UniversityStats = {
        totalPrograms: Nat;
        totalCourses: Nat;
        totalLessons: Nat;
        totalStudents: Nat;
        totalInstructors: Nat;
        totalDegreesIssued: Nat;
        totalWatchHours: Nat;
        averageCourseRating: Float;
        courseCompletionRate: Float;
    };
};

