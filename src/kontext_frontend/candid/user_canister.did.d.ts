import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AIUsageRecord {
  'model' : string,
  'tokensUsed' : bigint,
  'creditsDeducted' : bigint,
  'inputTokens' : bigint,
  'projectId' : string,
  'outputTokens' : bigint,
  'operation' : string,
  'timestamp' : Timestamp,
}
export interface APICredential {
  'id' : string,
  'service' : string,
  'metadata' : Array<[string, string]>,
  'scopes' : Array<string>,
  'name' : string,
  'createdAt' : bigint,
  'credentialType' : CredentialType,
  'usageCount' : bigint,
  'tokenExpiry' : [] | [bigint],
  'isActive' : boolean,
  'encryptedToken' : string,
  'projectIds' : Array<string>,
  'lastUsed' : [] | [bigint],
}
export interface APIEndpoint {
  'id' : string,
  'url' : string,
  'method' : string,
  'body' : [] | [string],
  'name' : string,
  'createdAt' : bigint,
  'description' : [] | [string],
  'headers' : Array<[string, string]>,
}
export interface AccessControlPreferences {
  'allowedUsers' : Array<Principal>,
  'allowedRoles' : Array<string>,
  'restrictedActions' : Array<[string, Array<string>]>,
  'visibility' : string,
}
export interface Account {
  'id' : Principal,
  'created' : Timestamp,
  'owner' : Principal,
  'resources' : AccountResources,
  'stats' : AccountStats,
  'accountInfo' : AccountInfo,
  'collaborators' : Array<Collaborator>,
}
export interface AccountInfo {
  'lastAccessed' : Timestamp,
  'createdAt' : Timestamp,
  'externalServices' : [] | [ExternalServiceTokens],
  'preferences' : [] | [AccountPreferences],
  'accountType' : AccountType,
  'firstLoginAt' : [] | [Timestamp],
  'canisterSettings' : [] | [CanisterSettings],
  'hasCompletedOnboarding' : boolean,
}
export interface AccountPreferences {
  'timezone' : [] | [string],
  'notificationPreferences' : NotificationPreferences,
  'customPreferences' : [] | [Array<[string, string]>],
  'defaultProjectPreferences' : [] | [ProjectPreferences],
  'defaultVisibility' : Visibility,
  'sessionTimeout' : [] | [bigint],
}
export interface AccountResources {
  'deployments' : Array<DeploymentReference__1>,
  'templates' : Array<TemplateReference>,
  'projects' : Array<ProjectReference>,
}
export interface AccountStats {
  'billingCycleEnd' : [] | [bigint],
  'aiCreditsUsed' : bigint,
  'storageUsed' : bigint,
  'subscriptionTier' : string,
  'reputation' : bigint,
  'templatesPublished' : bigint,
  'stripeCustomerId' : [] | [string],
  'subscriptionActive' : boolean,
  'projectsCreated' : bigint,
  'totalRevenue' : bigint,
  'aiCreditsAllocated' : bigint,
  'templatesSold' : bigint,
  'cyclesBalance' : bigint,
  'lastActive' : Timestamp,
  'activity' : Array<ActivityLog>,
  'monthlyAIUsage' : bigint,
  'lastAICreditsRefresh' : Timestamp,
  'aiCreditsBalance' : bigint,
}
export type AccountType = { 'Premium' : null } |
  { 'Enterprise' : null } |
  { 'Basic' : null } |
  { 'Custom' : string };
export interface ActivityLog {
  'activityType' : string,
  'timestamp' : Timestamp,
  'details' : [] | [Array<[string, string]>],
}
export interface AgentCredentials {
  'openai' : [] | [LLMCredentials],
  'kimi' : [] | [LLMCredentials],
  'createdAt' : bigint,
  'databases' : Array<DatabaseCredential>,
  'agentId' : string,
  'updatedAt' : bigint,
  'projectId' : [] | [string],
  'customAPIs' : Array<APICredential>,
  'gemini' : [] | [LLMCredentials],
  'anthropic' : [] | [LLMCredentials],
  'environmentVariables' : Array<[string, string]>,
}
export type ArtifactContent = { 'ChunkReference' : Array<[bigint, bigint]> } |
  { 'Binary' : Uint8Array | number[] } |
  { 'Text' : string } |
  { 'Reference' : string };
export interface ArtifactFile {
  'content' : ArtifactContent,
  'path' : string,
  'mimeType' : string,
  'fileName' : string,
  'lastModified' : bigint,
  'language' : string,
}
export type BackgroundStyle = { 'Gradient' : [string, string] } |
  { 'Solid' : string } |
  { 'Image' : string } |
  { 'Default' : null };
export interface BuildPreferences {
  'artifacts' : Array<string>,
  'variables' : Array<[string, string]>,
  'environment' : string,
  'commands' : Array<string>,
}
export interface CanisterMetadata {
  'subType' : [] | [string],
  'canisterType' : string,
  'name' : string,
  'didInterface' : [] | [string],
  'stableInterface' : [] | [string],
  'project' : [] | [string],
}
export interface CanisterSettings {
  'duration' : [] | [bigint],
  'controllers' : Array<Principal>,
  'canisterType' : CanisterType,
  'freezingThreshold' : bigint,
  'name' : string,
  'initialCycles' : bigint,
  'memoryAllocation' : bigint,
  'computeAllocation' : bigint,
}
export type CanisterType = { 'Frontend' : null } |
  { 'Custom' : string } |
  { 'Asset' : null } |
  { 'Backend' : null };
export interface ChatMessage {
  'id' : string,
  'content' : string,
  'isGenerating' : [] | [boolean],
  'metadata' : [] | [Array<[string, string]>],
  'messageType' : ChatMessageType,
  'timestamp' : bigint,
}
export type ChatMessageType = { 'System' : null } |
  { 'User' : null } |
  { 'Assistant' : null };
export interface Chunk {
  'id' : ChunkId,
  'content' : Uint8Array | number[],
  'size' : bigint,
}
export type ChunkId = bigint;
export interface CodeArtifact {
  'id' : string,
  'content' : [] | [FileContent],
  'path' : string,
  'size' : bigint,
  'mimeType' : string,
  'fileName' : string,
  'lastModified' : bigint,
  'language' : string,
  'version' : bigint,
  'projectId' : string,
  'chunks' : [] | [Array<[ChunkId, bigint]>],
}
export interface CodeRule {
  'id' : string,
  'title' : string,
  'createdAt' : bigint,
  'rule' : string,
  'examples' : Array<string>,
}
export interface CodeTemplate {
  'id' : string,
  'code' : string,
  'name' : string,
  'createdAt' : bigint,
  'description' : [] | [string],
  'language' : string,
}
export interface Collaborator {
  'status' : CollaboratorStatus,
  'permissions' : Array<string>,
  'principal' : Principal,
  'expiresAt' : [] | [Timestamp],
  'role' : RoleType,
  'addedAt' : Timestamp,
}
export type CollaboratorStatus = { 'Invited' : null } |
  { 'Active' : null } |
  { 'Removed' : null };
