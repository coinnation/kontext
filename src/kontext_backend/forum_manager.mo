/**
 * Platform-Wide Community Forum Manager
 * Business logic for the Kontext community forum
 */

import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Text "mo:base/Text";
import Char "mo:base/Char";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Hash "mo:base/Hash";
import Buffer "mo:base/Buffer";
import Order "mo:base/Order";

import ForumTypes "./forum_types";
import Logger "mo:cn-logger/logger";

module ForumManager {
    type ForumCategory = ForumTypes.ForumCategory;
    type ForumThread = ForumTypes.ForumThread;
    type ForumReply = ForumTypes.ForumReply;
    type Vote = ForumTypes.Vote;
    type VoteType = ForumTypes.VoteType;
    type ThreadStatus = ForumTypes.ThreadStatus;
    type SortOption = ForumTypes.SortOption;
    type ForumStats = ForumTypes.ForumStats;
    type UserForumProfile = ForumTypes.UserForumProfile;

    // StableData type must be at module level for external access
    public type StableData = {
        categories: [(Text, ForumCategory)];
        threads: [(Text, ForumThread)];
        replies: [(Text, [ForumReply])];
        votes: [(Text, Vote)];
        userProfiles: [(Principal, UserForumProfile)];
    };

    public class ForumManager(logger: Logger.Logger) {
        // HashMaps for all entities
        private var categories = HashMap.HashMap<Text, ForumCategory>(0, Text.equal, Text.hash);
        private var threads = HashMap.HashMap<Text, ForumThread>(0, Text.equal, Text.hash);
        private var replies = HashMap.HashMap<Text, [ForumReply]>(0, Text.equal, Text.hash);
        private var votes = HashMap.HashMap<Text, Vote>(0, Text.equal, Text.hash);
        private var userProfiles = HashMap.HashMap<Principal, UserForumProfile>(0, Principal.equal, Principal.hash);

        // ═══════════════════════════════════════════════════════════════════════════
        // CATEGORY MANAGEMENT (Admin Only)
        // ═══════════════════════════════════════════════════════════════════════════

        public func createCategory(
            name: Text,
            description: Text,
            icon: Text,
            slug: Text,
            color: Text,
            orderIndex: Nat
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let categoryId = generateId("cat", name);

            let category: ForumCategory = {
                categoryId;
                name;
                description;
                icon;
                slug;
                orderIndex;
                threadCount = 0;
                postCount = 0;
                lastActivity = null;
                lastThreadTitle = null;
                lastThreadId = null;
                color;
                isActive = true;
                createdAt = now;
                updatedAt = now;
            };

            categories.put(categoryId, category);
            logger.info("Forum category created: " # name);
            categoryId
        };

        public func updateCategory(
            categoryId: Text,
            name: ?Text,
            description: ?Text,
            icon: ?Text,
            color: ?Text,
            orderIndex: ?Nat,
            isActive: ?Bool
        ) : Bool {
            switch (categories.get(categoryId)) {
                case null { false };
                case (?category) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let updated: ForumCategory = {
                        categoryId = category.categoryId;
                        name = switch (name) { case (?n) { n }; case null { category.name } };
                        description = switch (description) { case (?d) { d }; case null { category.description } };
                        icon = switch (icon) { case (?i) { i }; case null { category.icon } };
                        slug = category.slug;
                        orderIndex = switch (orderIndex) { case (?o) { o }; case null { category.orderIndex } };
                        threadCount = category.threadCount;
                        postCount = category.postCount;
                        lastActivity = category.lastActivity;
                        lastThreadTitle = category.lastThreadTitle;
                        lastThreadId = category.lastThreadId;
                        color = switch (color) { case (?c) { c }; case null { category.color } };
                        isActive = switch (isActive) { case (?a) { a }; case null { category.isActive } };
                        createdAt = category.createdAt;
                        updatedAt = now;
                    };
                    categories.put(categoryId, updated);
                    true
                };
            };
        };

        public func deleteCategory(categoryId: Text) : Bool {
            switch (categories.remove(categoryId)) {
                case null { false };
                case (?_) { true };
            };
        };

