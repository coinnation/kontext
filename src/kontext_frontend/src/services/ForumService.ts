/**
 * Platform Forum Service
 * Service wrapper for interacting with the platform-wide community forum
 */

import { Actor, ActorSubclass, Identity, HttpAgent } from '@dfinity/agent';
import { idlFactory as platformIdlFactory } from '../../candid/kontext_backend.did.js';
import type { 
  ForumCategory,
  ForumThread,
  ForumReply,
  UserForumProfile,
  ForumStats
} from '../types';

export interface PlatformCanisterForForum {
  // Category Management
  createForumCategory: (
    name: string,
    description: string,
    icon: string,
    slug: string,
    color: string,
    orderIndex: bigint
  ) => Promise<string>;
  updateForumCategory: (
    categoryId: string,
    name: [] | [string],
    description: [] | [string],
    icon: [] | [string],
    color: [] | [string],
    orderIndex: [] | [bigint],
    isActive: [] | [boolean]
  ) => Promise<boolean>;
  deleteForumCategory: (categoryId: string) => Promise<boolean>;
  getForumCategory: (categoryId: string) => Promise<[] | [any]>;
  getAllForumCategories: () => Promise<any[]>;
  getActiveForumCategories: () => Promise<any[]>;
  
  // Thread Management
  createForumThread: (
    categoryId: string,
    title: string,
    content: string,
    tags: string[]
  ) => Promise<string>;
  getForumThread: (threadId: string) => Promise<[] | [any]>;
  incrementForumThreadViews: (threadId: string) => Promise<boolean>;
  getForumThreadsByCategory: (categoryId: string) => Promise<any[]>;
  getForumThreadsByCategoryPaginated: (
    categoryId: string,
    limit: bigint,
    offset: bigint
  ) => Promise<[any[], bigint]>;
  pinForumThread: (threadId: string, isPinned: boolean) => Promise<boolean>;
  lockForumThread: (threadId: string, isLocked: boolean) => Promise<boolean>;
  
  // Reply Management
  createForumReply: (
    threadId: string,
    content: string,
    quotedReplyId: [] | [string]
  ) => Promise<string>;
  getForumReplies: (threadId: string) => Promise<any[]>;
  getForumRepliesPaginated: (
    threadId: string,
    limit: bigint,
    offset: bigint
  ) => Promise<[any[], bigint]>;
  updateForumReply: (
    threadId: string,
    replyId: string,
    content: string
  ) => Promise<boolean>;
  deleteForumReply: (
    threadId: string,
    replyId: string
  ) => Promise<boolean>;
  
  // Thread Management (Edit/Delete)
  updateForumThread: (
    threadId: string,
    title: [] | [string],
    content: [] | [string],
    tags: [] | [string[]]
  ) => Promise<boolean>;
  deleteForumThread: (threadId: string) => Promise<boolean>;
  
  // Accepted Answer
  markAcceptedAnswer: (
    threadId: string,
    replyId: string
  ) => Promise<boolean>;
  
  // Voting
  voteOnForumThread: (
    threadId: string,
    voteType: { Upvote: null } | { Downvote: null }
  ) => Promise<boolean>;
  voteOnForumReply: (
    threadId: string,
    replyId: string,
    voteType: { Upvote: null } | { Downvote: null }
  ) => Promise<boolean>;
  
  // Search
  searchForum: (query: string) => Promise<any[]>;
  searchForumPaginated: (
    query: string,
    limit: bigint,
    offset: bigint
  ) => Promise<[any[], bigint]>;
  
  // User Profiles
  getUserForumProfile: (userId: string) => Promise<[] | [any]>;
  
  // Statistics
  getForumStats: () => Promise<any>;
}

export class ForumService {
  private actor: ActorSubclass<PlatformCanisterForForum>;

