/**
 * User Profile Page - Kontext Business Card
 * 
 * A stunning, public-facing profile page for Kontext users
 * to showcase their work, skills, and connect with others
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ExternalLink, 
  MapPin, 
  Calendar, 
  Eye, 
  Share2, 
  Mail,
  Globe,
  Briefcase,
  Award,
  GitBranch,
  Package,
  Lock,
  X
} from 'lucide-react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as userIdlFactory } from '../../candid/user.did.js';
import { idlFactory as platformIdlFactory } from '../../candid/kontext_backend.did.js';
import type { PublicProfile, PublicProfileStats, Project } from '../types';

interface UserProfilePageProps {
  onClose?: () => void;
}

// Social icon mapping
const SocialIcon: Record<string, string> = {
  twitter: '𝕏',
  github: '🐙',
  linkedin: '💼',
  discord: '💬',
  telegram: '✈️',
  medium: 'Ⓜ️',
  youtube: '▶️'
};

// Styles must be defined before the component
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#ffffff',
    position: 'relative'
  },
  
  banner: {
    height: '300px',
    position: 'relative',
    width: '100%'
  },
  
  bannerOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 0%, rgba(10, 10, 10, 0.8) 100%)'
  },

  closeButton: {
    position: 'absolute',
    top: '1.5rem',
    right: '1.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(239, 68, 68, 0.9)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: 10,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },

  shareButton: {
    position: 'absolute',
    top: '1.5rem',
    right: '1.5rem',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 20px rgba(255, 107, 53, 0.4)',
    transition: 'all 0.3s ease'
  },

  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem 4rem',
    position: 'relative',
    marginTop: '-150px'
  },

  profileHeader: {
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
    border: '1px solid rgba(255, 107, 53, 0.2)',
    borderRadius: '24px',
    padding: '3rem',
    marginBottom: '3rem',
    position: 'relative',
    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)'
  },

  avatarContainer: {
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'center'
  },

  avatar: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    border: '6px solid rgba(255, 107, 53, 0.3)',
    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
    objectFit: 'cover'
  },

  avatarPlaceholder: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem',
    fontWeight: 700,
    color: '#ffffff',
    border: '6px solid rgba(255, 107, 53, 0.3)',
    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)'
  },

  profileInfo: {
    textAlign: 'center'
  },

  displayName: {
    fontSize: '3rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem'
  },

  tagline: {
    fontSize: '1.25rem',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '1.5rem'
  },

  metaInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5rem',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    color: 'rgba(255, 255, 255, 0.6)'
  },

  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },

  bio: {
    fontSize: '1.1rem',
    lineHeight: 1.6,
    color: 'rgba(255, 255, 255, 0.8)',
    maxWidth: '700px',
    margin: '0 auto 2rem'
  },

  contactLinks: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },

  contactLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(255, 107, 53, 0.1)',
    border: '1px solid rgba(255, 107, 53, 0.3)',
    borderRadius: '12px',
    color: '#ff6b35',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },

  socialSection: {
    marginBottom: '3rem'
  },

  socialLinks: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },

  socialLink: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
    border: '1px solid rgba(255, 107, 53, 0.2)',
    borderRadius: '16px',
    textDecoration: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    minWidth: '100px',
    transition: 'all 0.3s ease',
    textTransform: 'capitalize'
  },

  section: {
    marginBottom: '3rem'
  },

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '2rem',
    color: '#ffffff'
  },

  skillsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem'
  },

  skillBadge: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.1))',
    border: '1px solid rgba(255, 107, 53, 0.3)',
    borderRadius: '12px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 600,
    fontSize: '0.95rem'
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    marginBottom: '3rem'
  },

  statCard: {
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
    border: '1px solid rgba(255, 107, 53, 0.2)',
    borderRadius: '20px',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)'
  },

  statValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '1rem 0 0.5rem'
  },

  statLabel: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: 500
  },

  projectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '2rem'
  },

  projectCard: {
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05))',
    border: '1px solid rgba(255, 107, 53, 0.2)',
    borderRadius: '24px',
    padding: '2rem',
    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.1)'
  },

  projectIcon: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '1rem',
    boxShadow: '0 4px 16px rgba(255, 107, 53, 0.3)'
  },

  projectName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '0.75rem'
  },

  projectDescription: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.5,
    marginBottom: '1rem'
  },

  projectMeta: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap'
  },

  projectMetaItem: {
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },

  customSectionContent: {
    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(16, 185, 129, 0.03))',
    border: '1px solid rgba(255, 107, 53, 0.1)',
    borderRadius: '16px',
    padding: '2rem',
    fontSize: '1.1rem',
    lineHeight: 1.6,
    color: 'rgba(255, 255, 255, 0.8)',
    whiteSpace: 'pre-wrap'
  },

  footer: {
    marginTop: '4rem',
    paddingTop: '2rem',
    borderTop: '1px solid rgba(255, 107, 53, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.95rem',
    color: 'rgba(255, 255, 255, 0.5)'
  },

  footerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },

  footerKontext: {
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 700,
    fontSize: '1.1rem'
  },

  footerLinks: {
    display: 'flex',
    gap: '1.5rem'
  },

  footerLink: {
    color: 'rgba(255, 255, 255, 0.5)',
    textDecoration: 'none',
    transition: 'color 0.3s ease'
  },

  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    color: '#ffffff'
  },

  loadingSpinner: {
    width: '60px',
    height: '60px',
    border: '4px solid rgba(255, 107, 53, 0.2)',
    borderTopColor: '#ff6b35',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1.5rem'
  },

  loadingText: {
    fontSize: '1.2rem',
    color: 'rgba(255, 255, 255, 0.6)'
  },

  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    color: '#ffffff',
    textAlign: 'center',
    padding: '2rem'
  },

  errorTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#ff6b35',
    marginTop: '1.5rem',
    marginBottom: '1rem'
  },

  errorText: {
    fontSize: '1.1rem',
    color: 'rgba(255, 255, 255, 0.6)',
    maxWidth: '500px',
    lineHeight: 1.6,
    marginBottom: '2rem'
  },

  errorButton: {
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  }
};

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ onClose }) => {
  // Extract principal from URL path: /profile/{principal}
  const pathParts = window.location.pathname.split('/');
  const principal = pathParts[2]; // /profile/{principal}
  
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<PublicProfileStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (principal) {
      loadProfile();
    }
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always use IC mainnet
      const agent = new HttpAgent({ host: 'https://icp0.io' });

      // Step 1: Look up the user's canister ID from the platform canister
      const platformCanisterId = process.env.CANISTER_ID_KONTEXT_BACKEND || 'pkmhr-fqaaa-aaaaa-qcfeq-cai';
      const platformActor: any = Actor.createActor(platformIdlFactory, {
        agent,
        canisterId: platformCanisterId,
      });

      const userPrincipal = Principal.fromText(principal!);
      
      // Get the user's canister ID
      const canisterResult = await platformActor.getUserPlatformCanister(userPrincipal);
      
      if (!canisterResult || canisterResult.length === 0) {
        setError('User canister not found - this user may not have an account yet');
        setLoading(false);
        return;
      }

      const userCanisterId = canisterResult[0];

      // Step 2: Create actor for the user's canister
      const userActor: any = Actor.createActor(userIdlFactory, {
        agent,
        canisterId: userCanisterId,
      });

      // Load profile and stats
      // Note: getFeaturedProjects may not exist, so we'll handle it separately
      const [profileResult, statsResult] = await Promise.all([
        userActor.getPublicProfile(),
        userActor.getPublicProfileStats()
      ]);
      
      // Try to get featured projects if method exists
      let projectsResult: any = null;
      if (typeof userActor.getFeaturedProjects === 'function') {
        try {
          projectsResult = await userActor.getFeaturedProjects();
        } catch (e) {
          console.warn('getFeaturedProjects not available:', e);
        }
      }

      if (!profileResult || profileResult.length === 0 || profileResult[0] === null) {
        setError('Profile not found. This user may not have created a public profile yet.');
        setLoading(false);
        return;
      }
      
        const prof = profileResult[0];
        
        // Check if profile is public
        if (!prof.isPublic) {
          setError('This profile is private');
          setLoading(false);
          return;
        }

        setProfile({
          displayName: prof.displayName?.[0],
          bio: prof.bio?.[0],
          tagline: prof.tagline?.[0],
          avatarUrl: prof.avatarUrl?.[0],
          bannerUrl: prof.bannerUrl?.[0],
          location: prof.location?.[0],
          timezone: prof.timezone?.[0],
          website: prof.website?.[0],
          email: prof.email?.[0],
          socialLinks: {
            twitter: prof.socialLinks.twitter?.[0],
            github: prof.socialLinks.github?.[0],
            linkedin: prof.socialLinks.linkedin?.[0],
            discord: prof.socialLinks.discord?.[0],
            telegram: prof.socialLinks.telegram?.[0],
            medium: prof.socialLinks.medium?.[0],
            youtube: prof.socialLinks.youtube?.[0],
            custom: prof.socialLinks.custom
          },
          title: prof.title?.[0],
          company: prof.company?.[0],
          skills: prof.skills,
          interests: prof.interests,
          featuredProjects: prof.featuredProjects,
          showMarketplace: prof.showMarketplace,
          showStats: prof.showStats,
          customSections: prof.customSections,
          isPublic: prof.isPublic,
          theme: prof.theme?.[0],
          createdAt: Number(prof.createdAt),
          updatedAt: Number(prof.updatedAt),
          profileViews: Number(prof.profileViews)
        });

        setStats({
          totalProjects: Number(statsResult.totalProjects),
          totalDeployments: Number(statsResult.totalDeployments),
          marketplaceListings: Number(statsResult.marketplaceListings),
          profileViews: Number(statsResult.profileViews),
          joinedDate: Number(statsResult.joinedDate)
        });

      setProjects(projectsResult || []);

        // Increment view count (fire and forget)
        userActor.incrementProfileViews().catch(() => {});
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    setShowQRModal(true);
  };

  const handleNativeShare = () => {
    const url = `${window.location.origin}/profile/${principal}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName || 'User'}'s Kontext Profile`,
        text: profile?.tagline || 'Check out my Kontext profile!',
        url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('Profile link copied to clipboard!');
    }
    setShowQRModal(false);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <div style={styles.loadingText}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={styles.errorContainer}>
        <Lock size={64} color="#ff6b35" />
        <h2 style={styles.errorTitle}>{error || 'Profile not found'}</h2>
        <p style={styles.errorText}>
          {error === 'This profile is private' 
            ? 'This user has chosen to keep their profile private.'
            : 'The profile you\'re looking for doesn\'t exist or is unavailable.'}
        </p>
        {onClose && (
          <button onClick={onClose} style={styles.errorButton}>
            Go Back
          </button>
        )}
      </div>
    );
  }

  const joinedDate = new Date(stats?.joinedDate ? Number(stats.joinedDate) / 1000000 : 0);
  const formattedDate = joinedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div style={styles.container}>
      {/* Header with gradient background */}
      <div style={{
        ...styles.banner,
        background: profile.bannerUrl 
          ? `url(${profile.bannerUrl}) center/cover`
          : 'linear-gradient(135deg, #ff6b35 0%, #f59e0b 50%, #10b981 100%)'
      }}>
        <div style={styles.bannerOverlay}></div>
        
        {onClose && (
          <button onClick={onClose} style={styles.closeButton}>
            ✕ Close
          </button>
        )}

        <button onClick={handleShare} style={styles.shareButton}>
          <Share2 size={18} />
          <span>Share</span>
        </button>
      </div>

      {/* Profile Content */}
      <div style={styles.content}>
        {/* Avatar and Basic Info */}
        <div style={styles.profileHeader}>
          <div style={styles.avatarContainer}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {(profile.displayName || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={styles.profileInfo}>
            <h1 style={styles.displayName}>
              {profile.displayName || 'Kontext User'}
            </h1>

            {profile.tagline && (
              <p style={styles.tagline}>{profile.tagline}</p>
            )}

            <div style={styles.metaInfo}>
              {profile.title && profile.company && (
                <div style={styles.metaItem}>
                  <Briefcase size={16} />
                  <span>{profile.title} at {profile.company}</span>
                </div>
              )}
              
              {profile.location && (
                <div style={styles.metaItem}>
                  <MapPin size={16} />
                  <span>{profile.location}</span>
                </div>
              )}

              <div style={styles.metaItem}>
                <Calendar size={16} />
                <span>Joined {formattedDate}</span>
              </div>

              {stats && profile.showStats && (
                <div style={styles.metaItem}>
                  <Eye size={16} />
                  <span>{stats.profileViews.toLocaleString()} views</span>
                </div>
              )}
            </div>

            {profile.bio && (
              <p style={styles.bio}>{profile.bio}</p>
            )}

            {/* Contact Links */}
            <div style={styles.contactLinks}>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" style={styles.contactLink}>
                  <Globe size={18} />
                  <span>Website</span>
                </a>
              )}
              
              {profile.email && (
                <a href={`mailto:${profile.email}`} style={styles.contactLink}>
                  <Mail size={18} />
                  <span>Email</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Social Links */}
        {(profile.socialLinks.twitter || profile.socialLinks.github || profile.socialLinks.linkedin || 
          profile.socialLinks.discord || profile.socialLinks.telegram) && (
          <div style={styles.socialSection}>
            <div style={styles.socialLinks}>
              {Object.entries(profile.socialLinks).map(([platform, handle]) => {
                if (!handle || platform === 'custom') return null;
                
                let url = '';
                if (platform === 'twitter') url = `https://twitter.com/${handle}`;
                else if (platform === 'github') url = `https://github.com/${handle}`;
                else if (platform === 'linkedin') url = `https://linkedin.com/in/${handle}`;
                else if (platform === 'discord') url = `https://discord.com/users/${handle}`;
                else if (platform === 'telegram') url = `https://t.me/${handle}`;
                else if (platform === 'medium') url = `https://medium.com/@${handle}`;
                else if (platform === 'youtube') url = `https://youtube.com/@${handle}`;

                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.socialLink}
                    title={platform}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{SocialIcon[platform] || '🔗'}</span>
                    <span style={{ fontSize: '0.85rem' }}>{platform}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              <Award size={24} />
              <span>Skills & Expertise</span>
            </h2>
            <div style={styles.skillsGrid}>
              {profile.skills.map((skill, index) => (
                <div key={index} style={styles.skillBadge}>
                  {skill}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && profile.showStats && (
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <GitBranch size={32} color="#ff6b35" />
              <div style={styles.statValue}>{stats.totalProjects}</div>
              <div style={styles.statLabel}>Projects</div>
            </div>
            
            <div style={styles.statCard}>
              <Package size={32} color="#10b981" />
              <div style={styles.statValue}>{stats.totalDeployments}</div>
              <div style={styles.statLabel}>Deployments</div>
            </div>

            {profile.showMarketplace && stats.marketplaceListings > 0 && (
              <div style={styles.statCard}>
                <Award size={32} color="#f59e0b" />
                <div style={styles.statValue}>{stats.marketplaceListings}</div>
                <div style={styles.statLabel}>Marketplace</div>
              </div>
            )}
          </div>
        )}

        {/* Featured Projects */}
        {projects && projects.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              <GitBranch size={24} />
              <span>Featured Projects</span>
            </h2>
            <div style={styles.projectsGrid}>
              {projects.map((project, index) => (
                <div key={project.id} className="feature-card" style={styles.projectCard}>
                  <div style={styles.projectIcon}>
                    {project.name[0].toUpperCase()}
                  </div>
                  <h3 style={styles.projectName}>{project.name}</h3>
                  <p style={styles.projectDescription}>
                    {project.description || 'A Kontext project'}
                  </p>
                  <div style={styles.projectMeta}>
                    <span style={styles.projectMetaItem}>
                      {Array.isArray(project.canisters) ? project.canisters.length : 0} canisters
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Sections */}
        {profile.customSections && profile.customSections.filter(s => s.isVisible).length > 0 && (
          profile.customSections
            .filter(s => s.isVisible)
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div key={section.id} style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  <span style={{ fontSize: '1.5rem' }}>{section.icon}</span>
                  <span>{section.title}</span>
                </h2>
                <div style={styles.customSectionContent}>
                  {section.content}
                </div>
              </div>
            ))
        )}

        {/* Powered by Kontext */}
        <div style={styles.footer}>
          <div style={styles.footerBrand}>
            Powered by <span style={styles.footerKontext}>Kontext</span>
          </div>
          <div style={styles.footerLinks}>
            <a href="/" style={styles.footerLink}>Create Your Profile</a>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(10px)'
          }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.05))',
              border: '2px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '24px',
              padding: '3rem',
              maxWidth: '500px',
              width: '90%',
              position: 'relative',
              boxShadow: '0 20px 60px rgba(255, 107, 53, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQRModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{
              fontSize: '2rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              Share Profile
            </h3>

            <div style={{
              background: '#ffffff',
              padding: '2rem',
              borderRadius: '16px',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '2rem'
            }}>
              <QRCodeSVG
                value={`${window.location.origin}/profile/${principal}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            <p style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '2rem',
              fontSize: '0.95rem'
            }}>
              Scan this QR code to view the profile
            </p>

            <div style={{
              display: 'flex',
              gap: '1rem',
              flexDirection: 'column'
            }}>
              <button
                onClick={handleNativeShare}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
              >
                <Share2 size={20} />
                <span>Share Link</span>
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/profile/${principal}`;
                  navigator.clipboard.writeText(url);
                  alert('Profile link copied!');
                }}
                style={{
                  padding: '1rem 2rem',
                  background: 'rgba(255, 107, 53, 0.1)',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  borderRadius: '12px',
                  color: '#ff6b35',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                📋 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes borderPulse {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(255, 107, 53, 0.1),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }
          50% { 
            box-shadow: 0 12px 48px rgba(255, 107, 53, 0.2),
                       inset 0 1px 0 rgba(255, 255, 255, 0.15);
          }
        }

        .feature-card {
          transition: all 0.5s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #ff6b35, #10b981);
          transform: scaleX(0.3);
          transform-origin: left;
          transition: transform 0.5s ease;
        }

        .feature-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 30px 60px rgba(255, 107, 53, 0.25), 
                     0 0 0 1px rgba(255, 107, 53, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .feature-card:hover::before {
          transform: scaleX(1);
        }
      `}</style>
    </div>
  );
};