export interface ColorPalette {
  'id' : string,
  'name' : string,
  'createdAt' : bigint,
  'colors' : Array<string>,
}
export type CredentialType = { 'JWT' : null } |
  { 'SSHKey' : null } |
  { 'APIKey' : null } |
  { 'OAuth2' : null } |
  { 'Custom' : string } |
  { 'BasicAuth' : null } |
  { 'Certificate' : null };
export interface CustomSection {
  'id' : string,
  'title' : string,
  'content' : string,
  'order' : bigint,
  'icon' : string,
  'isVisible' : boolean,
}
export interface DatabaseCredential {
  'id' : string,
  'encryptedPassword' : string,
  'username' : string,
  'allowedOperations' : Array<string>,
  'host' : string,
  'name' : string,
  'createdAt' : bigint,
  'port' : bigint,
  'sslCertificate' : [] | [string],
  'sslEnabled' : boolean,
  'database' : string,
  'connectionString' : [] | [string],
  'dbType' : string,
  'isReadOnly' : boolean,
}
export interface DeployedAgent {
  'id' : string,
  'status' : string,
  'frontendCanisterId' : [] | [Principal],
  'name' : string,
  'createdAt' : bigint,
  'agentType' : [] | [string],
  'description' : [] | [string],
  'backendCanisterId' : [] | [Principal],
  'lastDeployedAt' : [] | [bigint],
}
export interface DeploymentPreferences {
  'cyclesRequirement' : bigint,
  'network' : string,
  'replica' : string,
  'automaticDeployment' : boolean,
}
export interface DeploymentReference {
  'id' : string,
  'status' : string,
  'name' : string,
  'lastUpdated' : bigint,
  'network' : string,
  'projectId' : string,
  'canisterId' : [] | [Principal],
}
export interface DeploymentReference__1 {
  'id' : string,
  'status' : string,
  'name' : string,
  'lastUpdated' : Timestamp,
  'network' : string,
  'projectId' : string,
  'canisterId' : [] | [Principal],
}
export interface DesignInspiration {
  'id' : string,
  'url' : [] | [string],
  'title' : string,
  'createdAt' : bigint,
  'imageUrl' : [] | [string],
  'notes' : [] | [string],
}
export interface DiscordConfig {
  'channelId' : string,
  'notificationSettings' : NotificationSettings,
  'serverId' : string,
  'webhookUrl' : string,
}
export interface DocumentationItem {
  'id' : string,
  'title' : string,
  'content' : string,
  'createdAt' : bigint,
  'category' : [] | [string],
}
export interface DownloadLog {
  'exportId' : string,
  'tokenId' : string,
  'errorMessage' : [] | [string],
  'downloadedAt' : bigint,
  'success' : boolean,
  'buyer' : Principal,
  'userAgent' : [] | [string],
  'ipAddress' : [] | [string],
}
export interface DownloadToken {
  'exportId' : string,
  'lastUsedAt' : [] | [bigint],
  'tokenId' : string,
  'expiresAt' : bigint,
  'isRevoked' : boolean,
  'createdAt' : bigint,
  'maxDownloads' : bigint,
  'projectId' : string,
  'downloadCount' : bigint,
  'buyer' : Principal,
  'purchaseId' : string,
  'revokedAt' : [] | [bigint],
  'revokedReason' : [] | [string],
}
export interface EnvVariable {
  'key' : string,
  'isRequired' : boolean,
  'createdAt' : bigint,
  'description' : [] | [string],
  'category' : [] | [string],
  'isSecret' : boolean,
  'encryptedValue' : string,
}
export type Environment = { 'Production' : null } |
  { 'Custom' : string } |
  { 'Testing' : null } |
  { 'Development' : null } |
  { 'Staging' : null };
export interface EnvironmentConfig {
  'id' : string,
  'name' : string,
  'createdAt' : bigint,
  'agentId' : [] | [string],
  'variables' : Array<EnvVariable>,
  'updatedAt' : bigint,
  'projectId' : [] | [string],
  'environment' : Environment,
}
export interface ExportMetadata {
  'projectName' : string,
  'projectType' : ProjectType__1,
  'fileCount' : bigint,
  'npmPackages' : [] | [Array<NPMPackageInfo>],
  'exportedBy' : Principal,
  'motokoPackages' : [] | [Array<PackageInfo>],
}
export interface ExternalServiceTokens {
  'discord' : [] | [DiscordConfig],
  'telegram' : [] | [TelegramConfig],
  'github' : [] | [GitHubConfig],
}
export type FileContent = { 'Binary' : Uint8Array | number[] } |
  { 'Text' : string };
export interface FileData {
  'content' : FileContent,
  'path' : string,
  'mimeType' : string,
  'fileName' : string,
  'language' : string,
}
export interface FileMetadata {
  'id' : string,
  'path' : string,
  'size' : bigint,
  'isChunked' : boolean,
  'mimeType' : string,
  'fileName' : string,
  'lastModified' : bigint,
  'language' : string,
  'version' : bigint,
  'projectId' : string,
  'chunkCount' : [] | [bigint],
}
export interface FileShareLink {
  'token' : string,
  'expiresAt' : [] | [bigint],
  'isRevoked' : boolean,
  'createdAt' : bigint,
  'createdBy' : Principal,
  'fileId' : string,
  'maxDownloads' : [] | [bigint],
  'downloadCount' : bigint,
  'revokedAt' : [] | [bigint],
  'linkId' : string,
}
export interface FileTreeNode {
  'name' : string,
  'path' : string,
  'children' : [] | [Array<FileTreeNode>],
  'isDirectory' : boolean,
}
export type FileVisibility = { 'projectTeam' : null } |
  { 'public' : null } |
  { 'private' : null };
