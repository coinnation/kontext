/**
 * Platform-Wide Community Forum Types
 * Public discussion forum for the entire Kontext platform
 */

import Principal "mo:base/Principal";

module ForumTypes {
    // Forum category (admin-created)
    public type ForumCategory = {
        categoryId: Text;
        name: Text;
        description: Text;
        icon: Text; // Emoji or icon identifier
        slug: Text; // URL-friendly name
        orderIndex: Nat;
        threadCount: Nat;
        postCount: Nat;
        lastActivity: ?Nat64;
        lastThreadTitle: ?Text;
        lastThreadId: ?Text;
        color: Text; // Hex color for UI theming
        isActive: Bool;
        createdAt: Nat64;
        updatedAt: Nat64;
    };

    // Discussion thread in a category
    public type ForumThread = {
        threadId: Text;
        categoryId: Text;
        categoryName: Text;
        author: Principal;
        authorName: Text;
        title: Text;
        content: Text;
        tags: [Text];
        createdAt: Nat64;
        updatedAt: Nat64;
        viewCount: Nat;
        replyCount: Nat;
        upvotes: Nat;
        downvotes: Nat;
        isPinned: Bool;
        isLocked: Bool;
        isFeatured: Bool; // Featured on homepage
        hasAcceptedAnswer: Bool;
        acceptedAnswerId: ?Text;
        lastReplyAt: ?Nat64;
        lastReplyBy: ?Principal;
        lastReplyByName: ?Text;
    };

    // Reply to a thread
    public type ForumReply = {
        replyId: Text;
        threadId: Text;
        author: Principal;
        authorName: Text;
        content: Text;
        createdAt: Nat64;
        updatedAt: Nat64;
        upvotes: Nat;
        downvotes: Nat;
        isEdited: Bool;
        isDeleted: Bool;
        isAcceptedAnswer: Bool;
        quotedReplyId: ?Text; // For quoting other replies
    };

    // User vote on thread or reply
    public type Vote = {
        userId: Principal;
        itemId: Text; // threadId or replyId
        voteType: VoteType;
        timestamp: Nat64;
    };

    public type VoteType = {
        #Upvote;
        #Downvote;
    };

    // Thread status for filtering
    public type ThreadStatus = {
        #Open;
        #Solved;
        #Locked;
        #Archived;
    };

    // Sort options
    public type SortOption = {
        #Latest;
        #Popular;
        #MostReplies;
        #Trending;
    };

    // Forum statistics
    public type ForumStats = {
        totalCategories: Nat;
        totalThreads: Nat;
        totalReplies: Nat;
        totalUsers: Nat;
        threadsToday: Nat;
        repliesToday: Nat;
    };

    // User forum profile
    public type UserForumProfile = {
        userId: Principal;
        displayName: Text;
        avatarUrl: ?Text;
        joinedAt: Nat64;
        threadCount: Nat;
        replyCount: Nat;
        upvotesReceived: Nat;
        reputation: Int; // Calculated based on activity
        badges: [Text];
        isModerator: Bool;
        isAdmin: Bool;
    };

    // Search result
    public type SearchResult = {
        resultType: SearchResultType;
        id: Text;
        title: Text;
        excerpt: Text;
        author: Principal;
        authorName: Text;
        createdAt: Nat64;
        categoryName: ?Text;
    };

    public type SearchResultType = {
        #Thread;
        #Reply;
    };
}