  constructor(identity: Identity, agent: HttpAgent) {
    // Use the same platform canister ID as the rest of the application
    const platformCanisterId = process.env.CANISTER_ID_KONTEXT_BACKEND || 'pkmhr-fqaaa-aaaaa-qcfeq-cai';
    
    console.log('🔧 [ForumService] Creating actor with canister ID:', platformCanisterId);
    
    this.actor = Actor.createActor<PlatformCanisterForForum>(platformIdlFactory, {
      agent,
      canisterId: platformCanisterId,
    });
    
    console.log('✅ [ForumService] Actor created successfully');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY MANAGEMENT (Admin Only)
  // ═══════════════════════════════════════════════════════════════════════════

  async createCategory(
    name: string,
    description: string,
    icon: string,
    slug: string,
    color: string,
    orderIndex: number
  ): Promise<string> {
    try {
      const categoryId = await this.actor.createForumCategory(
        name,
        description,
        icon,
        slug,
        color,
        BigInt(orderIndex)
      );
      return categoryId;
    } catch (error) {
      console.error('Failed to create forum category:', error);
      throw error;
    }
  }

  async updateCategory(
    categoryId: string,
    updates: {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      orderIndex?: number;
      isActive?: boolean;
    }
  ): Promise<boolean> {
    try {
      const success = await this.actor.updateForumCategory(
        categoryId,
        updates.name ? [updates.name] : [],
        updates.description ? [updates.description] : [],
        updates.icon ? [updates.icon] : [],
        updates.color ? [updates.color] : [],
        updates.orderIndex !== undefined ? [BigInt(updates.orderIndex)] : [],
        updates.isActive !== undefined ? [updates.isActive] : []
      );
      return success;
    } catch (error) {
      console.error('Failed to update forum category:', error);
      throw error;
    }
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    try {
      const success = await this.actor.deleteForumCategory(categoryId);
      return success;
    } catch (error) {
      console.error('Failed to delete forum category:', error);
      throw error;
    }
  }

  async getCategory(categoryId: string): Promise<ForumCategory | null> {
    try {
      const result = await this.actor.getForumCategory(categoryId);
      if (result.length === 0) return null;
      return this.convertCategory(result[0]);
    } catch (error) {
      console.error('Failed to get forum category:', error);
      throw error;
    }
  }

  async getAllCategories(): Promise<ForumCategory[]> {
    try {
      const categories = await this.actor.getAllForumCategories();
      return categories.map(c => this.convertCategory(c));
    } catch (error) {
      console.error('Failed to get all forum categories:', error);
      throw error;
    }
  }

  async getActiveCategories(): Promise<ForumCategory[]> {
    try {
      console.log('📡 [ForumService] Calling getActiveForumCategories...');
      const categories = await this.actor.getActiveForumCategories();
      console.log('✅ [ForumService] Received categories:', categories);
      console.log('📊 [ForumService] Category count:', categories.length);
      const converted = categories.map(c => this.convertCategory(c));
      console.log('🔄 [ForumService] Converted categories:', converted);
      return converted;
    } catch (error) {
      console.error('❌ [ForumService] Failed to get active forum categories:', error);
      console.error('❌ [ForumService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        error
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THREAD MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createThread(
    categoryId: string,
    title: string,
    content: string,
    tags: string[]
  ): Promise<string> {
    try {
      const threadId = await this.actor.createForumThread(categoryId, title, content, tags);
      return threadId;
    } catch (error) {
      console.error('Failed to create forum thread:', error);
      throw error;
    }
  }

  async getThread(threadId: string): Promise<ForumThread | null> {
    try {
      const result = await this.actor.getForumThread(threadId);
      if (result.length === 0) return null;
      return this.convertThread(result[0]);
    } catch (error) {
      console.error('Failed to get forum thread:', error);
      throw error;
    }
  }

  async incrementThreadViews(threadId: string): Promise<boolean> {
    try {
      const success = await this.actor.incrementForumThreadViews(threadId);
      return success;
    } catch (error) {
      console.error('Failed to increment thread views:', error);
      return false;
    }
  }

  async getThreadsByCategory(categoryId: string): Promise<ForumThread[]> {
    try {
      const threads = await this.actor.getForumThreadsByCategory(categoryId);
      return threads.map(t => this.convertThread(t));
    } catch (error) {
      console.error('Failed to get forum threads:', error);
      throw error;
    }
  }

  async getThreadsByCategoryPaginated(
    categoryId: string,
    limit: number,
    offset: number
  ): Promise<{ threads: ForumThread[]; total: number }> {
    try {
      const [threadsArray, total] = await this.actor.getForumThreadsByCategoryPaginated(
        categoryId,
        BigInt(limit),
        BigInt(offset)
      );
      return {
        threads: threadsArray.map(t => this.convertThread(t)),
        total: Number(total)
      };
    } catch (error) {
      console.error('Failed to get paginated forum threads:', error);
      throw error;
    }
  }

  async pinThread(threadId: string, isPinned: boolean): Promise<boolean> {
    try {
      const success = await this.actor.pinForumThread(threadId, isPinned);
      return success;
    } catch (error) {
      console.error('Failed to pin forum thread:', error);
      throw error;
    }
  }

  async lockThread(threadId: string, isLocked: boolean): Promise<boolean> {
    try {
      const success = await this.actor.lockForumThread(threadId, isLocked);
      return success;
    } catch (error) {
      console.error('Failed to lock forum thread:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createReply(
    threadId: string,
    content: string,
    quotedReplyId?: string
  ): Promise<string> {
    try {
      const replyId = await this.actor.createForumReply(
        threadId,
        content,
        quotedReplyId ? [quotedReplyId] : []
      );
      return replyId;
    } catch (error) {
      console.error('Failed to create forum reply:', error);
      throw error;
    }
  }

  async getReplies(threadId: string): Promise<ForumReply[]> {
    try {
      const replies = await this.actor.getForumReplies(threadId);
      return replies.map(r => this.convertReply(r));
    } catch (error) {
      console.error('Failed to get forum replies:', error);
      throw error;
    }
  }

  async getRepliesPaginated(
    threadId: string,
    limit: number,
    offset: number
  ): Promise<{ replies: ForumReply[]; total: number }> {
    try {
      const [repliesArray, total] = await this.actor.getForumRepliesPaginated(
        threadId,
        BigInt(limit),
        BigInt(offset)
      );
      return {
        replies: repliesArray.map(r => this.convertReply(r)),
        total: Number(total)
      };
    } catch (error) {
      console.error('Failed to get paginated forum replies:', error);
      throw error;
    }
  }

  async updateReply(
    threadId: string,
    replyId: string,
    content: string
  ): Promise<boolean> {
    try {
      const success = await this.actor.updateForumReply(threadId, replyId, content);
      return success;
    } catch (error) {
      console.error('Failed to update forum reply:', error);
      throw error;
    }
  }

  async deleteReply(
    threadId: string,
    replyId: string
  ): Promise<boolean> {
    try {
      const success = await this.actor.deleteForumReply(threadId, replyId);
      return success;
    } catch (error) {
      console.error('Failed to delete forum reply:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THREAD MANAGEMENT (Edit/Delete)
  // ═══════════════════════════════════════════════════════════════════════════

  async updateThread(
    threadId: string,
    updates: {
      title?: string;
      content?: string;
      tags?: string[];
    }
  ): Promise<boolean> {
    try {
      const success = await this.actor.updateForumThread(
        threadId,
        updates.title ? [updates.title] : [],
        updates.content ? [updates.content] : [],
        updates.tags ? [updates.tags] : []
      );
      return success;
    } catch (error) {
      console.error('Failed to update forum thread:', error);
      throw error;
    }
  }

  async deleteThread(threadId: string): Promise<boolean> {
    try {
      const success = await this.actor.deleteForumThread(threadId);
      return success;
    } catch (error) {
      console.error('Failed to delete forum thread:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCEPTED ANSWER
  // ═══════════════════════════════════════════════════════════════════════════

  async markAcceptedAnswer(
    threadId: string,
    replyId: string
  ): Promise<boolean> {
    try {
      const success = await this.actor.markAcceptedAnswer(threadId, replyId);
      return success;
    } catch (error) {
      console.error('Failed to mark accepted answer:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOTING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  async voteOnThread(
    threadId: string,
    voteType: 'upvote' | 'downvote'
  ): Promise<boolean> {
    try {
      const variant = voteType === 'upvote' ? { Upvote: null } : { Downvote: null };
      const success = await this.actor.voteOnForumThread(threadId, variant);
      return success;
    } catch (error) {
      console.error('Failed to vote on thread:', error);
      throw error;
    }
  }

  async voteOnReply(
    threadId: string,
    replyId: string,
    voteType: 'upvote' | 'downvote'
  ): Promise<boolean> {
    try {
      const variant = voteType === 'upvote' ? { Upvote: null } : { Downvote: null };
      const success = await this.actor.voteOnForumReply(threadId, replyId, variant);
      return success;
    } catch (error) {
      console.error('Failed to vote on reply:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  async searchForum(query: string): Promise<any[]> {
    try {
      const results = await this.actor.searchForum(query);
      return results;
    } catch (error) {
      console.error('Failed to search forum:', error);
      throw error;
    }
  }

  async searchForumPaginated(
    query: string,
    limit: number,
    offset: number
  ): Promise<{ results: any[]; total: number }> {
    try {
      const [resultsArray, total] = await this.actor.searchForumPaginated(
        query,
        BigInt(limit),
        BigInt(offset)
      );
      return {
        results: resultsArray,
        total: Number(total)
      };
    } catch (error) {
      console.error('Failed to search forum with pagination:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILES
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserProfile(userId: string): Promise<UserForumProfile | null> {
    try {
      const result = await this.actor.getUserForumProfile(userId);
      if (result.length === 0) return null;
      return this.convertUserProfile(result[0]);
    } catch (error) {
      console.error('Failed to get user forum profile:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  async getForumStats(): Promise<ForumStats> {
    try {
      const stats = await this.actor.getForumStats();
      return {
        totalCategories: Number(stats.totalCategories),
        totalThreads: Number(stats.totalThreads),
        totalReplies: Number(stats.totalReplies),
        totalUsers: Number(stats.totalUsers),
        threadsToday: Number(stats.threadsToday),
        repliesToday: Number(stats.repliesToday),
      };
    } catch (error) {
      console.error('Failed to get forum stats:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS - Type Conversion
  // ═══════════════════════════════════════════════════════════════════════════

  private convertCategory(raw: any): ForumCategory {
    return {
      categoryId: raw.categoryId,
      name: raw.name,
      description: raw.description,
      icon: raw.icon,
      slug: raw.slug,
      orderIndex: Number(raw.orderIndex),
      threadCount: Number(raw.threadCount),
      postCount: Number(raw.postCount),
      lastActivity: raw.lastActivity.length > 0 ? raw.lastActivity[0] : null,
      lastThreadTitle: raw.lastThreadTitle.length > 0 ? raw.lastThreadTitle[0] : null,
      lastThreadId: raw.lastThreadId.length > 0 ? raw.lastThreadId[0] : null,
      color: raw.color,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private convertThread(raw: any): ForumThread {
    return {
      threadId: raw.threadId,
      categoryId: raw.categoryId,
      categoryName: raw.categoryName,
      author: raw.author.toText(),
      authorName: raw.authorName,
      title: raw.title,
      content: raw.content,
      tags: raw.tags,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      viewCount: Number(raw.viewCount),
      replyCount: Number(raw.replyCount),
      upvotes: Number(raw.upvotes),
      downvotes: Number(raw.downvotes),
      isPinned: raw.isPinned,
      isLocked: raw.isLocked,
      isFeatured: raw.isFeatured,
      hasAcceptedAnswer: raw.hasAcceptedAnswer,
      acceptedAnswerId: raw.acceptedAnswerId.length > 0 ? raw.acceptedAnswerId[0] : null,
      lastReplyAt: raw.lastReplyAt.length > 0 ? raw.lastReplyAt[0] : null,
      lastReplyBy: raw.lastReplyBy.length > 0 ? raw.lastReplyBy[0].toText() : null,
      lastReplyByName: raw.lastReplyByName.length > 0 ? raw.lastReplyByName[0] : null,
    };
  }

  private convertReply(raw: any): ForumReply {
    return {
      replyId: raw.replyId,
      threadId: raw.threadId,
      author: raw.author.toText(),
      authorName: raw.authorName,
      content: raw.content,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      upvotes: Number(raw.upvotes),
      downvotes: Number(raw.downvotes),
      isEdited: raw.isEdited,
      isDeleted: raw.isDeleted,
      isAcceptedAnswer: raw.isAcceptedAnswer,
      quotedReplyId: raw.quotedReplyId.length > 0 ? raw.quotedReplyId[0] : null,
    };
  }

  private convertUserProfile(raw: any): UserForumProfile {
    return {
      userId: raw.userId.toText(),
      displayName: raw.displayName,
      avatarUrl: raw.avatarUrl.length > 0 ? raw.avatarUrl[0] : null,
      joinedAt: raw.joinedAt,
      threadCount: Number(raw.threadCount),
      replyCount: Number(raw.replyCount),
      upvotesReceived: Number(raw.upvotesReceived),
      reputation: Number(raw.reputation),
      badges: raw.badges,
      isModerator: raw.isModerator,
      isAdmin: raw.isAdmin,
    };
  }
}

// Factory function to create a forum service instance
export const createForumService = (identity: Identity, agent: HttpAgent): ForumService => {
  return new ForumService(identity, agent);
};