export interface GitHubConfig {
  'webhookConfigs' : Array<WebhookConfig>,
  'tokenExpiry' : Timestamp,
  'accessToken' : string,
  'connectedRepositories' : Array<string>,
}
export interface GitHubGuideline {
  'id' : string,
  'title' : string,
  'createdAt' : bigint,
  'guideline' : string,
}
export type HeaderField = [string, string];
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<HeaderField>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<HeaderField>,
  'streaming_strategy' : [] | [StreamingStrategy],
  'status_code' : number,
}
export interface ImageAsset {
  'height' : [] | [bigint],
  'data' : Uint8Array | number[],
  'name' : string,
  'mimeType' : string,
  'sizeBytes' : bigint,
  'width' : [] | [bigint],
  'uploadedAt' : bigint,
}
export interface LLMCredentials {
  'organizationId' : [] | [string],
  'model' : [] | [string],
  'endpoint' : [] | [string],
  'temperature' : [] | [number],
  'apiKey' : string,
  'projectId' : [] | [string],
  'maxTokens' : [] | [bigint],
  'rateLimit' : [] | [RateLimit],
}
export interface LoggerConfig { 'retentionDays' : bigint, 'maxSize' : bigint }
export interface MarketplaceListing {
  'title' : string,
  'isPublished' : boolean,
  'stripeAccountId' : string,
  'listedAt' : bigint,
  'tags' : Array<string>,
  'description' : string,
  'version' : string,
  'updatedAt' : bigint,
  'projectId' : string,
  'demoUrl' : [] | [string],
  'category' : string,
  'downloadCount' : bigint,
  'price' : bigint,
  'forSale' : boolean,
  'previewImages' : Array<string>,
}
export interface Metadata {
  'balance' : bigint,
  'cycleBalance' : bigint,
  'moduleHash' : [] | [Uint8Array | number[]],
  'lastUpdated' : bigint,
  'totalKeys' : bigint,
  'memoryUsage' : bigint,
  'version' : string,
  'uptime' : bigint,
  'totalUsers' : bigint,
  'idleCyclesBurnedPerDay' : bigint,
  'stableStateSize' : bigint,
  'stableMemoryUsage' : bigint,
  'heapMemoryUsage' : bigint,
  'memorySize' : bigint,
}
export interface NPMPackageInfo {
  'dependencyType' : string,
  'name' : string,
  'version' : string,
}
export interface NotificationPreferences {
  'channelPreferences' : {
    'email' : boolean,
    'discord' : boolean,
    'inApp' : boolean,
    'telegram' : boolean,
  },
  'notificationTypes' : [] | [Array<[string, boolean]>],
  'digestFrequency' : [] | [string],
}
export interface NotificationSettings {
  'enabled' : boolean,
  'muteTimeEnd' : [] | [bigint],
  'eventTypes' : Array<string>,
  'customSettings' : [] | [Array<[string, string]>],
  'frequency' : [] | [string],
  'muteTimeStart' : [] | [bigint],
}
export interface PackageInfo {
  'dir' : [] | [Array<string>],
  'name' : string,
  'homepage' : [] | [Array<string>],
  'repo' : string,
  'version' : string,
}
export interface ProfileTheme {
  'primaryColor' : string,
  'backgroundStyle' : BackgroundStyle,
  'accentColor' : string,
}
export interface Project {
  'id' : string,
  'status' : string,
  'created' : bigint,
  'lastMessageTime' : [] | [bigint],
  'deployedAgents' : [] | [Array<DeployedAgent>],
  'projectType' : ProjectType__1,
  'lastFrontendDeployment' : [] | [bigint],
  'messages' : [] | [Array<ChatMessage>],
  'templateId' : [] | [string],
  'metadata' : [] | [ProjectMetadata],
  'name' : string,
  'hasFrontendChanged' : [] | [boolean],
  'description' : [] | [string],
  'npmPackages' : [] | [Array<NPMPackageInfo>],
  'collaborators' : [] | [Array<Principal>],
  'canisters' : Array<Principal>,
  'updated' : bigint,
  'messageCount' : [] | [bigint],
  'workingCopyBaseVersion' : [] | [string],
  'motokoPackages' : [] | [Array<PackageInfo>],
  'visibility' : string,
  'lastDeploymentServerPairId' : [] | [string],
  'lastBackendDeployment' : [] | [bigint],
  'hasBackendChanged' : [] | [boolean],
}
export type ProjectCategory = { 'Frontend' : null } |
  { 'FullStack' : null } |
  { 'Backend' : null };
export interface ProjectExport {
  'exportId' : string,
  'expiresAt' : [] | [bigint],
  'compressionType' : string,
  'metadata' : ExportMetadata,
  'createdAt' : bigint,
  'isChunked' : boolean,
  'fileName' : string,
  'fileSize' : bigint,
  'totalChunks' : [] | [bigint],
  'projectId' : string,
  'checksum' : string,
}
export type ProjectFramework = { 'Vue' : null } |
  { 'Custom' : string } |
  { 'React' : null } |
  { 'Motoko' : null };
export interface ProjectMetadata {
  'difficultyLevel' : [] | [string],
  'externalLinks' : [] | [Array<[string, string]>],
  'thumbnailUrl' : [] | [string],
  'completionStatus' : [] | [string],
  'lastAccessed' : [] | [bigint],
  'fileCount' : [] | [bigint],
  'tags' : Array<string>,
  'learningObjectives' : [] | [Array<string>],
  'notes' : [] | [string],
  'customIcon' : [] | [string],
  'category' : [] | [string],
  'priority' : [] | [string],
  'isBookmarked' : [] | [boolean],
  'estimatedSize' : [] | [bigint],
  'customColor' : [] | [string],
}
export interface ProjectPreferences {
  'deploymentPreferences' : [] | [DeploymentPreferences],
  'projectType' : ProjectType,
  'defaultPreferences' : [] | [Array<[string, string]>],
  'accessPreferences' : [] | [AccessControlPreferences],
  'buildPreferences' : [] | [BuildPreferences],
  'visibility' : VisibilityType,
}
export interface ProjectReference {
  'id' : string,
  'name' : string,
  'lastModified' : Timestamp,
  'visibility' : Visibility,
}
export interface ProjectType {
  'framework' : ProjectFramework,
  'category' : ProjectCategory,
}
export interface ProjectType__1 { 'subType' : string, 'name' : string }
export interface ProjectVersion {
  'id' : string,
  'status' : VersionStatus,
  'deployments' : [] | [Array<DeploymentReference>],
  'created' : bigint,
  'name' : string,
  'tags' : Array<string>,
  'description' : [] | [string],
  'npmPackages' : [] | [Array<NPMPackageInfo>],
  'releaseNotes' : [] | [string],
  'parentVersion' : [] | [string],
  'projectId' : string,
  'artifactSnapshot' : [] | [string],
  'canisters' : Array<Principal>,
  'motokoPackages' : [] | [Array<PackageInfo>],
  'semanticVersion' : SemanticVersion,
}
export interface PublicProfile {
  'bio' : [] | [string],
  'timezone' : [] | [string],
  'theme' : [] | [ProfileTheme],
  'title' : [] | [string],
  'displayName' : [] | [string],
  'tagline' : [] | [string],
  'interests' : Array<string>,
  'socialLinks' : SocialLinks,
  'featuredProjects' : Array<string>,
  'createdAt' : Timestamp,
  'email' : [] | [string],
  'website' : [] | [string],
  'updatedAt' : Timestamp,
  'company' : [] | [string],
  'avatarUrl' : [] | [string],
  'showStats' : boolean,
  'bannerUrl' : [] | [string],
  'isPublic' : boolean,
  'profileViews' : bigint,
  'showMarketplace' : boolean,
  'skills' : Array<string>,
  'customSections' : Array<CustomSection>,
  'location' : [] | [string],
}
export interface PublicProfileStats {
  'totalDeployments' : bigint,
  'totalProjects' : bigint,
  'marketplaceListings' : bigint,
  'joinedDate' : Timestamp,
  'profileViews' : bigint,
}
export interface RateLimit {
  'tokensPerMinute' : [] | [bigint],
  'requestsPerDay' : bigint,
  'tokensPerDay' : [] | [bigint],
  'requestsPerMinute' : bigint,
}
export interface ReferenceItem {
  'id' : string,
  'title' : string,
  'content' : string,
  'createdAt' : bigint,
  'category' : [] | [string],
}
export type Result = {
    'ok' : { 'receivedChunks' : bigint, 'totalChunks' : bigint }
  } |
  { 'err' : string };
export type Result_1 = { 'ok' : StoredFile } |
  { 'err' : string };
export type Result_10 = { 'ok' : Account } |
  { 'err' : string };
export type Result_11 = {
    'ok' : {
      'totalSize' : bigint,
      'totalChunks' : bigint,
      'chunkSize' : bigint,
      'sessionId' : string,
    }
  } |
  { 'err' : string };
