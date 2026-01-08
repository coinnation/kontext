/**
 * Marketplace Item Creator
 * 
 * User interface for creating marketplace listings from their own projects
 */

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Save, DollarSign, Image as ImageIcon, Loader2 } from 'lucide-react';
import { platformCanisterService } from '../services/PlatformCanisterService';
import { userCanisterService } from '../services/UserCanisterService';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import type { Project } from '../types';

interface MarketplaceForm {
  projectId: string;
  userCanisterId: string;
  exportId: string;
  title: string;
  description: string;
  price: number; // in USD cents
  stripeAccountId: string;
  previewImages: string[];
  demoUrl: string;
  category: string;
  tags: string[];
  version: string;
}

interface MarketplaceItemCreatorProps {
  userCanisterId: string;
  identity: Identity;
  principal: Principal;
  preSelectedProjectId?: string; // Optional: pre-select a project
}

export const MarketplaceItemCreator: React.FC<MarketplaceItemCreatorProps> = ({
  userCanisterId,
  identity,
  principal,
  preSelectedProjectId
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Data loading state
  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<Array<{ id: string; versionString: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [form, setForm] = useState<MarketplaceForm>({
    projectId: '',
    userCanisterId: userCanisterId || '',
    exportId: '',
    title: '',
    description: '',
    price: 1000, // $10.00 default
    stripeAccountId: '',
    previewImages: [],
    demoUrl: '',
    category: '',
    tags: [],
    version: ''
  });

  // Input helpers
  const [tagInput, setTagInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Load user projects on mount
  useEffect(() => {
    if (userCanisterId && identity) {
      loadProjects();
    }
  }, [userCanisterId, identity]);

  // Pre-select project if provided
  useEffect(() => {
    if (preSelectedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === preSelectedProjectId);
      if (project && form.projectId !== preSelectedProjectId) {
        setForm(prev => ({ ...prev, projectId: preSelectedProjectId }));
      }
    }
  }, [preSelectedProjectId, projects, form.projectId]);

  // Load versions when project is selected
  useEffect(() => {
    if (form.projectId && userCanisterId && identity) {
      loadVersions(form.projectId);
    } else {
      setVersions([]);
      setForm(prev => ({ ...prev, version: '', exportId: '' }));
    }
  }, [form.projectId, userCanisterId, identity]);

  // Auto-populate title and description from selected project
  useEffect(() => {
    if (form.projectId && projects.length > 0) {
      const selectedProject = projects.find(p => p.id === form.projectId);
      if (selectedProject) {
        setForm(prev => ({
          ...prev,
          title: prev.title || selectedProject.name || '',
          description: prev.description || selectedProject.description || ''
        }));
      }
    }
  }, [form.projectId, projects]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const result = await userCanisterService.loadUserProjects(userCanisterId, identity);
      
      if (result.success && result.projects) {
        setProjects(result.projects);
        console.log(`✅ [MarketplaceItemCreator] Loaded ${result.projects.length} projects`);
      } else {
        setError('Failed to load projects');
        setProjects([]);
      }
    } catch (err) {
      console.error('❌ [MarketplaceItemCreator] Error loading projects:', err);
      setError('Failed to load projects: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadVersions = async (projectId: string) => {
    try {
      setLoadingVersions(true);
      const result = await userCanisterService.getProjectVersions(projectId);
      
      if ('ok' in result && result.ok) {
        const versionList = result.ok.map((v: any) => {
          const semVer = v.semanticVersion;
          const versionString = `${semVer.major}.${semVer.minor}.${semVer.patch}`;
          return {
            id: v.id,
            versionString
          };
        });
        
        // Sort by version (newest first)
        versionList.sort((a, b) => {
          const aParts = a.versionString.split('.').map(Number);
          const bParts = b.versionString.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if (bParts[i] !== aParts[i]) return bParts[i] - aParts[i];
          }
          return 0;
        });
        
        setVersions(versionList);
        
        // Auto-select latest version
        if (versionList.length > 0 && !form.version) {
          setForm(prev => ({
            ...prev,
            version: versionList[0].versionString,
            exportId: versionList[0].id // Use version ID as export ID
          }));
        }
        
        console.log(`✅ [MarketplaceItemCreator] Loaded ${versionList.length} versions for project ${projectId}`);
      } else {
        setVersions([]);
        setForm(prev => ({ ...prev, version: '', exportId: '' }));
      }
    } catch (err) {
      console.error('❌ [MarketplaceItemCreator] Error loading versions:', err);
      setVersions([]);
      setForm(prev => ({ ...prev, version: '', exportId: '' }));
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCreateListing = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validation
      if (!form.projectId || !form.userCanisterId || !form.version || !form.title || !form.description) {
        setError('Please fill in all required fields');
        return;
      }

      console.log('🛒 [MarketplaceItemCreator] Creating marketplace listing with platformCanisterService...');

      // Convert userCanisterId string to Principal
      let userCanisterPrincipal: Principal;
      try {
        userCanisterPrincipal = Principal.fromText(form.userCanisterId);
      } catch (e) {
        setError('Invalid user canister ID format');
        return;
      }

      // Use version ID as export ID if not provided
      const exportId = form.exportId || form.projectId + '_' + form.version;

      // Convert demoUrl to optional format for backend
      const demoUrlOpt: [] | [string] = form.demoUrl ? [form.demoUrl] : [];

      const result = await platformCanisterService.registerMarketplaceListing(
        form.projectId,
        userCanisterPrincipal,
        exportId,
        form.title,
        form.description,
        BigInt(form.price),
        form.stripeAccountId,
        form.previewImages,
        demoUrlOpt,
        form.category,
        form.tags,
        form.version
      );

      if ('ok' in result) {
        setSuccess(`✅ Listing created successfully! ID: ${result.ok.listingId}`);
        // Reset form (but keep project selection)
        setForm(prev => ({
          ...prev,
          title: '',
          description: '',
          price: 1000,
          stripeAccountId: '',
          previewImages: [],
          demoUrl: '',
          category: '',
          tags: [],
          version: '',
          exportId: ''
        }));
        setTagInput('');
        setImageUrlInput('');
      } else {
        setError(`Failed to create listing: ${'err' in result ? result.err : 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const handleAddImage = () => {
    if (imageUrlInput.trim() && !form.previewImages.includes(imageUrlInput.trim())) {
      setForm({ ...form, previewImages: [...form.previewImages, imageUrlInput.trim()] });
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (url: string) => {
    setForm({ ...form, previewImages: form.previewImages.filter(img => img !== url) });
  };

  const handleVersionChange = (versionString: string) => {
    const selectedVersion = versions.find(v => v.versionString === versionString);
    setForm(prev => ({
      ...prev,
      version: versionString,
      exportId: selectedVersion?.id || prev.exportId
    }));
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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div style={{
      background: 'rgb(17, 17, 17)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '900px',
      margin: '0 auto',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <ShoppingCart size={28} color="#f97316" />
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            Create Marketplace Listing
          </h2>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
          List your projects on the marketplace
        </p>
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

      {/* Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Select Project *</label>
          {loadingProjects ? (
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading projects...
            </div>
          ) : (
            <select
            value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value, version: '', exportId: '' })}
              style={selectStyle}
              disabled={loadingProjects || projects.length === 0}
            >
              <option value="">-- Select a project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || project.id}
                </option>
              ))}
            </select>
          )}
          {!loadingProjects && projects.length === 0 && (
            <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', marginTop: '-0.75rem' }}>
              No projects found. Create a project first.
            </p>
          )}
        </div>

        <div>
          <label style={labelStyle}>User Canister ID</label>
          <input
            type="text"
            value={form.userCanisterId}
            readOnly
            style={{ ...inputStyle, background: 'rgba(55, 65, 81, 0.3)', cursor: 'not-allowed', opacity: 0.7 }}
            title="Auto-filled from your account"
          />
        </div>
      </div>

      {form.projectId && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
            <label style={labelStyle}>Select Version *</label>
            {loadingVersions ? (
              <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Loading versions...
              </div>
            ) : (
              <select
                value={form.version}
                onChange={(e) => handleVersionChange(e.target.value)}
                style={selectStyle}
                disabled={loadingVersions || versions.length === 0}
              >
                <option value="">-- Select a version --</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.versionString}>
                    {version.versionString}
                  </option>
                ))}
              </select>
            )}
            {!loadingVersions && versions.length === 0 && form.projectId && (
              <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', marginTop: '-0.75rem' }}>
                No versions found. Create a version first.
              </p>
            )}
        </div>

        <div>
            <label style={labelStyle}>Export ID</label>
          <input
            type="text"
              value={form.exportId}
              readOnly
              style={{ ...inputStyle, background: 'rgba(55, 65, 81, 0.3)', cursor: 'not-allowed', opacity: 0.7 }}
              title="Auto-filled from selected version"
          />
        </div>
      </div>
      )}

      <label style={labelStyle}>Listing Title *</label>
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g., Modern E-commerce Template"
        style={inputStyle}
      />

      <label style={labelStyle}>Description *</label>
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Detailed description of what's included..."
        rows={4}
        style={{...inputStyle, resize: 'vertical'}}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Price (USD cents)</label>
          <div style={{ position: 'relative' }}>
            <DollarSign size={18} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }} />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              placeholder="1000 = $10.00"
              style={{...inputStyle, paddingLeft: '2.5rem'}}
              min="0"
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="e.g., Web Development"
            style={inputStyle}
          />
        </div>
      </div>

      <label style={labelStyle}>Demo URL (optional)</label>
      <input
        type="text"
        value={form.demoUrl}
        onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
        placeholder="https://demo.example.com"
        style={inputStyle}
      />

      <label style={labelStyle}>Stripe Account ID (seller's Stripe Connect account)</label>
      <input
        type="text"
        value={form.stripeAccountId}
        onChange={(e) => setForm({ ...form, stripeAccountId: e.target.value })}
        placeholder="acct_xxxxxxxxxxxxx"
        style={inputStyle}
      />

      {/* Tags Section */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem'
      }}>
        <label style={{...labelStyle, marginBottom: '0.75rem'}}>Tags</label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            placeholder="Add a tag (press Enter)"
            style={{...inputStyle, marginBottom: 0, flex: 1}}
          />
          <button
            onClick={handleAddTag}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Plus size={18} />
          </button>
        </div>
        {form.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {form.tags.map((tag, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: '#ffffff'
                }}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images Section */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem'
      }}>
        <label style={{...labelStyle, marginBottom: '0.75rem'}}>Preview Images</label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())}
            placeholder="Image URL (press Enter)"
            style={{...inputStyle, marginBottom: 0, flex: 1}}
          />
          <button
            onClick={handleAddImage}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Plus size={18} />
          </button>
        </div>
        {form.previewImages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {form.previewImages.map((url, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#ffffff',
                  wordBreak: 'break-all'
                }}
              >
                <ImageIcon size={16} style={{ marginBottom: '0.25rem' }} />
                <div style={{ marginBottom: '0.5rem' }}>{url.substring(0, 30)}...</div>
                <button
                  onClick={() => handleRemoveImage(url)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    width: '100%'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleCreateListing}
        disabled={loading || !form.projectId || !form.version || !form.title || !form.description}
        style={{
          width: '100%',
          padding: '1rem',
          borderRadius: '8px',
          background: loading || !form.projectId || !form.version || !form.title || !form.description
            ? 'rgba(255, 107, 53, 0.3)' 
            : 'linear-gradient(135deg, #f97316, #fbbf24)',
          color: '#ffffff',
          border: 'none',
          cursor: loading || !form.projectId || !form.version || !form.title || !form.description ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: '1rem',
          opacity: loading || !form.projectId || !form.version || !form.title || !form.description ? 0.6 : 1
        }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              border: '2px solid rgba(255,255,255,0.3)', 
              borderTopColor: '#fff', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}></div>
            Creating Listing...
          </span>
        ) : (
          <>
            <Save size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Create Marketplace Listing
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
