// Kontext University Manager - Core business logic
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";
import Order "mo:base/Order";

import UniversityTypes "./university_types";
import Logger "mo:cn-logger/logger";

module UniversityManager {
    type AcademicProgram = UniversityTypes.AcademicProgram;
    type Course = UniversityTypes.Course;
    type Lesson = UniversityTypes.Lesson;
    type LessonResource = UniversityTypes.LessonResource;
    type ResourceType = UniversityTypes.ResourceType;
    type ProgramEnrollment = UniversityTypes.ProgramEnrollment;
    type CourseEnrollment = UniversityTypes.CourseEnrollment;
    type VideoProgress = UniversityTypes.VideoProgress;
    type Degree = UniversityTypes.Degree;
    type CourseReview = UniversityTypes.CourseReview;
    type Assessment = UniversityTypes.Assessment;
    type AssessmentSubmission = UniversityTypes.AssessmentSubmission;
    type Discussion = UniversityTypes.Discussion;
    type Reply = UniversityTypes.Reply;
    type Instructor = UniversityTypes.Instructor;
    type Achievement = UniversityTypes.Achievement;
    type UserAchievement = UniversityTypes.UserAchievement;
    type LearningPath = UniversityTypes.LearningPath;
    type VideoNote = UniversityTypes.VideoNote;
    type VideoBookmark = UniversityTypes.VideoBookmark;
    type EnrollmentStatus = UniversityTypes.EnrollmentStatus;
    type DifficultyLevel = UniversityTypes.DifficultyLevel;
    type AccessTier = UniversityTypes.AccessTier;
    type DegreeType = UniversityTypes.DegreeType;

    // StableData type must be at module level for external access
    public type StableData = {
        programs: [(Text, AcademicProgram)];
        courses: [(Text, Course)];
        lessons: [(Text, Lesson)];
        programEnrollments: [(Text, ProgramEnrollment)];
        courseEnrollments: [(Text, CourseEnrollment)];
        videoProgress: [(Text, VideoProgress)];
        degrees: [(Text, Degree)];
        courseReviews: [(Text, CourseReview)];
        assessments: [(Text, Assessment)];
        submissions: [(Text, AssessmentSubmission)];
        discussions: [(Text, Discussion)];
        replies: [(Text, [Reply])];
        instructors: [(Principal, Instructor)];
        achievements: [(Text, Achievement)];
        userAchievements: [(Principal, [UserAchievement])];
        learningPaths: [(Text, LearningPath)];
    };

    public class UniversityManager(logger: Logger.Logger) {
        // HashMaps for all entities
        private var programs = HashMap.HashMap<Text, AcademicProgram>(0, Text.equal, Text.hash);
        private var courses = HashMap.HashMap<Text, Course>(0, Text.equal, Text.hash);
        private var lessons = HashMap.HashMap<Text, Lesson>(0, Text.equal, Text.hash);
        private var programEnrollments = HashMap.HashMap<Text, ProgramEnrollment>(0, Text.equal, Text.hash);
        private var courseEnrollments = HashMap.HashMap<Text, CourseEnrollment>(0, Text.equal, Text.hash);
        private var videoProgress = HashMap.HashMap<Text, VideoProgress>(0, Text.equal, Text.hash);
        private var degrees = HashMap.HashMap<Text, Degree>(0, Text.equal, Text.hash);
        private var courseReviews = HashMap.HashMap<Text, CourseReview>(0, Text.equal, Text.hash);
        private var assessments = HashMap.HashMap<Text, Assessment>(0, Text.equal, Text.hash);
        private var submissions = HashMap.HashMap<Text, AssessmentSubmission>(0, Text.equal, Text.hash);
        private var discussions = HashMap.HashMap<Text, Discussion>(0, Text.equal, Text.hash);
        private var replies = HashMap.HashMap<Text, [Reply]>(0, Text.equal, Text.hash);
        private var instructors = HashMap.HashMap<Principal, Instructor>(0, Principal.equal, Principal.hash);
        private var achievements = HashMap.HashMap<Text, Achievement>(0, Text.equal, Text.hash);
        private var userAchievements = HashMap.HashMap<Principal, [UserAchievement]>(0, Principal.equal, Principal.hash);
        private var learningPaths = HashMap.HashMap<Text, LearningPath>(0, Text.equal, Text.hash);

        // ═══════════════════════════════════════════════════════════════════════════
        // PROGRAM MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func createProgram(
            title: Text,
            description: Text,
            shortDescription: Text,
            thumbnailUrl: Text,
            instructor: Principal,
            instructorName: Text,
            courseIds: [Text],
            requiredCourses: [Text],
            electiveCourses: [Text],
            totalCredits: Nat,
            estimatedHours: Nat,
            difficulty: DifficultyLevel,
            category: Text,
            tags: [Text],
            prerequisites: [Text],
            degreeType: DegreeType
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let programId = generateId("program", instructor, now);

            let program: AcademicProgram = {
                programId = programId;
                title = title;
                description = description;
                shortDescription = shortDescription;
                thumbnailUrl = thumbnailUrl;
                instructor = instructor;
                instructorName = instructorName;
                courseIds = courseIds;
                requiredCourses = requiredCourses;
                electiveCourses = electiveCourses;
                totalCredits = totalCredits;
                estimatedHours = estimatedHours;
                difficulty = difficulty;
                category = category;
                tags = tags;
                prerequisites = prerequisites;
                createdAt = now;
                updatedAt = now;
                isPublished = false;
                isActive = true;
                enrollmentCount = 0;
                completionCount = 0;
                averageRating = 0.0;
                degreeType = degreeType;
            };