export type Result_12 = {
    'ok' : {
      'totalFiles' : bigint,
      'totalBatches' : bigint,
      'sessionId' : string,
      'batchSize' : bigint,
    }
  } |
  { 'err' : string };
export type Result_13 = { 'ok' : VersionArtifact } |
  { 'err' : string };
export type Result_14 = { 'ok' : ArtifactFile } |
  { 'err' : string };
export type Result_15 = { 'ok' : Array<SecurityAuditLog> } |
  { 'err' : string };
export type Result_16 = { 'ok' : Array<ReferenceItem> } |
  { 'err' : string };
export type Result_17 = { 'ok' : Array<ProjectVersion> } |
  { 'err' : string };
export type Result_18 = {
    'ok' : {
      'totalFiles' : bigint,
      'totalEstimatedSize' : bigint,
      'largeFiles' : bigint,
      'textFiles' : bigint,
      'averageFileSize' : bigint,
      'recommendedBatchSize' : bigint,
      'binaryFiles' : bigint,
    }
  } |
  { 'err' : string };
export type Result_19 = { 'ok' : Array<ServerPair> } |
  { 'err' : string };
export type Result_2 = {
    'ok' : { 'completed' : boolean, 'progress' : bigint }
  } |
  { 'err' : string };
export type Result_20 = { 'ok' : ProjectMetadata } |
  { 'err' : string };
export type Result_21 = { 'ok' : Array<ChatMessage> } |
  { 'err' : string };
export type Result_22 = { 'ok' : Array<CodeArtifact> } |
  { 'err' : string };
export type Result_23 = { 'ok' : FileTreeNode } |
  { 'err' : string };
export type Result_24 = { 'ok' : Array<FileMetadata> } |
  { 'err' : string };
export type Result_25 = { 'ok' : Array<DeployedAgent> } |
  { 'err' : string };
export type Result_26 = { 'ok' : Project } |
  { 'err' : string };
export type Result_27 = { 'ok' : Array<GitHubGuideline> } |
  { 'err' : string };
export type Result_28 = { 'ok' : Array<EnvironmentConfig> } |
  { 'err' : string };
export type Result_29 = { 'ok' : EnvironmentConfig } |
  { 'err' : string };
export type Result_3 = { 'ok' : ProjectVersion } |
  { 'err' : string };
export type Result_30 = { 'ok' : Array<DocumentationItem> } |
  { 'err' : string };
export type Result_31 = { 'ok' : Array<DesignInspiration> } |
  { 'err' : string };
export type Result_32 = {
    'ok' : {
      'lastFrontendDeployment' : [] | [bigint],
      'hasFrontendChanged' : boolean,
      'lastDeploymentServerPairId' : [] | [string],
      'lastBackendDeployment' : [] | [bigint],
      'hasBackendChanged' : boolean,
    }
  } |
  { 'err' : string };
export type Result_33 = { 'ok' : DatabaseCredential } |
  { 'err' : string };
export type Result_34 = { 'ok' : Array<ColorPalette> } |
  { 'err' : string };
export type Result_35 = { 'ok' : Array<CodeTemplate> } |
  { 'err' : string };
export type Result_36 = { 'ok' : Array<CodeRule> } |
  { 'err' : string };
export type Result_37 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_38 = {
    'ok' : {
      'references' : Array<ReferenceItem>,
      'designInspirations' : Array<DesignInspiration>,
      'documentationItems' : Array<DocumentationItem>,
      'codeTemplates' : Array<CodeTemplate>,
      'colorPalettes' : Array<ColorPalette>,
      'codeRules' : Array<CodeRule>,
      'gitHubGuidelines' : Array<GitHubGuideline>,
      'apiEndpoints' : Array<APIEndpoint>,
    }
  } |
  { 'err' : string };
export type Result_39 = { 'ok' : Array<DatabaseCredential> } |
  { 'err' : string };
export type Result_4 = { 'ok' : null } |
  { 'err' : string };
export type Result_40 = { 'ok' : Array<AgentCredentials> } |
  { 'err' : string };
export type Result_41 = { 'ok' : Array<APICredential> } |
  { 'err' : string };
export type Result_42 = { 'ok' : AgentCredentials } |
  { 'err' : string };
export type Result_43 = { 'ok' : Principal } |
  { 'err' : string };
export type Result_44 = { 'ok' : Array<APIEndpoint> } |
  { 'err' : string };
export type Result_45 = { 'ok' : APICredential } |
  { 'err' : string };
export type Result_46 = { 'ok' : DownloadToken } |
  { 'err' : string };
export type Result_47 = { 'ok' : ProjectExport } |
  { 'err' : string };
export type Result_48 = { 'ok' : Uint8Array | number[] } |
  { 'err' : string };
export type Result_49 = {
    'ok' : { 'files' : Array<CodeArtifact>, 'isLastBatch' : boolean }
  } |
  { 'err' : string };
export type Result_5 = { 'ok' : User } |
  { 'err' : string };
export type Result_50 = {
    'ok' : {
      'content' : Uint8Array | number[],
      'size' : bigint,
      'mimeType' : string,
    }
  } |
  { 'err' : string };
export type Result_51 = {
    'ok' : { 'url' : string, 'token' : string, 'linkId' : string }
  } |
  { 'err' : string };
export type Result_6 = { 'ok' : boolean } |
  { 'err' : string };
export type Result_7 = { 'ok' : string } |
  { 'err' : string };
export type Result_8 = { 'ok' : MarketplaceListing } |
  { 'err' : string };
export type Result_9 = { 'ok' : CodeArtifact } |
  { 'err' : string };
export type RoleType = { 'Custom' : string } |
  { 'Developer' : null } |
  { 'Reviewer' : null } |
  { 'Contributor' : null };
export type SecurityAction = { 'PermissionChanged' : null } |
  { 'CredentialUpdated' : null } |
  { 'Custom' : string } |
  { 'APIKeyUsed' : null } |
  { 'CredentialRotated' : null } |
  { 'CredentialCreated' : null } |
  { 'CredentialDeleted' : null } |
  { 'TokenRefreshed' : null } |
  { 'CredentialAccessed' : null } |
  { 'UnauthorizedAccess' : null } |
  { 'EnvironmentVariableAccessed' : null };
export interface SecurityAuditLog {
  'result' : SecurityResult,
  'action' : SecurityAction,
  'metadata' : Array<[string, string]>,
  'resourceId' : string,
  'userId' : Principal,
  'resourceType' : string,
  'timestamp' : bigint,
}
export type SecurityResult = { 'Blocked' : string } |
  { 'Success' : null } |
  { 'Failure' : string };