        public func getCategory(categoryId: Text) : ?ForumCategory {
            categories.get(categoryId)
        };

        public func getAllCategories() : [ForumCategory] {
            let cats = Iter.toArray(categories.vals());
            Array.sort(cats, func(a: ForumCategory, b: ForumCategory) : Order.Order {
                Nat.compare(a.orderIndex, b.orderIndex)
            })
        };

        public func getActiveCategories() : [ForumCategory] {
            let cats = Iter.toArray(categories.vals());
            let active = Array.filter(cats, func(c: ForumCategory) : Bool { c.isActive });
            Array.sort(active, func(a: ForumCategory, b: ForumCategory) : Order.Order {
                Nat.compare(a.orderIndex, b.orderIndex)
            })
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // THREAD MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func createThread(
            categoryId: Text,
            author: Principal,
            authorName: Text,
            title: Text,
            content: Text,
            tags: [Text]
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let threadId = generateId("thread", title);

            // Get category name
            let categoryName = switch (categories.get(categoryId)) {
                case null { "Unknown" };
                case (?cat) { cat.name };
            };

            let thread: ForumThread = {
                threadId;
                categoryId;
                categoryName;
                author;
                authorName;
                title;
                content;
                tags;
                createdAt = now;
                updatedAt = now;
                viewCount = 0;
                replyCount = 0;
                upvotes = 0;
                downvotes = 0;
                isPinned = false;
                isLocked = false;
                isFeatured = false;
                hasAcceptedAnswer = false;
                acceptedAnswerId = null;
                lastReplyAt = null;
                lastReplyBy = null;
                lastReplyByName = null;
            };

            threads.put(threadId, thread);

            // Update category stats
            switch (categories.get(categoryId)) {
                case null { };
                case (?category) {
                    let updated: ForumCategory = {
                        categoryId = category.categoryId;
                        name = category.name;
                        description = category.description;
                        icon = category.icon;
                        slug = category.slug;
                        orderIndex = category.orderIndex;
                        threadCount = category.threadCount + 1;
                        postCount = category.postCount + 1;
                        lastActivity = ?now;
                        lastThreadTitle = ?title;
                        lastThreadId = ?threadId;
                        color = category.color;
                        isActive = category.isActive;
                        createdAt = category.createdAt;
                        updatedAt = now;
                    };
                    categories.put(categoryId, updated);
                };
            };

            // Update user profile
            incrementUserThreadCount(author, authorName);

            logger.info("Forum thread created: " # title);
            threadId
        };

        public func getThread(threadId: Text) : ?ForumThread {
            threads.get(threadId)
        };

        public func incrementViewCount(threadId: Text) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = thread.updatedAt;
                        viewCount = thread.viewCount + 1;
                        replyCount = thread.replyCount;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = thread.isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updated);
                    true
                };
            };
        };

        public func getThreadsByCategory(categoryId: Text) : [ForumThread] {
            let allThreads = Iter.toArray(threads.vals());
            let categoryThreads = Array.filter(allThreads, func(t: ForumThread) : Bool {
                t.categoryId == categoryId
            });
            // Sort by latest activity
            Array.sort(categoryThreads, func(a: ForumThread, b: ForumThread) : Order.Order {
                let aTime = switch (a.lastReplyAt) { case null { a.createdAt }; case (?t) { t } };
                let bTime = switch (b.lastReplyAt) { case null { b.createdAt }; case (?t) { t } };
                Nat64.compare(bTime, aTime) // Descending
            })
        };

        public func getThreadsByCategoryPaginated(
            categoryId: Text,
            limit: Nat,
            offset: Nat
        ) : ([ForumThread], Nat) {
            let allThreads = Iter.toArray(threads.vals());
            let categoryThreads = Array.filter(allThreads, func(t: ForumThread) : Bool {
                t.categoryId == categoryId
            });
            // Sort by latest activity (pinned first, then by activity)
            let sorted = Array.sort(categoryThreads, func(a: ForumThread, b: ForumThread) : Order.Order {
                // Pinned threads first
                if (a.isPinned and not b.isPinned) { return #less };
                if (not a.isPinned and b.isPinned) { return #greater };
                // Then by latest activity
                let aTime = switch (a.lastReplyAt) { case null { a.createdAt }; case (?t) { t } };
                let bTime = switch (b.lastReplyAt) { case null { b.createdAt }; case (?t) { t } };
                Nat64.compare(bTime, aTime) // Descending
            });
            let total = sorted.size();
            let start = Nat.min(offset, total);
            let end = Nat.min(start + limit, total);
            let paginated = Array.tabulate(end - start, func(i: Nat) : ForumThread {
                sorted[start + i]
            });
            (paginated, total)
        };

        public func pinThread(threadId: Text, isPinned: Bool) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = thread.updatedAt;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updated);
                    true
                };
            };
        };

        public func lockThread(threadId: Text, isLocked: Bool) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = thread.updatedAt;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = thread.isPinned;
                        isLocked = isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updated);
                    true
                };
            };
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // REPLY MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════

        public func createReply(
            threadId: Text,
            author: Principal,
            authorName: Text,
            content: Text,
            quotedReplyId: ?Text
        ) : Text {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let replyId = generateId("reply", content);

            let reply: ForumReply = {
                replyId;
                threadId;
                author;
                authorName;
                content;
                createdAt = now;
                updatedAt = now;
                upvotes = 0;
                downvotes = 0;
                isEdited = false;
                isDeleted = false;
                isAcceptedAnswer = false;
                quotedReplyId;
            };

            // Add reply to thread's reply list
            let currentReplies = switch (replies.get(threadId)) {
                case null { [] };
                case (?r) { r };
            };
            let updatedReplies = Array.append(currentReplies, [reply]);
            replies.put(threadId, updatedReplies);

            // Update thread stats
            switch (threads.get(threadId)) {
                case null { };
                case (?thread) {
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = now;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount + 1;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = thread.isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = ?now;
                        lastReplyBy = ?author;
                        lastReplyByName = ?authorName;
                    };
                    threads.put(threadId, updated);

                    // Update category post count
                    switch (categories.get(thread.categoryId)) {
                        case null { };
                        case (?category) {
                            let updatedCategory: ForumCategory = {
                                categoryId = category.categoryId;
                                name = category.name;
                                description = category.description;
                                icon = category.icon;
                                slug = category.slug;
                                orderIndex = category.orderIndex;
                                threadCount = category.threadCount;
                                postCount = category.postCount + 1;
                                lastActivity = ?now;
                                lastThreadTitle = ?thread.title;
                                lastThreadId = ?threadId;
                                color = category.color;
                                isActive = category.isActive;
                                createdAt = category.createdAt;
                                updatedAt = now;
                            };
                            categories.put(thread.categoryId, updatedCategory);
                        };
                    };
                };
            };

            // Update user profile
            incrementUserReplyCount(author, authorName);

            logger.info("Forum reply created");
            replyId
        };

        public func getReplies(threadId: Text) : [ForumReply] {
            switch (replies.get(threadId)) {
                case null { [] };
                case (?r) { r };
            };
        };

        public func getRepliesPaginated(threadId: Text, limit: Nat, offset: Nat) : ([ForumReply], Nat) {
            switch (replies.get(threadId)) {
                case null { ([], 0) };
                case (?replyList) {
                    let total = replyList.size();
                    let start = Nat.min(offset, total);
                    let end = Nat.min(start + limit, total);
                    let paginated = Array.tabulate(end - start, func(i: Nat) : ForumReply {
                        replyList[start + i]
                    });
                    (paginated, total)
                };
            };
        };

        public func updateThread(
            threadId: Text,
            title: ?Text,
            content: ?Text,
            tags: ?[Text]
        ) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = switch (title) { case (?t) { t }; case null { thread.title } };
                        content = switch (content) { case (?c) { c }; case null { thread.content } };
                        tags = switch (tags) { case (?t) { t }; case null { thread.tags } };
                        createdAt = thread.createdAt;
                        updatedAt = now;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = thread.isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updated);
                    true
                };
            };
        };

        public func deleteThread(threadId: Text) : Bool {
            switch (threads.remove(threadId)) {
                case null { false };
                case (?_) { 
                    // Also remove replies
                    replies.delete(threadId);
                    true 
                };
            };
        };

        public func updateReply(
            threadId: Text,
            replyId: Text,
            content: Text
        ) : Bool {
            switch (replies.get(threadId)) {
                case null { false };
                case (?replyList) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let updatedReplies = Array.map(replyList, func(r: ForumReply) : ForumReply {
                        if (r.replyId == replyId) {
                            {
                                replyId = r.replyId;
                                threadId = r.threadId;
                                author = r.author;
                                authorName = r.authorName;
                                content = content;
                                createdAt = r.createdAt;
                                updatedAt = now;
                                upvotes = r.upvotes;
                                downvotes = r.downvotes;
                                isEdited = true;
                                isDeleted = r.isDeleted;
                                isAcceptedAnswer = r.isAcceptedAnswer;
                                quotedReplyId = r.quotedReplyId;
                            }
                        } else { r };
                    });
                    replies.put(threadId, updatedReplies);
                    true
                };
            };
        };

        public func deleteReply(threadId: Text, replyId: Text) : Bool {
            switch (replies.get(threadId)) {
                case null { false };
                case (?replyList) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let updatedReplies = Array.map(replyList, func(r: ForumReply) : ForumReply {
                        if (r.replyId == replyId) {
                            {
                                replyId = r.replyId;
                                threadId = r.threadId;
                                author = r.author;
                                authorName = r.authorName;
                                content = "[Deleted]";
                                createdAt = r.createdAt;
                                updatedAt = now;
                                upvotes = r.upvotes;
                                downvotes = r.downvotes;
                                isEdited = r.isEdited;
                                isDeleted = true;
                                isAcceptedAnswer = r.isAcceptedAnswer;
                                quotedReplyId = r.quotedReplyId;
                            }
                        } else { r };
                    });
                    replies.put(threadId, updatedReplies);
                    
                    // Update thread reply count
                    switch (threads.get(threadId)) {
                        case null { };
                        case (?thread) {
                            let updated: ForumThread = {
                                threadId = thread.threadId;
                                categoryId = thread.categoryId;
                                categoryName = thread.categoryName;
                                author = thread.author;
                                authorName = thread.authorName;
                                title = thread.title;
                                content = thread.content;
                                tags = thread.tags;
                                createdAt = thread.createdAt;
                                updatedAt = now;
                                viewCount = thread.viewCount;
                                replyCount = Nat.max(0, thread.replyCount - 1);
                                upvotes = thread.upvotes;
                                downvotes = thread.downvotes;
                                isPinned = thread.isPinned;
                                isLocked = thread.isLocked;
                                isFeatured = thread.isFeatured;
                                hasAcceptedAnswer = thread.hasAcceptedAnswer;
                                acceptedAnswerId = thread.acceptedAnswerId;
                                lastReplyAt = thread.lastReplyAt;
                                lastReplyBy = thread.lastReplyBy;
                                lastReplyByName = thread.lastReplyByName;
                            };
                            threads.put(threadId, updated);
                        };
                    };
                    true
                };
            };
        };

        public func markAcceptedAnswer(threadId: Text, replyId: Text) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    // Verify reply exists
                    let replyExists = switch (replies.get(threadId)) {
                        case null { false };
                        case (?replyList) {
                            switch (Array.find(replyList, func(r: ForumReply) : Bool { r.replyId == replyId })) {
                                case null { false };
                                case (?_) { true };
                            }
                        };
                    };
                    if (not replyExists) { return false };
                    
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Update thread
                    let updatedThread: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = now;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount;
                        upvotes = thread.upvotes;
                        downvotes = thread.downvotes;
                        isPinned = thread.isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = true;
                        acceptedAnswerId = ?replyId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updatedThread);
                    
                    // Update reply
                    switch (replies.get(threadId)) {
                        case null { };
                        case (?replyList) {
                            let updatedReplies = Array.map(replyList, func(r: ForumReply) : ForumReply {
                                if (r.replyId == replyId) {
                                    {
                                        replyId = r.replyId;
                                        threadId = r.threadId;
                                        author = r.author;
                                        authorName = r.authorName;
                                        content = r.content;
                                        createdAt = r.createdAt;
                                        updatedAt = now;
                                        upvotes = r.upvotes;
                                        downvotes = r.downvotes;
                                        isEdited = r.isEdited;
                                        isDeleted = r.isDeleted;
                                        isAcceptedAnswer = true;
                                        quotedReplyId = r.quotedReplyId;
                                    }
                                } else { r };
                            });
                            replies.put(threadId, updatedReplies);
                        };
                    };
                    true
                };
            };
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // VOTING SYSTEM
        // ═══════════════════════════════════════════════════════════════════════════

        private func getVoteKey(userId: Principal, itemId: Text) : Text {
            Principal.toText(userId) # "_" # itemId
        };

        public func voteOnThread(
            userId: Principal,
            threadId: Text,
            voteType: VoteType
        ) : Bool {
            switch (threads.get(threadId)) {
                case null { false };
                case (?thread) {
                    let voteKey = getVoteKey(userId, threadId);
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Check if user already voted
                    let existingVote = votes.get(voteKey);
                    let (upvoteDelta, downvoteDelta) = switch (existingVote) {
                        case null {
                            // New vote
                            switch (voteType) {
                                case (#Upvote) { (1, 0) };
                                case (#Downvote) { (0, 1) };
                            }
                        };
                        case (?existing) {
                            // Change or remove vote
                            if (existing.voteType == voteType) {
                                // Remove vote (user clicking same vote again)
                                votes.delete(voteKey);
                                switch (voteType) {
                                    case (#Upvote) { (-1, 0) };
                                    case (#Downvote) { (0, -1) };
                                }
                            } else {
                                // Change vote
                                switch (voteType) {
                                    case (#Upvote) { (1, -1) };
                                    case (#Downvote) { (-1, 1) };
                                }
                            }
                        };
                    };
                    
                    // Update vote record if not removed
                    if (existingVote == null or (switch (existingVote) { case (?v) { v.voteType != voteType }; case null { true } })) {
                        let vote: Vote = {
                            userId;
                            itemId = threadId;
                            voteType;
                            timestamp = now;
                        };
                        votes.put(voteKey, vote);
                    };
                    
                    // Update thread vote counts
                    let newUpvotes = if (upvoteDelta > 0) {
                        thread.upvotes + Int.abs(upvoteDelta)
                    } else if (upvoteDelta < 0) {
                        if (thread.upvotes >= Int.abs(upvoteDelta)) {
                            thread.upvotes - Int.abs(upvoteDelta)
                        } else {
                            0
                        }
                    } else {
                        thread.upvotes
                    };
                    let newDownvotes = if (downvoteDelta > 0) {
                        thread.downvotes + Int.abs(downvoteDelta)
                    } else if (downvoteDelta < 0) {
                        if (thread.downvotes >= Int.abs(downvoteDelta)) {
                            thread.downvotes - Int.abs(downvoteDelta)
                        } else {
                            0
                        }
                    } else {
                        thread.downvotes
                    };
                    let updated: ForumThread = {
                        threadId = thread.threadId;
                        categoryId = thread.categoryId;
                        categoryName = thread.categoryName;
                        author = thread.author;
                        authorName = thread.authorName;
                        title = thread.title;
                        content = thread.content;
                        tags = thread.tags;
                        createdAt = thread.createdAt;
                        updatedAt = now;
                        viewCount = thread.viewCount;
                        replyCount = thread.replyCount;
                        upvotes = newUpvotes;
                        downvotes = newDownvotes;
                        isPinned = thread.isPinned;
                        isLocked = thread.isLocked;
                        isFeatured = thread.isFeatured;
                        hasAcceptedAnswer = thread.hasAcceptedAnswer;
                        acceptedAnswerId = thread.acceptedAnswerId;
                        lastReplyAt = thread.lastReplyAt;
                        lastReplyBy = thread.lastReplyBy;
                        lastReplyByName = thread.lastReplyByName;
                    };
                    threads.put(threadId, updated);
                    true
                };
            };
        };

        public func voteOnReply(
            userId: Principal,
            threadId: Text,
            replyId: Text,
            voteType: VoteType
        ) : Bool {
            switch (replies.get(threadId)) {
                case null { false };
                case (?replyList) {
                    let voteKey = getVoteKey(userId, replyId);
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Find the reply
                    let replyIndex = Array.find(replyList, func(r: ForumReply) : Bool { r.replyId == replyId });
                    switch (replyIndex) {
                        case null { false };
                        case (?reply) {
                            // Check if user already voted
                            let existingVote = votes.get(voteKey);
                            let (upvoteDelta, downvoteDelta) = switch (existingVote) {
                                case null {
                                    switch (voteType) {
                                        case (#Upvote) { (1, 0) };
                                        case (#Downvote) { (0, 1) };
                                    }
                                };
                                case (?existing) {
                                    if (existing.voteType == voteType) {
                                        votes.delete(voteKey);
                                        switch (voteType) {
                                            case (#Upvote) { (-1, 0) };
                                            case (#Downvote) { (0, -1) };
                                        }
                                    } else {
                                        switch (voteType) {
                                            case (#Upvote) { (1, -1) };
                                            case (#Downvote) { (-1, 1) };
                                        }
                                    }
                                };
                            };
                            
                            // Update vote record if not removed
                            if (existingVote == null or (switch (existingVote) { case (?v) { v.voteType != voteType }; case null { true } })) {
                                let vote: Vote = {
                                    userId;
                                    itemId = replyId;
                                    voteType;
                                    timestamp = now;
                                };
                                votes.put(voteKey, vote);
                            };
                            
                            // Update reply vote counts
                            let updatedReplies = Array.map(replyList, func(r: ForumReply) : ForumReply {
                                if (r.replyId == replyId) {
                                    let newUpvotes = if (upvoteDelta > 0) {
                                        r.upvotes + Int.abs(upvoteDelta)
                                    } else if (upvoteDelta < 0) {
                                        if (r.upvotes >= Int.abs(upvoteDelta)) {
                                            r.upvotes - Int.abs(upvoteDelta)
                                        } else {
                                            0
                                        }
                                    } else {
                                        r.upvotes
                                    };
                                    let newDownvotes = if (downvoteDelta > 0) {
                                        r.downvotes + Int.abs(downvoteDelta)
                                    } else if (downvoteDelta < 0) {
                                        if (r.downvotes >= Int.abs(downvoteDelta)) {
                                            r.downvotes - Int.abs(downvoteDelta)
                                        } else {
                                            0
                                        }
                                    } else {
                                        r.downvotes
                                    };
                                    {
                                        replyId = r.replyId;
                                        threadId = r.threadId;
                                        author = r.author;
                                        authorName = r.authorName;
                                        content = r.content;
                                        createdAt = r.createdAt;
                                        updatedAt = now;
                                        upvotes = newUpvotes;
                                        downvotes = newDownvotes;
                                        isEdited = r.isEdited;
                                        isDeleted = r.isDeleted;
                                        isAcceptedAnswer = r.isAcceptedAnswer;
                                        quotedReplyId = r.quotedReplyId;
                                    }
                                } else { r };
                            });
                            replies.put(threadId, updatedReplies);
                            
                            // Update author's upvotes received if upvoted
                            if (upvoteDelta > 0) {
                                switch (userProfiles.get(reply.author)) {
                                    case null { };
                                    case (?profile) {
                                        let updatedProfile: UserForumProfile = {
                                            userId = profile.userId;
                                            displayName = profile.displayName;
                                            avatarUrl = profile.avatarUrl;
                                            joinedAt = profile.joinedAt;
                                            threadCount = profile.threadCount;
                                            replyCount = profile.replyCount;
                                            upvotesReceived = profile.upvotesReceived + 1;
                                            reputation = profile.reputation + 1;
                                            badges = profile.badges;
                                            isModerator = profile.isModerator;
                                            isAdmin = profile.isAdmin;
                                        };
                                        userProfiles.put(reply.author, updatedProfile);
                                    };
                                };
                            };
                            true
                        };
                    };
                };
            };
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // SEARCH FUNCTIONALITY
        // ═══════════════════════════════════════════════════════════════════════════

        public func searchForum(searchQuery: Text) : [ForumTypes.SearchResult] {
            searchForumPaginated(searchQuery, 100, 0).0 // Default: first 100 results
        };

        public func searchForumPaginated(
            searchQuery: Text,
            limit: Nat,
            offset: Nat
        ) : ([ForumTypes.SearchResult], Nat) {
            let queryLower = Text.map(searchQuery, func(c: Char) : Char {
                if (c >= 'A' and c <= 'Z') {
                    Char.fromNat32(Nat32.fromNat(Nat32.toNat(Char.toNat32(c)) + 32))
                } else { c }
            });
            
            let results = Buffer.Buffer<ForumTypes.SearchResult>(0);
            
            // Search threads
            for ((threadId, thread) in threads.entries()) {
                let titleLower = Text.map(thread.title, func(c: Char) : Char {
                    if (c >= 'A' and c <= 'Z') {
                        Char.fromNat32(Nat32.fromNat(Nat32.toNat(Char.toNat32(c)) + 32))
                    } else { c }
                });
                let contentLower = Text.map(thread.content, func(c: Char) : Char {
                    if (c >= 'A' and c <= 'Z') {
                        Char.fromNat32(Nat32.fromNat(Nat32.toNat(Char.toNat32(c)) + 32))
                    } else { c }
                });
                
                if (Text.contains(titleLower, #text queryLower) or Text.contains(contentLower, #text queryLower)) {
                    let excerpt = if (Text.size(thread.content) > 150) {
                        let chars = Iter.toArray(Text.toIter(thread.content));
                        let first150 = Array.tabulate<Char>(150, func(i) { chars[i] });
                        Text.fromIter(first150.vals()) # "..."
                    } else {
                        thread.content
                    };
                    results.add({
                        resultType = #Thread;
                        id = thread.threadId;
                        title = thread.title;
                        excerpt;
                        author = thread.author;
                        authorName = thread.authorName;
                        createdAt = thread.createdAt;
                        categoryName = ?thread.categoryName;
                    });
                };
            };
            
            // Search replies
            for ((threadId, replyList) in replies.entries()) {
                for (reply in replyList.vals()) {
                    let contentLower = Text.map(reply.content, func(c: Char) : Char {
                        if (c >= 'A' and c <= 'Z') {
                            Char.fromNat32(Nat32.fromNat(Nat32.toNat(Char.toNat32(c)) + 32))
                        } else { c }
                    });
                    
                    if (Text.contains(contentLower, #text queryLower)) {
                        let excerpt = if (Text.size(reply.content) > 150) {
                            let chars = Iter.toArray(Text.toIter(reply.content));
                            let first150 = Array.tabulate<Char>(150, func(i) { chars[i] });
                            Text.fromIter(first150.vals()) # "..."
                        } else {
                            reply.content
                        };
                        let thread = threads.get(threadId);
                        results.add({
                            resultType = #Reply;
                            id = reply.replyId;
                            title = switch (thread) {
                                case null { "Reply" };
                                case (?t) { "Re: " # t.title };
                            };
                            excerpt;
                            author = reply.author;
                            authorName = reply.authorName;
                            createdAt = reply.createdAt;
                            categoryName = switch (thread) {
                                case null { null };
                                case (?t) { ?t.categoryName };
                            };
                        });
                    };
                };
            };
            
            // Sort by creation date (newest first)
            let unsorted = Buffer.toArray(results);
            let total = unsorted.size();
            let sorted = Array.sort(unsorted, func(a: ForumTypes.SearchResult, b: ForumTypes.SearchResult) : Order.Order {
                Nat64.compare(b.createdAt, a.createdAt)
            });
            
            // Apply pagination
            let start = Nat.min(offset, total);
            let end = Nat.min(start + limit, total);
            let paginated = Array.tabulate(end - start, func(i: Nat) : ForumTypes.SearchResult {
                sorted[start + i]
            });
            (paginated, total)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // USER PROFILES
        // ═══════════════════════════════════════════════════════════════════════════

        private func incrementUserThreadCount(userId: Principal, displayName: Text) {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let profile = switch (userProfiles.get(userId)) {
                case null {
                    {
                        userId;
                        displayName;
                        avatarUrl = null;
                        joinedAt = now;
                        threadCount = 1;
                        replyCount = 0;
                        upvotesReceived = 0;
                        reputation = 0;
                        badges = [];
                        isModerator = false;
                        isAdmin = false;
                    }
                };
                case (?p) {
                    {
                        userId = p.userId;
                        displayName = p.displayName;
                        avatarUrl = p.avatarUrl;
                        joinedAt = p.joinedAt;
                        threadCount = p.threadCount + 1;
                        replyCount = p.replyCount;
                        upvotesReceived = p.upvotesReceived;
                        reputation = p.reputation;
                        badges = p.badges;
                        isModerator = p.isModerator;
                        isAdmin = p.isAdmin;
                    }
                };
            };
            userProfiles.put(userId, profile);
        };

        private func incrementUserReplyCount(userId: Principal, displayName: Text) {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let profile = switch (userProfiles.get(userId)) {
                case null {
                    {
                        userId;
                        displayName;
                        avatarUrl = null;
                        joinedAt = now;
                        threadCount = 0;
                        replyCount = 1;
                        upvotesReceived = 0;
                        reputation = 0;
                        badges = [];
                        isModerator = false;
                        isAdmin = false;
                    }
                };
                case (?p) {
                    {
                        userId = p.userId;
                        displayName = p.displayName;
                        avatarUrl = p.avatarUrl;
                        joinedAt = p.joinedAt;
                        threadCount = p.threadCount;
                        replyCount = p.replyCount + 1;
                        upvotesReceived = p.upvotesReceived;
                        reputation = p.reputation;
                        badges = p.badges;
                        isModerator = p.isModerator;
                        isAdmin = p.isAdmin;
                    }
                };
            };
            userProfiles.put(userId, profile);
        };

        public func getUserProfile(userId: Principal) : ?UserForumProfile {
            userProfiles.get(userId)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // STATISTICS
        // ═══════════════════════════════════════════════════════════════════════════

        public func getForumStats() : ForumStats {
            let totalCategories = categories.size();
            let totalThreads = threads.size();
            let totalReplies = Iter.toArray(replies.vals()).size();
            let totalUsers = userProfiles.size();

            {
                totalCategories;
                totalThreads;
                totalReplies;
                totalUsers;
                threadsToday = 0; // TODO: Calculate based on timestamp
                repliesToday = 0; // TODO: Calculate based on timestamp
            }
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // HELPER FUNCTIONS
        // ═══════════════════════════════════════════════════════════════════════════

        private func generateId(prefix: Text, seed: Text) : Text {
            let timestamp = Nat64.fromNat(Int.abs(Time.now()));
            let hash = Text.hash(seed);
            prefix # "_" # Nat.toText(Nat32.toNat(hash)) # "_" # Nat64.toText(timestamp)
        };

        // ═══════════════════════════════════════════════════════════════════════════
        // STABLE STORAGE
        // ═══════════════════════════════════════════════════════════════════════════

        public func toStable() : StableData {
            {
                categories = Iter.toArray(categories.entries());
                threads = Iter.toArray(threads.entries());
                replies = Iter.toArray(replies.entries());
                votes = Iter.toArray(votes.entries());
                userProfiles = Iter.toArray(userProfiles.entries());
            }
        };

        public func fromStable(data: StableData) {
            categories := HashMap.fromIter(data.categories.vals(), 0, Text.equal, Text.hash);
            threads := HashMap.fromIter(data.threads.vals(), 0, Text.equal, Text.hash);
            replies := HashMap.fromIter(data.replies.vals(), 0, Text.equal, Text.hash);
            votes := HashMap.fromIter(data.votes.vals(), 0, Text.equal, Text.hash);
            userProfiles := HashMap.fromIter(data.userProfiles.vals(), 0, Principal.equal, Principal.hash);
        };
    };
}

