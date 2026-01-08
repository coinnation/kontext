/**
 * Forum Category Manager (Admin Only)
 * Manage forum categories for the platform community forum
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { createForumService } from '../services/ForumService';
import { useAppStore } from '../store/appStore';
import type { ForumCategory } from '../types';

interface CategoryForm {
  name: string;
  description: string;
  icon: string;
  slug: string;
  color: string;
  orderIndex: number;
}

export const ForumCategoryManager: React.FC = () => {
  const { identity } = useAppStore();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);

  const [form, setForm] = useState<CategoryForm>({
    name: '',
    description: '',
    icon: '💬',
    slug: '',
    color: '#3b82f6',
    orderIndex: 0
  });

  useEffect(() => {
    if (identity) {
      loadCategories();
    }
  }, [identity]);

  const loadCategories = async () => {
    if (!identity) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ 
        identity,
        host: 'https://icp0.io'
      });
      
      const forumService = createForumService(identity, agent);
      const cats = await forumService.getAllCategories();
      setCategories(cats.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (error) {
      console.error('Failed to load categories:', error);
      setError(error instanceof Error ? error.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!identity) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      const forumService = createForumService(identity, agent);

      if (editingCategory) {
        // Update existing category
        const success = await forumService.updateCategory(editingCategory.categoryId, {
          name: form.name,
          description: form.description,
          icon: form.icon,
          color: form.color,
          orderIndex: form.orderIndex
        });
        
        if (success) {
          setSuccess('✅ Category updated successfully!');
          setEditingCategory(null);
          setShowCreateDialog(false);
          setForm({ name: '', description: '', icon: '💬', slug: '', color: '#3b82f6', orderIndex: 0 });
          loadCategories();
        } else {
          setError('Failed to update category');
        }
      } else {
        // Create new category
        const categoryId = await forumService.createCategory(
          form.name,
          form.description,
          form.icon,
          form.slug,
          form.color,
          form.orderIndex
        );
        
        setSuccess(`✅ Category created successfully! ID: ${categoryId}`);
        setShowCreateDialog(false);
        setForm({ name: '', description: '', icon: '💬', slug: '', color: '#3b82f6', orderIndex: 0 });
        loadCategories();
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      setError(error instanceof Error ? error.message : 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: ForumCategory) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description,
      icon: category.icon,
      slug: category.slug,
      color: category.color,
      orderIndex: category.orderIndex
    });
    setShowCreateDialog(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!identity) return;
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      setLoading(true);
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      
      const forumService = createForumService(identity, agent);
      const success = await forumService.deleteCategory(categoryId);
      
      if (success) {
        setSuccess('✅ Category deleted successfully!');
        loadCategories();
      } else {
        setError('Failed to delete category');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (category: ForumCategory) => {
    if (!identity) return;

    try {
      const { HttpAgent } = await import('@dfinity/agent');
      const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
      
      const forumService = createForumService(identity, agent);
      const success = await forumService.updateCategory(category.categoryId, {
        isActive: !category.isActive,
      });
      
      if (success) {
        loadCategories();
      }
    } catch (error) {
      console.error('Failed to toggle category:', error);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(75, 85, 99, 0.5)',
    background: 'rgba(55, 65, 81, 0.5)',
    color: '#ffffff',
    fontSize: '0.9rem',
    marginBottom: '1rem'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '0.5rem'
  };

  return (
    <div style={{
      background: 'rgb(17, 17, 17)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '1000px',
      margin: '0 auto',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <MessageSquare size={28} color="#f97316" />
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Forum Category Manager
            </h2>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
            Manage platform community forum categories
          </p>
        </div>

        {!showCreateDialog && (
          <button
            onClick={() => {
              setEditingCategory(null);
              setForm({ name: '', description: '', icon: '💬', slug: '', color: '#3b82f6', orderIndex: categories.length });
              setShowCreateDialog(true);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Plus size={18} />
            New Category
          </button>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#ef4444',
          fontSize: '0.9rem'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          fontSize: '0.9rem'
        }}>
          {success}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateDialog && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
            {editingCategory ? 'Edit Category' : 'Create New Category'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Category Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., General Discussion"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Slug (URL-friendly)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="general-discussion"
                style={inputStyle}
                disabled={!!editingCategory}
              />
            </div>
          </div>

          <label style={labelStyle}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of this category"
            rows={3}
            style={{...inputStyle, resize: 'vertical'}}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Icon (emoji)</label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="💬"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Color (hex)</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="#3b82f6"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Order Index</label>
              <input
                type="number"
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
                min="0"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                background: loading 
                  ? 'rgba(255, 107, 53, 0.3)' 
                  : 'linear-gradient(135deg, #f97316, #fbbf24)',
                color: '#ffffff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
            </button>

            <button
              onClick={() => {
                setShowCreateDialog(false);
                setEditingCategory(null);
                setForm({ name: '', description: '', icon: '💬', slug: '', color: '#3b82f6', orderIndex: 0 });
              }}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {loading && categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <div>Loading categories...</div>
        </div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div>No categories yet. Create your first one!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {categories.map((category) => (
            <div
              key={category.categoryId}
              style={{
                background: category.isActive 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : 'rgba(75, 85, 99, 0.1)',
                border: category.isActive 
                  ? '1px solid rgba(16, 185, 129, 0.3)' 
                  : '1px solid rgba(75, 85, 99, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                  <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>{category.name}</h3>
                  {!category.isActive && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      Inactive
                    </span>
                  )}
                </div>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  {category.description}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  <span>🔢 Order: {category.orderIndex}</span>
                  <span>📝 Threads: {category.threadCount}</span>
                  <span>💬 Posts: {category.postCount}</span>
                  <span style={{ color: category.color }}>● {category.color}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => handleToggleActive(category)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#8b5cf6',
                    cursor: 'pointer'
                  }}
                  title={category.isActive ? 'Deactivate' : 'Activate'}
                >
                  {category.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <button
                  onClick={() => handleEdit(category)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#3b82f6',
                    cursor: 'pointer'
                  }}
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>

                <button
                  onClick={() => handleDeleteCategory(category.categoryId)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