export interface SemanticVersion {
  'major' : bigint,
  'minor' : bigint,
  'build' : [] | [string],
  'patch' : bigint,
  'prerelease' : [] | [string],
}
export interface ServerPair {
  'creditsAllocated' : bigint,
  'frontendCanisterId' : Principal,
  'name' : string,
  'createdAt' : bigint,
  'backendCanisterId' : Principal,
  'pairId' : string,
}
export interface SocialLinks {
  'linkedin' : [] | [string],
  'twitter' : [] | [string],
  'custom' : Array<[string, string]>,
  'discord' : [] | [string],
  'youtube' : [] | [string],
  'telegram' : [] | [string],
  'github' : [] | [string],
  'medium' : [] | [string],
}
export interface StoredFile {
  'id' : string,
  'created' : bigint,
  'tags' : Array<string>,
  'isChunked' : boolean,
  'mimeType' : string,
  'description' : [] | [string],
  'fileName' : string,
  'fileSize' : bigint,
  'totalChunks' : [] | [bigint],
  'projectId' : string,
  'updated' : bigint,
  'checksum' : string,
  'category' : [] | [string],
  'visibility' : FileVisibility,
  'uploadedBy' : Principal,
}
export interface StreamingCallbackResponse {
  'token' : [] | [StreamingCallbackToken],
  'body' : Uint8Array | number[],
}
export interface StreamingCallbackToken {
  'exportId' : string,
  'tokenId' : string,
  'chunkIndex' : bigint,
}
export type StreamingStrategy = {
    'Callback' : {
      'token' : StreamingCallbackToken,
      'callback' : [Principal, string],
    }
  };
export interface Subscription {
  'monthlyAllocation' : bigint,
  'tier' : string,
  'isActive' : boolean,
  'billingCycleStart' : Timestamp,
  'autoRefresh' : boolean,
}
export interface TelegramConfig {
  'botEnabled' : boolean,
  'notificationSettings' : NotificationSettings,
  'chatId' : string,
}
export interface TemplateReference {
  'id' : string,
  'name' : string,
  'salesCount' : bigint,
  'price' : [] | [bigint],
  'visibility' : Visibility,
}
export type Timestamp = bigint;
export interface Transaction {
  'transactionType' : TransactionType,
  'isPositive' : boolean,
  'memo' : [] | [string],
  'counterparty' : string,
  'timestamp' : bigint,
  'amount' : bigint,
}
export type TransactionType = { 'sent' : null } |
  { 'canister' : null } |
  { 'received' : null };
export interface User {
  'id' : Principal,
  'primaryAccountId' : [] | [Principal],
  'created' : bigint,
  'preferences' : [] | [UserPreferences],
  'linkedAccounts' : Array<Principal>,
  'lastActive' : bigint,
  'profile' : UserProfile,
}
export interface UserPreferences {
  'theme' : [] | [string],
  'notifications' : NotificationPreferences,
  'customPreferences' : [] | [Array<[string, string]>],
  'defaultProjectPreferences' : [] | [ProjectPreferences],
  'visibility' : VisibilityPreferences,
}
export interface UserProfile {
  'bio' : [] | [string],
  'coverPhotoAsset' : [] | [ImageAsset],
  'username' : string,
  'displayName' : [] | [string],
  'metadata' : [] | [Array<[string, string]>],
  'socials' : [] | [UserSocials],
  'avatarAsset' : [] | [ImageAsset],
  'email' : [] | [string],
  'website' : [] | [string],
  'coverPhoto' : [] | [string],
  'github' : [] | [string],
  'avatar' : [] | [string],
}
export interface UserSocials {
  'twitter' : [] | [string],
  'discord' : [] | [string],
  'telegram' : [] | [string],
  'openchat' : [] | [string],
}
export interface VersionArtifact {
  'id' : string,
  'files' : Array<ArtifactFile>,
  'versionId' : string,
  'created' : bigint,
  'projectId' : string,
}
export type VersionStatus = { 'Released' : null } |
  { 'Draft' : null } |
  { 'Deprecated' : null } |
  { 'Development' : null };
export type Visibility = { 'Contacts' : null } |
  { 'Private' : null } |
  { 'Public' : null };
export interface VisibilityPreferences {
  'projects' : Visibility,
  'stats' : Visibility,
  'activity' : Visibility,
  'profile' : Visibility,
}
export type VisibilityType = { 'Contacts' : null } |
  { 'Private' : null } |
  { 'Public' : null };