            programs.put(programId, program);
            logger.info("Program created: " # programId);
            programId
        };

        public func getProgram(programId: Text) : ?AcademicProgram {
            programs.get(programId)
        };

        public func getAllPrograms() : [AcademicProgram] {
            Iter.toArray(programs.vals())
        };

        public func getPublishedPrograms() : [AcademicProgram] {
            let allPrograms = Iter.toArray(programs.vals());
            Array.filter<AcademicProgram>(
                allPrograms,
                func(p: AcademicProgram): Bool { p.isPublished and p.isActive }
            )
        };

        public func updateProgram(
            programId: Text,
            title: ?Text,
            description: ?Text,
            shortDescription: ?Text,
            courseIds: ?[Text],
            isPublished: ?Bool
        ) : Bool {
            switch (programs.get(programId)) {
                case (?program) {
                    let updated: AcademicProgram = {
                        programId = program.programId;
                        title = switch(title) { case (?t) t; case null program.title };
                        description = switch(description) { case (?d) d; case null program.description };
                        shortDescription = switch(shortDescription) { case (?sd) sd; case null program.shortDescription };
                        thumbnailUrl = program.thumbnailUrl;
                        instructor = program.instructor;
                        instructorName = program.instructorName;
                        courseIds = switch(courseIds) { case (?c) c; case null program.courseIds };
                        requiredCourses = program.requiredCourses;
                        electiveCourses = program.electiveCourses;
                        totalCredits = program.totalCredits;
                        estimatedHours = program.estimatedHours;
                        difficulty = program.difficulty;
                        category = program.category;
                        tags = program.tags;
                        prerequisites = program.prerequisites;
                        createdAt = program.createdAt;
                        updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                        isPublished = switch(isPublished) { case (?p) p; case null program.isPublished };
                        isActive = program.isActive;
                        enrollmentCount = program.enrollmentCount;
                        completionCount = program.completionCount;
                        averageRating = program.averageRating;
                        degreeType = program.degreeType;
                    };
                    programs.put(programId, updated);
                    true
                };
                case null { false };
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // COURSE MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func createCourse(
            programId: ?Text,
            title: Text,
            description: Text,
            shortDescription: Text,
            thumbnailUrl: Text,
            instructor: Principal,
            instructorName: Text,
            lessonIds: [Text],
            credits: Nat,
            estimatedHours: Nat,
            difficulty: DifficultyLevel,
            category: Text,
            tags: [Text],
            prerequisites: [Text],
            accessTier: AccessTier,
            syllabus: [UniversityTypes.SyllabusItem]
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let courseId = generateId("course", instructor, now);

            let course: Course = {
                courseId = courseId;
                programId = programId;
                title = title;
                description = description;
                shortDescription = shortDescription;
                thumbnailUrl = thumbnailUrl;
                instructor = instructor;
                instructorName = instructorName;
                lessonIds = lessonIds;
                credits = credits;
                estimatedHours = estimatedHours;
                difficulty = difficulty;
                category = category;
                tags = tags;
                prerequisites = prerequisites;
                accessTier = accessTier;
                createdAt = now;
                updatedAt = now;
                isPublished = false;
                isActive = true;
                enrollmentCount = 0;
                completionCount = 0;
                averageRating = 0.0;
                syllabus = syllabus;
            };

            courses.put(courseId, course);
            logger.info("Course created: " # courseId);
            courseId
        };

        public func getCourse(courseId: Text) : ?Course {
            courses.get(courseId)
        };

        public func getAllCourses() : [Course] {
            Iter.toArray(courses.vals())
        };

        public func getPublishedCourses() : [Course] {
            let allCourses = Iter.toArray(courses.vals());
            Array.filter<Course>(
                allCourses,
                func(c: Course): Bool { c.isPublished and c.isActive }
            )
        };

        public func getCoursesByTier(tier: AccessTier) : [Course] {
            let allCourses = getPublishedCourses();
            Array.filter<Course>(
                allCourses,
                func(c: Course): Bool {
                    // Check if user's tier allows access
                    switch(c.accessTier, tier) {
                        case (#free, _) { true };
                        case (#starter, #free) { false };
                        case (#starter, _) { true };
                        case (#developer, #free) { false };
                        case (#developer, #starter) { false };
                        case (#developer, _) { true };
                        case (#pro, #pro) { true };
                        case (#pro, #enterprise) { true };
                        case (#pro, _) { false };
                        case (#enterprise, #enterprise) { true };
                        case (#enterprise, _) { false };
                    }
                }
            )
        };

        public func updateCourse(
            courseId: Text,
            title: ?Text,
            description: ?Text,
            shortDescription: ?Text,
            lessonIds: ?[Text],
            isPublished: ?Bool,
            isActive: ?Bool
        ) : Bool {
            switch (courses.get(courseId)) {
                case (?course) {
                    let updated: Course = {
                        courseId = course.courseId;
                        programId = course.programId;
                        title = switch(title) { case (?t) t; case null course.title };
                        description = switch(description) { case (?d) d; case null course.description };
                        shortDescription = switch(shortDescription) { case (?sd) sd; case null course.shortDescription };
                        thumbnailUrl = course.thumbnailUrl;
                        instructor = course.instructor;
                        instructorName = course.instructorName;
                        lessonIds = switch(lessonIds) { case (?l) l; case null course.lessonIds };
                        credits = course.credits;
                        estimatedHours = course.estimatedHours;
                        difficulty = course.difficulty;
                        category = course.category;
                        tags = course.tags;
                        prerequisites = course.prerequisites;
                        accessTier = course.accessTier;
                        createdAt = course.createdAt;
                        updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                        isPublished = switch(isPublished) { case (?p) p; case null course.isPublished };
                        isActive = switch(isActive) { case (?a) a; case null course.isActive };
                        enrollmentCount = course.enrollmentCount;
                        completionCount = course.completionCount;
                        averageRating = course.averageRating;
                        syllabus = course.syllabus;
                    };
                    courses.put(courseId, updated);
                    true
                };
                case null { false };
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // LESSON MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func createLesson(
            courseId: Text,
            title: Text,
            description: Text,
            youtubeVideoId: Text,
            duration: Nat,
            orderIndex: Nat,
            accessTier: AccessTier,
            isFree: Bool,
            resources: [LessonResource],
            transcript: ?Text
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let lessonId = generateId("lesson", Principal.fromText("2vxsx-fae"), now); // Anonymous principal for ID generation

            let lesson: Lesson = {
                lessonId = lessonId;
                courseId = courseId;
                title = title;
                description = description;
                youtubeVideoId = youtubeVideoId;
                duration = duration;
                orderIndex = orderIndex;
                accessTier = accessTier;
                isFree = isFree;
                resources = resources;
                transcript = transcript;
                createdAt = now;
                updatedAt = now;
                isPublished = false;
                viewCount = 0;
                averageRating = 0.0;
                completionRate = 0.0;
            };

            lessons.put(lessonId, lesson);
            logger.info("Lesson created: " # lessonId);
            lessonId
        };

        public func getLesson(lessonId: Text) : ?Lesson {
            lessons.get(lessonId)
        };

        public func getLessonsByCourse(courseId: Text) : [Lesson] {
            let allLessons = Iter.toArray(lessons.vals());
            Array.filter<Lesson>(
                allLessons,
                func(l: Lesson): Bool { l.courseId == courseId }
            )
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // ENROLLMENT MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func enrollInProgram(
            programId: Text,
            student: Principal
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let enrollmentId = generateId("prog_enroll", student, now);

            let enrollment: ProgramEnrollment = {
                enrollmentId = enrollmentId;
                programId = programId;
                student = student;
                enrolledAt = now;
                startedAt = null;
                completedAt = null;
                creditsEarned = 0;
                status = #notStarted;
                progress = 0.0;
                currentCourseId = null;
                completedCourseIds = [];
            };

            programEnrollments.put(enrollmentId, enrollment);
            
            // Update program enrollment count
            switch (programs.get(programId)) {
                case (?program) {
                    let updated = {
                        program with
                        enrollmentCount = program.enrollmentCount + 1;
                    };
                    programs.put(programId, updated);
                };
                case null {};
            };

            logger.info("Program enrollment: " # enrollmentId);
            enrollmentId
        };

        public func enrollInCourse(
            courseId: Text,
            student: Principal
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let enrollmentId = generateId("course_enroll", student, now);

            let enrollment: CourseEnrollment = {
                enrollmentId = enrollmentId;
                courseId = courseId;
                student = student;
                enrolledAt = now;
                startedAt = null;
                completedAt = null;
                status = #notStarted;
                progress = 0.0;
                currentLessonId = null;
                completedLessonIds = [];
                timeSpent = 0;
                lastAccessedAt = now;
            };

            courseEnrollments.put(enrollmentId, enrollment);
            
            // Update course enrollment count
            switch (courses.get(courseId)) {
                case (?course) {
                    let updated = {
                        course with
                        enrollmentCount = course.enrollmentCount + 1;
                    };
                    courses.put(courseId, updated);
                };
                case null {};
            };

            logger.info("Course enrollment: " # enrollmentId);
            enrollmentId
        };

        public func getStudentEnrollments(student: Principal) : {
            programs: [ProgramEnrollment];
            courses: [CourseEnrollment];
        } {
            let allProgramEnrollments = Iter.toArray(programEnrollments.vals());
            let allCourseEnrollments = Iter.toArray(courseEnrollments.vals());

            {
                programs = Array.filter<ProgramEnrollment>(
                    allProgramEnrollments,
                    func(e: ProgramEnrollment): Bool { e.student == student }
                );
                courses = Array.filter<CourseEnrollment>(
                    allCourseEnrollments,
                    func(e: CourseEnrollment): Bool { e.student == student }
                );
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // VIDEO PROGRESS TRACKING
        // ═══════════════════════════════════════════════════════════════════════════

        public func updateVideoProgress(
            lessonId: Text,
            student: Principal,
            watchedDuration: Nat,
            totalDuration: Nat,
            lastPosition: Nat,
            playbackSpeed: Float,
            isCompleted: Bool
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let progressId = generateProgressId(lessonId, student);
            let progressPercent = if (totalDuration > 0) {
                Float.fromInt(watchedDuration * 100) / Float.fromInt(totalDuration)
            } else {
                0.0
            };

            let existingProgress = videoProgress.get(progressId);
            let watchCount = switch (existingProgress) {
                case (?p) { p.watchCount + 1 };
                case null { 1 };
            };
            let existingNotes = switch (existingProgress) {
                case (?p) { p.notes };
                case null { [] };
            };
            let existingBookmarks = switch (existingProgress) {
                case (?p) { p.bookmarks };
                case null { [] };
            };

            let progress: VideoProgress = {
                progressId = progressId;
                lessonId = lessonId;
                student = student;
                watchedDuration = watchedDuration;
                totalDuration = totalDuration;
                progressPercent = progressPercent;
                lastPosition = lastPosition;
                completedAt = if (isCompleted) { ?now } else { null };
                isCompleted = isCompleted;
                watchCount = watchCount;
                playbackSpeed = playbackSpeed;
                lastWatchedAt = now;
                notes = existingNotes;
                bookmarks = existingBookmarks;
            };

            videoProgress.put(progressId, progress);
            progressId
        };

        public func addVideoNote(
            lessonId: Text,
            student: Principal,
            timestamp: Nat,
            content: Text
        ) : Bool {
            let progressId = generateProgressId(lessonId, student);
            switch (videoProgress.get(progressId)) {
                case (?progress) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let noteId = generateId("note", student, now);
                    let newNote: VideoNote = {
                        noteId = noteId;
                        timestamp = timestamp;
                        content = content;
                        createdAt = now;
                        updatedAt = now;
                    };

                    let updatedNotes = Array.append<VideoNote>(progress.notes, [newNote]);
                    let updated = {
                        progress with
                        notes = updatedNotes;
                    };
                    videoProgress.put(progressId, updated);
                    true
                };
                case null { false };
            }
        };

        public func addVideoBookmark(
            lessonId: Text,
            student: Principal,
            timestamp: Nat,
            title: Text
        ) : Bool {
            let progressId = generateProgressId(lessonId, student);
            switch (videoProgress.get(progressId)) {
                case (?progress) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let bookmarkId = generateId("bookmark", student, now);
                    let newBookmark: VideoBookmark = {
                        bookmarkId = bookmarkId;
                        timestamp = timestamp;
                        title = title;
                        createdAt = now;
                    };

                    let updatedBookmarks = Array.append<VideoBookmark>(progress.bookmarks, [newBookmark]);
                    let updated = {
                        progress with
                        bookmarks = updatedBookmarks;
                    };
                    videoProgress.put(progressId, updated);
                    true
                };
                case null { false };
            }
        };

        public func getVideoProgress(lessonId: Text, student: Principal) : ?VideoProgress {
            let progressId = generateProgressId(lessonId, student);
            videoProgress.get(progressId)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // ASSESSMENT MANAGEMENT (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createAssessment(
            courseId: Text,
            lessonId: ?Text,
            title: Text,
            description: Text,
            assessmentType: UniversityTypes.AssessmentType,
            questions: [UniversityTypes.Question],
            passingScore: Nat,
            timeLimit: ?Nat,
            attemptsAllowed: Nat,
            isRequired: Bool,
            orderIndex: Nat
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let assessmentId = generateId("assessment", Principal.fromText("2vxsx-fae"), now);

            let assessment: Assessment = {
                assessmentId = assessmentId;
                courseId = courseId;
                lessonId = lessonId;
                title = title;
                description = description;
                assessmentType = assessmentType;
                questions = questions;
                passingScore = passingScore;
                timeLimit = timeLimit;
                attemptsAllowed = attemptsAllowed;
                isRequired = isRequired;
                orderIndex = orderIndex;
                createdAt = now;
                isPublished = false;
            };

            assessments.put(assessmentId, assessment);
            logger.info("Assessment created: " # assessmentId);
            assessmentId
        };

        public func submitAssessment(
            assessmentId: Text,
            student: Principal,
            answers: [UniversityTypes.Answer],
            timeSpent: Nat
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let submissionId = generateId("submission", student, now);

            // Calculate score
            var totalPoints = 0;
            var earnedPoints = 0;
            for (answer in answers.vals()) {
                totalPoints += 1; // Simplified: 1 point per question
                if (answer.isCorrect) {
                    earnedPoints += 1;
                };
            };

            let score = if (totalPoints > 0) {
                (earnedPoints * 100) / totalPoints
            } else {
                0
            };

            // Get attempt number
            let allSubmissions = Iter.toArray(submissions.vals());
            let previousAttempts = Array.filter<AssessmentSubmission>(
                allSubmissions,
                func(s: AssessmentSubmission): Bool {
                    s.assessmentId == assessmentId and s.student == student
                }
            );
            let attemptNumber = previousAttempts.size() + 1;

            // Check if passed
            switch (assessments.get(assessmentId)) {
                case (?assessment) {
                    let passed = score >= assessment.passingScore;

                    let submission: AssessmentSubmission = {
                        submissionId = submissionId;
                        assessmentId = assessmentId;
                        student = student;
                        answers = answers;
                        score = score;
                        passed = passed;
                        attemptNumber = attemptNumber;
                        startedAt = now - Nat64.fromNat(timeSpent * 1_000_000_000); // Convert to nanos
                        submittedAt = now;
                        timeSpent = timeSpent;
                        feedback = null;
                    };

                    submissions.put(submissionId, submission);
                    logger.info("Assessment submitted: " # submissionId # " Score: " # Nat.toText(score));
                    submissionId
                };
                case null {
                    logger.error("Assessment not found: " # assessmentId);
                    submissionId
                };
            }
        };

        public func getStudentSubmissions(student: Principal, assessmentId: Text) : [AssessmentSubmission] {
            let allSubmissions = Iter.toArray(submissions.vals());
            Array.filter<AssessmentSubmission>(
                allSubmissions,
                func(s: AssessmentSubmission): Bool {
                    s.student == student and s.assessmentId == assessmentId
                }
            )
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // REVIEW SYSTEM (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func submitReview(
            courseId: ?Text,
            lessonId: ?Text,
            programId: ?Text,
            student: Principal,
            rating: Nat,
            title: Text,
            comment: Text,
            pros: [Text],
            cons: [Text],
            difficulty: ?DifficultyLevel,
            wouldRecommend: Bool,
            isVerifiedCompletion: Bool
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let reviewId = generateId("review", student, now);

            let review: CourseReview = {
                reviewId = reviewId;
                courseId = courseId;
                lessonId = lessonId;
                programId = programId;
                student = student;
                rating = rating;
                title = title;
                comment = comment;
                pros = pros;
                cons = cons;
                difficulty = difficulty;
                wouldRecommend = wouldRecommend;
                isVerifiedCompletion = isVerifiedCompletion;
                createdAt = now;
                updatedAt = now;
                helpfulCount = 0;
                instructorResponse = null;
            };

            courseReviews.put(reviewId, review);
            
            // Update average rating
            updateAverageRating(courseId, lessonId, programId);
            
            logger.info("Review submitted: " # reviewId);
            reviewId
        };

        public func getReviews(courseId: ?Text, lessonId: ?Text, programId: ?Text) : [CourseReview] {
            let allReviews = Iter.toArray(courseReviews.vals());
            Array.filter<CourseReview>(
                allReviews,
                func(r: CourseReview): Bool {
                    (switch(courseId) { case (?id) { r.courseId == ?id }; case null { true } }) and
                    (switch(lessonId) { case (?id) { r.lessonId == ?id }; case null { true } }) and
                    (switch(programId) { case (?id) { r.programId == ?id }; case null { true } })
                }
            )
        };

        public func voteReviewHelpful(reviewId: Text) : Bool {
            switch (courseReviews.get(reviewId)) {
                case (?review) {
                    let updated = {
                        review with
                        helpfulCount = review.helpfulCount + 1;
                    };
                    courseReviews.put(reviewId, updated);
                    true
                };
                case null { false };
            }
        };

        public func respondToReview(reviewId: Text, instructor: Principal, responseText: Text) : Bool {
            switch (courseReviews.get(reviewId)) {
                case (?review) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let response: UniversityTypes.InstructorResponse = {
                        responseText = responseText;
                        respondedAt = now;
                        updatedAt = now;
                    };

                    let updated = {
                        review with
                        instructorResponse = ?response;
                    };
                    courseReviews.put(reviewId, updated);
                    true
                };
                case null { false };
            }
        };

        private func updateAverageRating(courseId: ?Text, lessonId: ?Text, programId: ?Text) {
            let reviews = getReviews(courseId, lessonId, programId);
            if (reviews.size() > 0) {
                var totalRating = 0;
                for (review in reviews.vals()) {
                    totalRating += review.rating;
                };
                let avgRating = Float.fromInt(totalRating) / Float.fromInt(reviews.size());

                // Update course rating
                switch(courseId) {
                    case (?id) {
                        switch (courses.get(id)) {
                            case (?course) {
                                let updated = {
                                    course with
                                    averageRating = avgRating;
                                };
                                courses.put(id, updated);
                            };
                            case null {};
                        };
                    };
                    case null {};
                };

                // Update program rating
                switch(programId) {
                    case (?id) {
                        switch (programs.get(id)) {
                            case (?program) {
                                let updated = {
                                    program with
                                    averageRating = avgRating;
                                };
                                programs.put(id, updated);
                            };
                            case null {};
                        };
                    };
                    case null {};
                };

                // Update lesson rating
                switch(lessonId) {
                    case (?id) {
                        switch (lessons.get(id)) {
                            case (?lesson) {
                                let updated = {
                                    lesson with
                                    averageRating = avgRating;
                                };
                                lessons.put(id, updated);
                            };
                            case null {};
                        };
                    };
                    case null {};
                };
            };
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // DISCUSSION FORUMS (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createDiscussion(
            courseId: ?Text,
            lessonId: ?Text,
            programId: ?Text,
            author: Principal,
            authorName: Text,
            title: Text,
            content: Text,
            tags: [Text]
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let discussionId = generateId("discussion", author, now);

            let discussion: Discussion = {
                discussionId = discussionId;
                courseId = courseId;
                lessonId = lessonId;
                programId = programId;
                author = author;
                authorName = authorName;
                title = title;
                content = content;
                tags = tags;
                createdAt = now;
                updatedAt = now;
                replyCount = 0;
                viewCount = 0;
                upvotes = 0;
                isPinned = false;
                isSolved = false;
                solvedBy = null;
            };

            discussions.put(discussionId, discussion);
            logger.info("Discussion created: " # discussionId);
            discussionId
        };

        public func replyToDiscussion(
            discussionId: Text,
            author: Principal,
            authorName: Text,
            content: Text,
            isInstructorReply: Bool
        ) : Bool {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let replyId = generateId("reply", author, now);

            let reply: UniversityTypes.Reply = {
                replyId = replyId;
                discussionId = discussionId;
                author = author;
                authorName = authorName;
                content = content;
                createdAt = now;
                updatedAt = now;
                upvotes = 0;
                isInstructorReply = isInstructorReply;
                isAcceptedAnswer = false;
            };

            // Add reply to discussion
            let existingReplies = switch (replies.get(discussionId)) {
                case (?r) { r };
                case null { [] };
            };
            let updatedReplies = Array.append<UniversityTypes.Reply>(existingReplies, [reply]);
            replies.put(discussionId, updatedReplies);

            // Update reply count
            switch (discussions.get(discussionId)) {
                case (?discussion) {
                    let updated = {
                        discussion with
                        replyCount = discussion.replyCount + 1;
                        updatedAt = now;
                    };
                    discussions.put(discussionId, updated);
                };
                case null {};
            };

            true
        };

        public func markDiscussionSolved(discussionId: Text, solver: Principal) : Bool {
            switch (discussions.get(discussionId)) {
                case (?discussion) {
                    let updated = {
                        discussion with
                        isSolved = true;
                        solvedBy = ?solver;
                    };
                    discussions.put(discussionId, updated);
                    true
                };
                case null { false };
            }
        };

        public func getDiscussions(courseId: ?Text, lessonId: ?Text, programId: ?Text) : [Discussion] {
            let allDiscussions = Iter.toArray(discussions.vals());
            Array.filter<Discussion>(
                allDiscussions,
                func(d: Discussion): Bool {
                    (switch(courseId) { case (?id) { d.courseId == ?id }; case null { true } }) and
                    (switch(lessonId) { case (?id) { d.lessonId == ?id }; case null { true } }) and
                    (switch(programId) { case (?id) { d.programId == ?id }; case null { true } })
                }
            )
        };

        public func getReplies(discussionId: Text) : [UniversityTypes.Reply] {
            switch (replies.get(discussionId)) {
                case (?r) { r };
                case null { [] };
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // DEGREE ISSUANCE (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func checkDegreeEligibility(programId: Text, student: Principal) : Bool {
            // Get program
            switch (programs.get(programId)) {
                case (?program) {
                    // Get student's enrollment
                    let allEnrollments = Iter.toArray(programEnrollments.vals());
                    let studentEnrollments = Array.filter<ProgramEnrollment>(
                        allEnrollments,
                        func(e: ProgramEnrollment): Bool {
                            e.programId == programId and e.student == student
                        }
                    );

                    switch (studentEnrollments.size()) {
                        case 0 { false }; // Not enrolled
                        case _ {
                            let enrollment = studentEnrollments[0];
                            // Check if all required courses are completed
                            let allCompleted = Array.foldLeft<Text, Bool>(
                                program.requiredCourses,
                                true,
                                func(acc: Bool, courseId: Text): Bool {
                                    acc and Array.indexOf<Text>(courseId, enrollment.completedCourseIds, Text.equal) != null
                                }
                            );
                            allCompleted
                        };
                    };
                };
                case null { false };
            }
        };

        public func issueDegree(
            programId: Text,
            student: Principal,
            gpa: Float,
            honors: ?UniversityTypes.Honors
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let degreeId = generateId("degree", student, now);
            
            switch (programs.get(programId)) {
                case (?program) {
                    // Generate verification code
                    let verificationCode = "KNTXT-" # Nat64.toText(now) # "-" # Nat.toText(Nat32.toNat(Text.hash(degreeId)));

                    // Get completed courses
                    let allEnrollments = Iter.toArray(courseEnrollments.vals());
                    let completedCourses = Array.mapFilter<CourseEnrollment, UniversityTypes.CompletedCourse>(
                        allEnrollments,
                        func(e: CourseEnrollment): ?UniversityTypes.CompletedCourse {
                            if (e.student == student and e.status == #completed) {
                                switch (courses.get(e.courseId)) {
                                    case (?course) {
                                        ?{
                                            courseId = course.courseId;
                                            courseTitle = course.title;
                                            completedAt = switch(e.completedAt) { case (?c) c; case null now };
                                            grade = 4.0; // Simplified
                                            credits = course.credits;
                                        }
                                    };
                                    case null { null };
                                }
                            } else {
                                null
                            }
                        }
                    );

                    let degree: Degree = {
                        degreeId = degreeId;
                        programId = programId;
                        student = student;
                        degreeType = program.degreeType;
                        title = program.title;
                        issuedAt = now;
                        completedAt = now;
                        creditsEarned = program.totalCredits;
                        gpa = gpa;
                        certificateUrl = null;
                        verificationCode = verificationCode;
                        coursesCompleted = completedCourses;
                        honors = honors;
                    };

                    degrees.put(degreeId, degree);
                    
                    // Update program completion count
                    let updated = {
                        program with
                        completionCount = program.completionCount + 1;
                    };
                    programs.put(programId, updated);

                    logger.info("Degree issued: " # degreeId # " to " # Principal.toText(student));
                    degreeId
                };
                case null { degreeId };
            }
        };

        public func verifyDegree(verificationCode: Text) : ?Degree {
            let allDegrees = Iter.toArray(degrees.vals());
            let found = Array.filter<Degree>(
                allDegrees,
                func(d: Degree): Bool { d.verificationCode == verificationCode }
            );
            if (found.size() > 0) {
                ?found[0]
            } else {
                null
            }
        };

        public func getStudentDegrees(student: Principal) : [Degree] {
            let allDegrees = Iter.toArray(degrees.vals());
            Array.filter<Degree>(
                allDegrees,
                func(d: Degree): Bool { d.student == student }
            )
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // ACHIEVEMENT SYSTEM (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createAchievement(
            title: Text,
            description: Text,
            badgeImageUrl: Text,
            criteria: UniversityTypes.AchievementCriteria,
            rarity: UniversityTypes.Rarity,
            isSecret: Bool
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let achievementId = generateId("achievement", Principal.fromText("2vxsx-fae"), now);

            let achievement: Achievement = {
                achievementId = achievementId;
                title = title;
                description = description;
                badgeImageUrl = badgeImageUrl;
                criteria = criteria;
                rarity = rarity;
                isSecret = isSecret;
            };

            achievements.put(achievementId, achievement);
            logger.info("Achievement created: " # achievementId);
            achievementId
        };

        public func awardAchievement(achievementId: Text, student: Principal) : Bool {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            
            let userAchievement: UserAchievement = {
                achievementId = achievementId;
                student = student;
                earnedAt = now;
                progress = 100.0;
            };

            let existingAchievements = switch (userAchievements.get(student)) {
                case (?a) { a };
                case null { [] };
            };

            // Check if already awarded
            let alreadyHas = Array.find<UserAchievement>(
                existingAchievements,
                func(a: UserAchievement): Bool { a.achievementId == achievementId }
            );

            if (alreadyHas == null) {
                let updatedAchievements = Array.append<UserAchievement>(existingAchievements, [userAchievement]);
                userAchievements.put(student, updatedAchievements);
                logger.info("Achievement awarded: " # achievementId # " to " # Principal.toText(student));
                true
            } else {
                false
            }
        };

        public func getUserAchievements(student: Principal) : [UserAchievement] {
            switch (userAchievements.get(student)) {
                case (?a) { a };
                case null { [] };
            }
        };

        public func getAllAchievements() : [Achievement] {
            Iter.toArray(achievements.vals())
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // INSTRUCTOR TOOLS (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createInstructorProfile(
            instructorId: Principal,
            name: Text,
            bio: Text,
            title: Text,
            avatarUrl: Text,
            expertise: [Text],
            socialLinks: [UniversityTypes.SocialLink]
        ) : Bool {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            
            let instructor: Instructor = {
                instructorId = instructorId;
                name = name;
                bio = bio;
                title = title;
                avatarUrl = avatarUrl;
                expertise = expertise;
                socialLinks = socialLinks;
                coursesCreated = [];
                totalStudents = 0;
                averageRating = 0.0;
                joinedAt = now;
                isVerified = false;
            };

            instructors.put(instructorId, instructor);
            logger.info("Instructor profile created: " # Principal.toText(instructorId));
            true
        };

        public func getInstructor(instructorId: Principal) : ?Instructor {
            instructors.get(instructorId)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // LEARNING PATHS (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createLearningPath(
            title: Text,
            description: Text,
            programIds: [Text],
            courseIds: [Text],
            estimatedHours: Nat,
            difficulty: DifficultyLevel,
            forRole: Text
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let pathId = generateId("path", Principal.fromText("2vxsx-fae"), now);

            let path: LearningPath = {
                pathId = pathId;
                title = title;
                description = description;
                programIds = programIds;
                courseIds = courseIds;
                estimatedHours = estimatedHours;
                difficulty = difficulty;
                forRole = forRole;
            };

            learningPaths.put(pathId, path);
            logger.info("Learning path created: " # pathId);
            pathId
        };

        public func getLearningPaths() : [LearningPath] {
            Iter.toArray(learningPaths.vals())
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // STATISTICS (PHASE 2)
        // ═══════════════════════════════════════════════════════════════════════════

        public func getUniversityStats() : UniversityTypes.UniversityStats {
            let allCourseReviews = Iter.toArray(courseReviews.vals());
            var totalRating = 0.0;
            var reviewCount = 0;
            for (review in allCourseReviews.vals()) {
                totalRating += Float.fromInt(review.rating);
                reviewCount += 1;
            };
            let avgRating = if (reviewCount > 0) {
                totalRating / Float.fromInt(reviewCount)
            } else {
                0.0
            };

            // Calculate completion rate
            let allCourseEnrollments = Iter.toArray(courseEnrollments.vals());
            let completedCount = Array.filter<CourseEnrollment>(
                allCourseEnrollments,
                func(e: CourseEnrollment): Bool { e.status == #completed }
            ).size();
            let completionRate = if (allCourseEnrollments.size() > 0) {
                Float.fromInt(completedCount * 100) / Float.fromInt(allCourseEnrollments.size())
            } else {
                0.0
            };

            // Count unique students
            let uniqueStudents = Buffer.Buffer<Principal>(0);
            for (enrollment in allCourseEnrollments.vals()) {
                let exists = Array.find<Principal>(
                    Buffer.toArray(uniqueStudents),
                    func(p: Principal): Bool { p == enrollment.student }
                );
                if (exists == null) {
                    uniqueStudents.add(enrollment.student);
                };
            };

            // Calculate total watch hours
            let allProgress = Iter.toArray(videoProgress.vals());
            var totalSeconds = 0;
            for (progress in allProgress.vals()) {
                totalSeconds += progress.watchedDuration;
            };
            let totalHours = totalSeconds / 3600;

            {
                totalPrograms = programs.size();
                totalCourses = courses.size();
                totalLessons = lessons.size();
                totalStudents = uniqueStudents.size();
                totalInstructors = instructors.size();
                totalDegreesIssued = degrees.size();
                totalWatchHours = totalHours;
                averageCourseRating = avgRating;
                courseCompletionRate = completionRate;
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // HELPER FUNCTIONS
        // ═══════════════════════════════════════════════════════════════════════════

        private func generateId(prefix: Text, principal: Principal, timestamp: Nat64) : Text {
            let seed = prefix # Principal.toText(principal) # Nat64.toText(timestamp);
            let hash = Text.hash(seed);
            prefix # "_" # Nat.toText(Nat32.toNat(hash)) # "_" # Nat64.toText(timestamp)
        };

        private func generateProgressId(lessonId: Text, student: Principal) : Text {
            lessonId # "_" # Principal.toText(student)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // STABLE STORAGE
        // ═══════════════════════════════════════════════════════════════════════════

        public func toStable() : StableData {
            {
                programs = Iter.toArray(programs.entries());
                courses = Iter.toArray(courses.entries());
                lessons = Iter.toArray(lessons.entries());
                programEnrollments = Iter.toArray(programEnrollments.entries());
                courseEnrollments = Iter.toArray(courseEnrollments.entries());
                videoProgress = Iter.toArray(videoProgress.entries());
                degrees = Iter.toArray(degrees.entries());
                courseReviews = Iter.toArray(courseReviews.entries());
                assessments = Iter.toArray(assessments.entries());
                submissions = Iter.toArray(submissions.entries());
                discussions = Iter.toArray(discussions.entries());
                replies = Iter.toArray(replies.entries());
                instructors = Iter.toArray(instructors.entries());
                achievements = Iter.toArray(achievements.entries());
                userAchievements = Iter.toArray(userAchievements.entries());
                learningPaths = Iter.toArray(learningPaths.entries());
            }
        };

        public func fromStable(data: StableData) {
            programs := HashMap.fromIter<Text, AcademicProgram>(data.programs.vals(), data.programs.size(), Text.equal, Text.hash);
            courses := HashMap.fromIter<Text, Course>(data.courses.vals(), data.courses.size(), Text.equal, Text.hash);
            lessons := HashMap.fromIter<Text, Lesson>(data.lessons.vals(), data.lessons.size(), Text.equal, Text.hash);
            programEnrollments := HashMap.fromIter<Text, ProgramEnrollment>(data.programEnrollments.vals(), data.programEnrollments.size(), Text.equal, Text.hash);
            courseEnrollments := HashMap.fromIter<Text, CourseEnrollment>(data.courseEnrollments.vals(), data.courseEnrollments.size(), Text.equal, Text.hash);
            videoProgress := HashMap.fromIter<Text, VideoProgress>(data.videoProgress.vals(), data.videoProgress.size(), Text.equal, Text.hash);
            degrees := HashMap.fromIter<Text, Degree>(data.degrees.vals(), data.degrees.size(), Text.equal, Text.hash);
            courseReviews := HashMap.fromIter<Text, CourseReview>(data.courseReviews.vals(), data.courseReviews.size(), Text.equal, Text.hash);
            assessments := HashMap.fromIter<Text, Assessment>(data.assessments.vals(), data.assessments.size(), Text.equal, Text.hash);
            submissions := HashMap.fromIter<Text, AssessmentSubmission>(data.submissions.vals(), data.submissions.size(), Text.equal, Text.hash);
            discussions := HashMap.fromIter<Text, Discussion>(data.discussions.vals(), data.discussions.size(), Text.equal, Text.hash);
            replies := HashMap.fromIter<Text, [Reply]>(data.replies.vals(), data.replies.size(), Text.equal, Text.hash);
            instructors := HashMap.fromIter<Principal, Instructor>(data.instructors.vals(), data.instructors.size(), Principal.equal, Principal.hash);
            achievements := HashMap.fromIter<Text, Achievement>(data.achievements.vals(), data.achievements.size(), Text.equal, Text.hash);
            userAchievements := HashMap.fromIter<Principal, [UserAchievement]>(data.userAchievements.vals(), data.userAchievements.size(), Principal.equal, Principal.hash);
            learningPaths := HashMap.fromIter<Text, LearningPath>(data.learningPaths.vals(), data.learningPaths.size(), Text.equal, Text.hash);
        };
    };
};