export interface WebhookConfig {
  'id' : string,
  'url' : string,
  'active' : boolean,
  'secret' : string,
  'events' : Array<string>,
}
export interface _SERVICE {
  'addAPICredential' : ActorMethod<[APICredential], Result_4>,
  'addAPIEndpoint' : ActorMethod<[APIEndpoint], Result_4>,
  'addAgentCredentials' : ActorMethod<[AgentCredentials], Result_4>,
  'addCanisterMetadata' : ActorMethod<[Principal, CanisterMetadata], undefined>,
  'addCanisterToProject' : ActorMethod<
    [string, Principal, [] | [string]],
    Result_7
  >,
  'addCodeRule' : ActorMethod<[CodeRule], Result_4>,
  'addCodeTemplate' : ActorMethod<[CodeTemplate], Result_4>,
  'addCollaborator' : ActorMethod<
    [Principal, RoleType, Array<string>, [] | [Timestamp]],
    Result_4
  >,
  'addColorPalette' : ActorMethod<[ColorPalette], Result_4>,
  'addDatabaseCredential' : ActorMethod<[DatabaseCredential], Result_4>,
  'addDeployedAgentToProject' : ActorMethod<[string, DeployedAgent], Result_4>,
  'addDeploymentToAccount' : ActorMethod<
    [string, string, string, [] | [Principal], string, string],
    Result_4
  >,
  'addDeploymentToVersion' : ActorMethod<
    [string, DeploymentReference],
    Result_3
  >,
  'addDesignInspiration' : ActorMethod<[DesignInspiration], Result_4>,
  'addDocumentationItem' : ActorMethod<[DocumentationItem], Result_4>,
  'addEnvironmentConfig' : ActorMethod<[EnvironmentConfig], Result_4>,
  'addExternalService' : ActorMethod<
    [string, Array<[string, string]>],
    Result_4
  >,
  'addGitHubGuideline' : ActorMethod<[GitHubGuideline], Result_4>,
  'addGitHubWebhook' : ActorMethod<[string, string, Array<string>], Result_7>,
  'addMessageToProject' : ActorMethod<
    [string, string, ChatMessageType, [] | [string]],
    Result_7
  >,
  'addNpmPackageToProject' : ActorMethod<[string, NPMPackageInfo], Result_7>,
  'addPackageToProject' : ActorMethod<
    [string, PackageInfo, [] | [string]],
    Result_7
  >,
  'addProjectToAccount' : ActorMethod<[string, string, Visibility], Result_4>,
  'addReferenceItem' : ActorMethod<[ReferenceItem], Result_4>,
  'cleanOldLogs' : ActorMethod<[], undefined>,
  'cleanupExpiredSessions' : ActorMethod<[], undefined>,
  'cleanupProjectFilesDownloadSession' : ActorMethod<[string], Result_7>,
  'cleanupWasmDownloadSession' : ActorMethod<[string], Result_7>,
  'clearAllLogs' : ActorMethod<[], bigint>,
  'clearBackendChangedFlag' : ActorMethod<[string], Result_4>,
  'clearFrontendChangedFlag' : ActorMethod<[string], Result_4>,
  'clearProjectMessages' : ActorMethod<[string], Result_4>,
  'completeFileUpload' : ActorMethod<
    [string, FileVisibility, Array<string>, [] | [string], [] | [string]],
    Result_1
  >,
  'completeOnboarding' : ActorMethod<[], Result_6>,
  'completeSubscriptionSetup' : ActorMethod<
    [string, boolean, bigint, string, bigint],
    Result_4
  >,
  'copyVersionArtifacts' : ActorMethod<[string, string], Result_3>,
  'createCanisterWithSettings' : ActorMethod<
    [Principal, bigint, bigint, [] | [bigint], bigint, bigint, string, string],
    Result_7
  >,
  'createCodeArtifact' : ActorMethod<
    [
      Principal,
      string,
      string,
      FileContent,
      string,
      string,
      string,
      [] | [string],
    ],
    Result_9
  >,
  'createCodeArtifactForVersion' : ActorMethod<
    [Principal, string, string, FileContent, string, string, string],
    Result_14
  >,
  'createFileShareLink' : ActorMethod<
    [string, [] | [bigint], [] | [bigint]],
    Result_51
  >,
  'createMarketplaceListing' : ActorMethod<
    [
      string,
      bigint,
      string,
      string,
      string,
      Array<string>,
      [] | [string],
      string,
      Array<string>,
      string,
    ],
    Result_8
  >,
  'createMultipleCodeArtifacts' : ActorMethod<
    [Principal, string, Array<FileData>, [] | [string]],
    Result_22
  >,
  'createProject' : ActorMethod<[Project, [] | [boolean]], Result_7>,
  'createProjectVersion' : ActorMethod<
    [
      string,
      bigint,
      bigint,
      bigint,
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
    ],
    Result_3
  >,
  'createServerPair' : ActorMethod<
    [string, string, Principal, Principal, bigint],
    Result_7
  >,
  'createUserWallet' : ActorMethod<[], string>,
  'createVersionArtifacts' : ActorMethod<
    [string, Array<ArtifactFile>],
    Result_13
  >,
  'deductAICredits' : ActorMethod<
    [string, bigint, bigint, string, string],
    Result_37
  >,
  'deleteAPICredential' : ActorMethod<[string], Result_4>,
  'deleteAPIEndpoint' : ActorMethod<[string], Result_4>,
  'deleteAgentCredentials' : ActorMethod<[string], Result_4>,
  'deleteCanister' : ActorMethod<[Principal], Result_7>,
  'deleteCodeArtifact' : ActorMethod<
    [Principal, string, string, string, [] | [string]],
    Result_7
  >,
  'deleteCodeRule' : ActorMethod<[string], Result_4>,
  'deleteCodeTemplate' : ActorMethod<[string], Result_4>,
  'deleteColorPalette' : ActorMethod<[string], Result_4>,
  'deleteDatabaseCredential' : ActorMethod<[string], Result_4>,
  'deleteDeployment' : ActorMethod<[string, [] | [string]], Result_7>,
  'deleteDesignInspiration' : ActorMethod<[string], Result_4>,
  'deleteDocumentationItem' : ActorMethod<[string], Result_4>,
  'deleteEnvironmentConfig' : ActorMethod<[string], Result_4>,
  'deleteGitHubGuideline' : ActorMethod<[string], Result_4>,
  'deleteMarketplaceListing' : ActorMethod<[string], Result_4>,
  'deleteProject' : ActorMethod<[string], Result_7>,
  'deleteProjectExport' : ActorMethod<[string], Result_4>,
  'deleteProjectFile' : ActorMethod<[string], Result_4>,
  'deleteProjectFromAccount' : ActorMethod<[string], Result_4>,
  'deleteProjectVersion' : ActorMethod<[string], Result_4>,
  'deleteReferenceItem' : ActorMethod<[string], Result_4>,
  'deleteServerPair' : ActorMethod<[string], Result_4>,
  'deployStoredWasm' : ActorMethod<
    [
      string,
      string,
      Principal,
      string,
      string,
      Principal,
      [] | [CanisterMetadata],
      [] | [string],
      [] | [string],
    ],
    Result_7
  >,
  'deployToExistingCanister' : ActorMethod<
    [
      Principal,
      Uint8Array | number[],
      string,
      string,
      Principal,
      [] | [CanisterMetadata],
      [] | [string],
      [] | [string],
    ],
    Result_7
  >,
  'downloadLargeFileIndividually' : ActorMethod<
    [Principal, string, string, string, [] | [string]],
    Result_50
  >,
  'downloadProjectFilesBatch' : ActorMethod<[string, bigint], Result_49>,
  'downloadWasmChunk' : ActorMethod<[string, bigint], Result_48>,
  'exportProject' : ActorMethod<[string], Result_47>,
  'finalizeWasmUpload' : ActorMethod<[string], Result_7>,
  'generateDownloadToken' : ActorMethod<
    [string, string, string, Principal],
    Result_46
  >,
  'getAICreditsBalance' : ActorMethod<[], bigint>,
  'getAIUsageHistory' : ActorMethod<[[] | [bigint]], Array<AIUsageRecord>>,
  'getAIUsageThisMonth' : ActorMethod<[], bigint>,
  'getAPICredential' : ActorMethod<[string], Result_45>,
  'getAPIEndpoints' : ActorMethod<[], Result_44>,
  'getAccountDetails' : ActorMethod<[], [] | [Account]>,
  'getAccountIdByUsername' : ActorMethod<[string], Result_43>,
  'getAgentCredentials' : ActorMethod<[string], Result_42>,
  'getAllAPICredentials' : ActorMethod<[], Result_41>,
  'getAllAgentCredentials' : ActorMethod<[], Result_40>,
  'getAllDatabaseCredentials' : ActorMethod<[], Result_39>,
  'getAllEnvironmentConfigs' : ActorMethod<[], Result_28>,
  'getAllUserContext' : ActorMethod<[], Result_38>,
  'getBillingCycleEnd' : ActorMethod<[], [] | [bigint]>,
  'getCanisterBalance' : ActorMethod<[Principal], Result_37>,
  'getCanisterMetadata' : ActorMethod<[Principal], [] | [CanisterMetadata]>,
  'getCanisterStatus' : ActorMethod<[Principal], Result_7>,
  'getChunk' : ActorMethod<[ChunkId], [] | [Chunk]>,
  'getChunksBatch' : ActorMethod<
    [Array<bigint>],
    Array<[bigint, [] | [Chunk]]>
  >,
  'getCodeRules' : ActorMethod<[], Result_36>,
  'getCodeTemplates' : ActorMethod<[], Result_35>,
  'getColorPalettes' : ActorMethod<[], Result_34>,
  'getCycleBalance' : ActorMethod<[], bigint>,
  'getDatabaseCredential' : ActorMethod<[string], Result_33>,
  'getDeploymentFlags' : ActorMethod<[string], Result_32>,
  'getDesignInspirations' : ActorMethod<[], Result_31>,
  'getDocumentationItems' : ActorMethod<[], Result_30>,
  'getDownloadLogs' : ActorMethod<[string], Array<DownloadLog>>,
  'getDownloadToken' : ActorMethod<[string], [] | [DownloadToken]>,
  'getEnvironmentConfig' : ActorMethod<[string], Result_29>,
  'getEnvironmentConfigsByProject' : ActorMethod<[string], Result_28>,
  'getExternalServices' : ActorMethod<[], [] | [ExternalServiceTokens]>,
  'getFeaturedProjects' : ActorMethod<[], Array<Project>>,
  'getFileDownloadSystemHealth' : ActorMethod<
    [],
    {
      'recommendedAction' : string,
      'activeSessions' : bigint,
      'systemStatus' : string,
    }
  >,
  'getFileShareLinks' : ActorMethod<[string], Array<FileShareLink>>,
  'getGitHubGuidelines' : ActorMethod<[], Result_27>,
  'getLatestProjectVersion' : ActorMethod<[string], Result_3>,
  'getLinkedAccounts' : ActorMethod<[], Array<Principal>>,
  'getLoggerConfig' : ActorMethod<[], LoggerConfig>,
  'getLogs' : ActorMethod<[], Array<string>>,
  'getLogsByLevel' : ActorMethod<[string], Array<string>>,
  'getMarketplaceListing' : ActorMethod<[string], [] | [MarketplaceListing]>,
  'getNewLogsSince' : ActorMethod<
    [bigint, [] | [bigint]],
    { 'logs' : Array<string>, 'nextMarker' : bigint }
  >,
  'getOnboardingStatus' : ActorMethod<
    [],
    {
      'accountCreatedAt' : [] | [bigint],
      'firstLoginAt' : [] | [bigint],
      'hasCompletedOnboarding' : boolean,
    }
  >,
  'getProject' : ActorMethod<[string], Result_26>,
  'getProjectDeployedAgents' : ActorMethod<[string], Result_25>,
  'getProjectExport' : ActorMethod<[string], [] | [ProjectExport]>,
  'getProjectExports' : ActorMethod<[string], Array<ProjectExport>>,
  'getProjectFileMetadata' : ActorMethod<
    [Principal, string, [] | [string]],
    Result_24
  >,
  'getProjectFileTree' : ActorMethod<
    [Principal, string, [] | [string]],
    Result_23
  >,
  'getProjectFiles' : ActorMethod<
    [Principal, string, [] | [string]],
    Result_22
  >,
  'getProjectMessages' : ActorMethod<
    [string, [] | [bigint], [] | [bigint]],
    Result_21
  >,
  'getProjectMetadata' : ActorMethod<[string], Result_20>,
  'getProjectServerPairs' : ActorMethod<[string], Result_19>,
  'getProjectStatistics' : ActorMethod<
    [Principal, string, [] | [string]],
    Result_18
  >,
  'getProjectVersion' : ActorMethod<[string], Result_3>,
  'getProjectVersions' : ActorMethod<[string], Result_17>,
  'getPublicProfile' : ActorMethod<[], [] | [PublicProfile]>,
  'getPublicProfileStats' : ActorMethod<[], PublicProfileStats>,
  'getReferenceItems' : ActorMethod<[], Result_16>,
  'getSecurityAuditLogs' : ActorMethod<[[] | [bigint]], Result_15>,
  'getSelectedProject' : ActorMethod<[], [] | [string]>,
  'getSelectedServerPair' : ActorMethod<[], [] | [string]>,
  'getStorageUsage' : ActorMethod<[string], bigint>,
  'getStoredFile' : ActorMethod<[string], [] | [StoredFile]>,
  'getStoredFiles' : ActorMethod<[string], Array<StoredFile>>,
  'getStoredFilesByCategory' : ActorMethod<[string, string], Array<StoredFile>>,
  'getStripeCustomerId' : ActorMethod<[], [] | [string]>,
  'getSubscriptionInfo' : ActorMethod<[], [] | [Subscription]>,
  'getSubscriptionTier' : ActorMethod<[], string>,
  'getUIState' : ActorMethod<
    [],
    { 'selectedServerPair' : [] | [string], 'selectedProject' : [] | [string] }
  >,
  'getUserAccountInfo' : ActorMethod<[], [] | [User]>,
  'getUserBalance' : ActorMethod<[], bigint>,
  'getUserCanisters' : ActorMethod<
    [],
    Array<{ 'principal' : Principal, 'canisterType' : string, 'name' : string }>
  >,
  'getUserMarketplaceListings' : ActorMethod<[], Array<MarketplaceListing>>,
  'getUserProjects' : ActorMethod<[], Array<Project>>,
  'getUserServerPairs' : ActorMethod<[], Array<ServerPair>>,
  'getUserStateMetadata' : ActorMethod<[], Metadata>,
  'getUserWalletId' : ActorMethod<
    [],
    [] | [
      {
        'principal' : string,
        'subaccount' : string,
        'accountIdentifier' : string,
      }
    ]
  >,
  'getVersionArtifactFile' : ActorMethod<[string, string, string], Result_14>,
  'getVersionArtifacts' : ActorMethod<[string], Result_13>,
  'getVersionByString' : ActorMethod<[string, string], Result_3>,
  'getWalletTransactions' : ActorMethod<[[] | [bigint]], Array<Transaction>>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'incrementProfileViews' : ActorMethod<[], undefined>,
  'initializeDefaultSubscription' : ActorMethod<[], Result_6>,
  'initializeProjectVersion' : ActorMethod<[string], Result_3>,
  'initializeUserAccount' : ActorMethod<[UserProfile], Result_5>,
  'isCanisterController' : ActorMethod<[Principal], boolean>,
  'isFirstTimeUser' : ActorMethod<[], boolean>,
  'isModuleInstalled' : ActorMethod<[Principal], Result_6>,
  'isSubscriptionActiveLocal' : ActorMethod<[], boolean>,
  'linkAccount' : ActorMethod<[Principal], Result_4>,
  'logDebug' : ActorMethod<[string], undefined>,
  'logError' : ActorMethod<[string], undefined>,
  'logInfo' : ActorMethod<[string], undefined>,
  'logWarn' : ActorMethod<[string], undefined>,
  'markBackendChanged' : ActorMethod<[string], Result_4>,
  'markFirstLogin' : ActorMethod<[], Result_6>,
  'markFrontendChanged' : ActorMethod<[string], Result_4>,
  'markProjectAccessed' : ActorMethod<[string], Result_4>,
  'markServerPairChanged' : ActorMethod<[string, string], Result_4>,
  'migratePathsToStandard' : ActorMethod<[], undefined>,
  'moveServerPairToProject' : ActorMethod<[string, string, string], Result_4>,
  'promoteVersionToWorkingCopy' : ActorMethod<
    [Principal, string, string, boolean],
    Result_7
  >,
  'readCodeArtifact' : ActorMethod<
    [Principal, string, string, string, [] | [string]],
    Result_9
  >,
  'refreshMonthlyAICredits' : ActorMethod<[], Result_6>,
  'refundAICredits' : ActorMethod<[string, bigint, string], Result_6>,
  'removeCanisterFromProject' : ActorMethod<
    [string, Principal, [] | [string]],
    Result_7
  >,
  'removeCanisterMetadata' : ActorMethod<[Principal], undefined>,
  'removeDeployedAgentFromProject' : ActorMethod<[string, string], Result_4>,
  'removeExternalService' : ActorMethod<[string], Result_4>,
  'removeNpmPackageFromProject' : ActorMethod<[string, string], Result_7>,
  'removePackageFromProject' : ActorMethod<[string, string], Result_7>,
  'revokeDownloadToken' : ActorMethod<[string, string], Result_4>,
  'revokeFileShareLink' : ActorMethod<[string], Result_4>,
  'sendICP' : ActorMethod<[Principal, Principal, bigint], Result_7>,
  'sendICPToAccountId' : ActorMethod<[Principal, string, bigint], Result_7>,
  'setLocalMode' : ActorMethod<[boolean], undefined>,
  'setPrimaryAccount' : ActorMethod<[Principal], Result_4>,
  'setSelectedProject' : ActorMethod<[[] | [string]], Result_4>,
  'setSelectedServerPair' : ActorMethod<[[] | [string]], Result_4>,
  'setStripeCustomerId' : ActorMethod<[string], Result_4>,
  'setUIState' : ActorMethod<[[] | [string], [] | [string]], Result_4>,
  'startCanister' : ActorMethod<[Principal], Result_7>,
  'startFileUploadSession' : ActorMethod<
    [string, string, string, bigint, bigint],
    Result_7
  >,
  'startProjectFilesDownloadSession' : ActorMethod<
    [Principal, string, [] | [string]],
    Result_12
  >,
  'startWasmDownloadSession' : ActorMethod<[string, string, string], Result_11>,
  'startWasmUploadSession' : ActorMethod<
    [
      string,
      string,
      bigint,
      bigint,
      [] | [Principal],
      [] | [string],
      [] | [string],
    ],
    Result_7
  >,
  'stopCanister' : ActorMethod<[Principal], Result_7>,
  'streamProjectChunk' : ActorMethod<
    [StreamingCallbackToken],
    StreamingCallbackResponse
  >,
  'testLogSequence' : ActorMethod<
    [],
    { 'afterLog' : bigint, 'before' : bigint, 'afterIncrement' : bigint }
  >,
  'toggleMarketplaceForSale' : ActorMethod<[string, boolean], Result_4>,
  'topUpCanister' : ActorMethod<[Principal, number], Result_7>,
  'topUpCanisterCMC' : ActorMethod<[Principal, Principal, bigint], Result_7>,
  'topUpExternalCanister' : ActorMethod<[string, number], Result_7>,
  'topUpSelf' : ActorMethod<[number], Result_7>,
  'unlinkAccount' : ActorMethod<[Principal], Result_4>,
  'updateAPICredential' : ActorMethod<[APICredential], Result_4>,
  'updateAPIEndpoint' : ActorMethod<[APIEndpoint], Result_4>,
  'updateAccountCanisterSettings' : ActorMethod<[CanisterSettings], Result_4>,
  'updateAccountCyclesBalance' : ActorMethod<[bigint], Result_4>,
  'updateAccountPreferences' : ActorMethod<[AccountPreferences], Result_10>,
  'updateAccountProject' : ActorMethod<[string, string, Visibility], Result_4>,
  'updateAccountType' : ActorMethod<[AccountType], Result_4>,
  'updateAgentCredentials' : ActorMethod<[AgentCredentials], Result_4>,
  'updateBillingCycleEnd' : ActorMethod<[bigint], Result_4>,
  'updateCanisterMetadata' : ActorMethod<
    [Principal, CanisterMetadata],
    undefined
  >,
  'updateCanisterMetadataBC' : ActorMethod<
    [Principal, string, string],
    Result_7
  >,
  'updateCodeArtifact' : ActorMethod<
    [Principal, string, string, FileContent, string, [] | [string]],
    Result_9
  >,
  'updateCodeRule' : ActorMethod<[CodeRule], Result_4>,
  'updateCodeTemplate' : ActorMethod<[CodeTemplate], Result_4>,
  'updateCollaboratorStatus' : ActorMethod<
    [Principal, CollaboratorStatus],
    Result_4
  >,
  'updateColorPalette' : ActorMethod<[ColorPalette], Result_4>,
  'updateDatabaseCredential' : ActorMethod<[DatabaseCredential], Result_4>,
  'updateDeployedAgentInProject' : ActorMethod<
    [string, DeployedAgent],
    Result_4
  >,
  'updateDeploymentStatus' : ActorMethod<[string, string], Result_4>,
  'updateDeploymentStatusWithVersion' : ActorMethod<
    [string, string, [] | [string]],
    Result_4
  >,
  'updateDesignInspiration' : ActorMethod<[DesignInspiration], Result_4>,
  'updateDocumentationItem' : ActorMethod<[DocumentationItem], Result_4>,
  'updateEnvironmentConfig' : ActorMethod<[EnvironmentConfig], Result_4>,
  'updateFileMetadata' : ActorMethod<
    [
      string,
      [] | [string],
      [] | [FileVisibility],
      [] | [Array<string>],
      [] | [[] | [string]],
      [] | [[] | [string]],
    ],
    Result_4
  >,
  'updateGitHubGuideline' : ActorMethod<[GitHubGuideline], Result_4>,
  'updateGitHubRepositories' : ActorMethod<[Array<string>], Result_4>,
  'updateLoggerConfig' : ActorMethod<[bigint, bigint], undefined>,
  'updateMarketplaceListing' : ActorMethod<
    [
      string,
      [] | [bigint],
      [] | [string],
      [] | [string],
      [] | [Array<string>],
      [] | [[] | [string]],
      [] | [string],
      [] | [Array<string>],
      [] | [string],
      [] | [boolean],
    ],
    Result_8
  >,
  'updateMessageInProject' : ActorMethod<
    [string, string, string, [] | [boolean]],
    Result_4
  >,
  'updateNotificationPreferences' : ActorMethod<
    [NotificationPreferences],
    Result_4
  >,
  'updateProject' : ActorMethod<[Project, boolean, [] | [string]], Result_7>,
  'updateProjectMetadata' : ActorMethod<[string, ProjectMetadata], Result_4>,
  'updatePublicProfile' : ActorMethod<[PublicProfile], Result_4>,
  'updateReferenceItem' : ActorMethod<[ReferenceItem], Result_4>,
  'updateServerPair' : ActorMethod<
    [string, [] | [string], [] | [bigint]],
    Result_4
  >,
  'updateStripeData' : ActorMethod<
    [[] | [string], boolean, [] | [bigint]],
    Result_4
  >,
  'updateStripeSubscriptionStatus' : ActorMethod<[boolean], Result_4>,
  'updateSubscriptionTier' : ActorMethod<[string, bigint], Result_6>,
  'updateUserPreferences' : ActorMethod<[UserPreferences], Result_5>,
  'updateUserProfile' : ActorMethod<[UserProfile], Result_5>,
  'updateUserReputation' : ActorMethod<[bigint], Result_4>,
  'updateVersionCanisters' : ActorMethod<
    [string, [] | [Array<Principal>]],
    Result_3
  >,
  'updateVersionPackages' : ActorMethod<
    [string, [] | [Array<PackageInfo>], [] | [Array<NPMPackageInfo>]],
    Result_3
  >,
  'updateVersionStatus' : ActorMethod<[string, string], Result_3>,
  'uploadFileChunkToSession' : ActorMethod<
    [string, bigint, Uint8Array | number[]],
    Result_2
  >,
  'uploadProjectFile' : ActorMethod<
    [
      string,
      string,
      string,
      Uint8Array | number[],
      FileVisibility,
      Array<string>,
      [] | [string],
      [] | [string],
    ],
    Result_1
  >,
  'uploadWasmChunk' : ActorMethod<
    [string, bigint, Uint8Array | number[]],
    Result
  >,
  'wallet_receive' : ActorMethod<[], { 'accepted' : bigint }>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
