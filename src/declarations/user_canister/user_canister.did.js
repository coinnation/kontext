export const idlFactory = ({ IDL }) => {
  const FileTreeNode = IDL.Rec();
  const CredentialType = IDL.Variant({
    'JWT' : IDL.Null,
    'SSHKey' : IDL.Null,
    'APIKey' : IDL.Null,
    'OAuth2' : IDL.Null,
    'Custom' : IDL.Text,
    'BasicAuth' : IDL.Null,
    'Certificate' : IDL.Null,
  });
  const APICredential = IDL.Record({
    'id' : IDL.Text,
    'service' : IDL.Text,
    'metadata' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'scopes' : IDL.Vec(IDL.Text),
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'credentialType' : CredentialType,
    'usageCount' : IDL.Nat,
    'tokenExpiry' : IDL.Opt(IDL.Nat64),
    'isActive' : IDL.Bool,
    'encryptedToken' : IDL.Text,
    'projectIds' : IDL.Vec(IDL.Text),
    'lastUsed' : IDL.Opt(IDL.Nat64),
  });
  const Result_4 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const APIEndpoint = IDL.Record({
    'id' : IDL.Text,
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'description' : IDL.Opt(IDL.Text),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const RateLimit = IDL.Record({
    'tokensPerMinute' : IDL.Opt(IDL.Nat),
    'requestsPerDay' : IDL.Nat,
    'tokensPerDay' : IDL.Opt(IDL.Nat),
    'requestsPerMinute' : IDL.Nat,
  });
  const LLMCredentials = IDL.Record({
    'organizationId' : IDL.Opt(IDL.Text),
    'model' : IDL.Opt(IDL.Text),
    'endpoint' : IDL.Opt(IDL.Text),
    'temperature' : IDL.Opt(IDL.Float64),
    'apiKey' : IDL.Text,
    'projectId' : IDL.Opt(IDL.Text),
    'maxTokens' : IDL.Opt(IDL.Nat),
    'rateLimit' : IDL.Opt(RateLimit),
  });
  const DatabaseCredential = IDL.Record({
    'id' : IDL.Text,
    'encryptedPassword' : IDL.Text,
    'username' : IDL.Text,
    'allowedOperations' : IDL.Vec(IDL.Text),
    'host' : IDL.Text,
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'port' : IDL.Nat,
    'sslCertificate' : IDL.Opt(IDL.Text),
    'sslEnabled' : IDL.Bool,
    'database' : IDL.Text,
    'connectionString' : IDL.Opt(IDL.Text),
    'dbType' : IDL.Text,
    'isReadOnly' : IDL.Bool,
  });
  const AgentCredentials = IDL.Record({
    'openai' : IDL.Opt(LLMCredentials),
    'kimi' : IDL.Opt(LLMCredentials),
    'createdAt' : IDL.Nat64,
    'databases' : IDL.Vec(DatabaseCredential),
    'agentId' : IDL.Text,
    'updatedAt' : IDL.Nat64,
    'projectId' : IDL.Opt(IDL.Text),
    'customAPIs' : IDL.Vec(APICredential),
    'gemini' : IDL.Opt(LLMCredentials),
    'anthropic' : IDL.Opt(LLMCredentials),
    'environmentVariables' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const CanisterMetadata = IDL.Record({
    'subType' : IDL.Opt(IDL.Text),
    'canisterType' : IDL.Text,
    'name' : IDL.Text,
    'didInterface' : IDL.Opt(IDL.Text),
    'stableInterface' : IDL.Opt(IDL.Text),
    'project' : IDL.Opt(IDL.Text),
  });
  const Result_7 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const CodeRule = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'rule' : IDL.Text,
    'examples' : IDL.Vec(IDL.Text),
  });
  const CodeTemplate = IDL.Record({
    'id' : IDL.Text,
    'code' : IDL.Text,
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'description' : IDL.Opt(IDL.Text),
    'language' : IDL.Text,
  });
  const RoleType = IDL.Variant({
    'Custom' : IDL.Text,
    'Developer' : IDL.Null,
    'Reviewer' : IDL.Null,
    'Contributor' : IDL.Null,
  });
  const Timestamp = IDL.Nat64;
  const ColorPalette = IDL.Record({
    'id' : IDL.Text,
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'colors' : IDL.Vec(IDL.Text),
  });
  const DeployedAgent = IDL.Record({
    'id' : IDL.Text,
    'status' : IDL.Text,
    'frontendCanisterId' : IDL.Opt(IDL.Principal),
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'agentType' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'backendCanisterId' : IDL.Opt(IDL.Principal),
    'lastDeployedAt' : IDL.Opt(IDL.Nat64),
  });
  const DeploymentReference = IDL.Record({
    'id' : IDL.Text,
    'status' : IDL.Text,
    'name' : IDL.Text,
    'lastUpdated' : IDL.Nat64,
    'network' : IDL.Text,
    'projectId' : IDL.Text,
    'canisterId' : IDL.Opt(IDL.Principal),
  });
  const VersionStatus = IDL.Variant({
    'Released' : IDL.Null,
    'Draft' : IDL.Null,
    'Deprecated' : IDL.Null,
    'Development' : IDL.Null,
  });
  const NPMPackageInfo = IDL.Record({
    'dependencyType' : IDL.Text,
    'name' : IDL.Text,
    'version' : IDL.Text,
  });
  const PackageInfo = IDL.Record({
    'dir' : IDL.Opt(IDL.Vec(IDL.Text)),
    'name' : IDL.Text,
    'homepage' : IDL.Opt(IDL.Vec(IDL.Text)),
    'repo' : IDL.Text,
    'version' : IDL.Text,
  });
  const SemanticVersion = IDL.Record({
    'major' : IDL.Nat,
    'minor' : IDL.Nat,
    'build' : IDL.Opt(IDL.Text),
    'patch' : IDL.Nat,
    'prerelease' : IDL.Opt(IDL.Text),
  });
  const ProjectVersion = IDL.Record({
    'id' : IDL.Text,
    'status' : VersionStatus,
    'deployments' : IDL.Opt(IDL.Vec(DeploymentReference)),
    'created' : IDL.Nat64,
    'name' : IDL.Text,
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'npmPackages' : IDL.Opt(IDL.Vec(NPMPackageInfo)),
    'releaseNotes' : IDL.Opt(IDL.Text),
    'parentVersion' : IDL.Opt(IDL.Text),
    'projectId' : IDL.Text,
    'artifactSnapshot' : IDL.Opt(IDL.Text),
    'canisters' : IDL.Vec(IDL.Principal),
    'motokoPackages' : IDL.Opt(IDL.Vec(PackageInfo)),
    'semanticVersion' : SemanticVersion,
  });
  const Result_3 = IDL.Variant({ 'ok' : ProjectVersion, 'err' : IDL.Text });
  const DesignInspiration = IDL.Record({
    'id' : IDL.Text,
    'url' : IDL.Opt(IDL.Text),
    'title' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'imageUrl' : IDL.Opt(IDL.Text),
    'notes' : IDL.Opt(IDL.Text),
  });
  const DocumentationItem = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'content' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'category' : IDL.Opt(IDL.Text),
  });
  const EnvVariable = IDL.Record({
    'key' : IDL.Text,
    'isRequired' : IDL.Bool,
    'createdAt' : IDL.Nat64,
    'description' : IDL.Opt(IDL.Text),
    'category' : IDL.Opt(IDL.Text),
    'isSecret' : IDL.Bool,
    'encryptedValue' : IDL.Text,
  });
  const Environment = IDL.Variant({
    'Production' : IDL.Null,
    'Custom' : IDL.Text,
    'Testing' : IDL.Null,
    'Development' : IDL.Null,
    'Staging' : IDL.Null,
  });
  const EnvironmentConfig = IDL.Record({
    'id' : IDL.Text,
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'agentId' : IDL.Opt(IDL.Text),
    'variables' : IDL.Vec(EnvVariable),
    'updatedAt' : IDL.Nat64,
    'projectId' : IDL.Opt(IDL.Text),
    'environment' : Environment,
  });
  const GitHubGuideline = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'guideline' : IDL.Text,
  });
  const ChatMessageType = IDL.Variant({
    'System' : IDL.Null,
    'User' : IDL.Null,
    'Assistant' : IDL.Null,
  });
  const Visibility = IDL.Variant({
    'Contacts' : IDL.Null,
    'Private' : IDL.Null,
    'Public' : IDL.Null,
  });
  const ReferenceItem = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'content' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'category' : IDL.Opt(IDL.Text),
  });
  const FileVisibility = IDL.Variant({
    'projectTeam' : IDL.Null,
    'public' : IDL.Null,
    'private' : IDL.Null,
  });
  const StoredFile = IDL.Record({
    'id' : IDL.Text,
    'created' : IDL.Nat64,
    'tags' : IDL.Vec(IDL.Text),
    'isChunked' : IDL.Bool,
    'mimeType' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'fileName' : IDL.Text,
    'fileSize' : IDL.Nat,
    'totalChunks' : IDL.Opt(IDL.Nat),
    'projectId' : IDL.Text,
    'updated' : IDL.Nat64,
    'checksum' : IDL.Text,
    'category' : IDL.Opt(IDL.Text),
    'visibility' : FileVisibility,
    'uploadedBy' : IDL.Principal,
  });
  const Result_1 = IDL.Variant({ 'ok' : StoredFile, 'err' : IDL.Text });
  const Result_6 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
  const FileContent = IDL.Variant({
    'Binary' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
  });
  const ChunkId = IDL.Nat;
  const CodeArtifact = IDL.Record({
    'id' : IDL.Text,
    'content' : IDL.Opt(FileContent),
    'path' : IDL.Text,
    'size' : IDL.Nat,
    'mimeType' : IDL.Text,
    'fileName' : IDL.Text,
    'lastModified' : IDL.Int,
    'language' : IDL.Text,
    'version' : IDL.Nat,
    'projectId' : IDL.Text,
    'chunks' : IDL.Opt(IDL.Vec(IDL.Tuple(ChunkId, IDL.Nat))),
  });
  const Result_9 = IDL.Variant({ 'ok' : CodeArtifact, 'err' : IDL.Text });
  const ArtifactContent = IDL.Variant({
    'ChunkReference' : IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Nat)),
    'Binary' : IDL.Vec(IDL.Nat8),
    'Text' : IDL.Text,
    'Reference' : IDL.Text,
  });
  const ArtifactFile = IDL.Record({
    'content' : ArtifactContent,
    'path' : IDL.Text,
    'mimeType' : IDL.Text,
    'fileName' : IDL.Text,
    'lastModified' : IDL.Nat64,
    'language' : IDL.Text,
  });
  const Result_14 = IDL.Variant({ 'ok' : ArtifactFile, 'err' : IDL.Text });
  const Result_51 = IDL.Variant({
    'ok' : IDL.Record({
      'url' : IDL.Text,
      'token' : IDL.Text,
      'linkId' : IDL.Text,
    }),
    'err' : IDL.Text,
  });
  const MarketplaceListing = IDL.Record({
    'title' : IDL.Text,
    'isPublished' : IDL.Bool,
    'stripeAccountId' : IDL.Text,
    'listedAt' : IDL.Nat64,
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'version' : IDL.Text,
    'updatedAt' : IDL.Nat64,
    'projectId' : IDL.Text,
    'demoUrl' : IDL.Opt(IDL.Text),
    'category' : IDL.Text,
    'downloadCount' : IDL.Nat,
    'price' : IDL.Nat,
    'forSale' : IDL.Bool,
    'previewImages' : IDL.Vec(IDL.Text),
  });
  const Result_8 = IDL.Variant({ 'ok' : MarketplaceListing, 'err' : IDL.Text });
  const FileData = IDL.Record({
    'content' : FileContent,
    'path' : IDL.Text,
    'mimeType' : IDL.Text,
    'fileName' : IDL.Text,
    'language' : IDL.Text,
  });
  const Result_22 = IDL.Variant({
    'ok' : IDL.Vec(CodeArtifact),
    'err' : IDL.Text,
  });
  const ProjectType__1 = IDL.Record({
    'subType' : IDL.Text,
    'name' : IDL.Text,
  });
  const ChatMessage = IDL.Record({
    'id' : IDL.Text,
    'content' : IDL.Text,
    'isGenerating' : IDL.Opt(IDL.Bool),
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'messageType' : ChatMessageType,
    'timestamp' : IDL.Nat64,
  });
  const ProjectMetadata = IDL.Record({
    'difficultyLevel' : IDL.Opt(IDL.Text),
    'externalLinks' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'thumbnailUrl' : IDL.Opt(IDL.Text),
    'completionStatus' : IDL.Opt(IDL.Text),
    'lastAccessed' : IDL.Opt(IDL.Nat64),
    'fileCount' : IDL.Opt(IDL.Nat),
    'tags' : IDL.Vec(IDL.Text),
    'learningObjectives' : IDL.Opt(IDL.Vec(IDL.Text)),
    'notes' : IDL.Opt(IDL.Text),
    'customIcon' : IDL.Opt(IDL.Text),
    'category' : IDL.Opt(IDL.Text),
    'priority' : IDL.Opt(IDL.Text),
    'isBookmarked' : IDL.Opt(IDL.Bool),
    'estimatedSize' : IDL.Opt(IDL.Nat),
    'customColor' : IDL.Opt(IDL.Text),
  });
  const Project = IDL.Record({
    'id' : IDL.Text,
    'status' : IDL.Text,
    'created' : IDL.Nat64,
    'lastMessageTime' : IDL.Opt(IDL.Nat64),
    'deployedAgents' : IDL.Opt(IDL.Vec(DeployedAgent)),
    'projectType' : ProjectType__1,
    'lastFrontendDeployment' : IDL.Opt(IDL.Nat64),
    'messages' : IDL.Opt(IDL.Vec(ChatMessage)),
    'templateId' : IDL.Opt(IDL.Text),
    'metadata' : IDL.Opt(ProjectMetadata),
    'name' : IDL.Text,
    'hasFrontendChanged' : IDL.Opt(IDL.Bool),
    'description' : IDL.Opt(IDL.Text),
    'npmPackages' : IDL.Opt(IDL.Vec(NPMPackageInfo)),
    'collaborators' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'canisters' : IDL.Vec(IDL.Principal),
    'updated' : IDL.Nat64,
    'messageCount' : IDL.Opt(IDL.Nat),
    'workingCopyBaseVersion' : IDL.Opt(IDL.Text),
    'motokoPackages' : IDL.Opt(IDL.Vec(PackageInfo)),
    'visibility' : IDL.Text,
    'lastDeploymentServerPairId' : IDL.Opt(IDL.Text),
    'lastBackendDeployment' : IDL.Opt(IDL.Nat64),
    'hasBackendChanged' : IDL.Opt(IDL.Bool),
  });
  const VersionArtifact = IDL.Record({
    'id' : IDL.Text,
    'files' : IDL.Vec(ArtifactFile),
    'versionId' : IDL.Text,
    'created' : IDL.Nat64,
    'projectId' : IDL.Text,
  });
  const Result_13 = IDL.Variant({ 'ok' : VersionArtifact, 'err' : IDL.Text });
  const Result_37 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const Result_50 = IDL.Variant({
    'ok' : IDL.Record({
      'content' : IDL.Vec(IDL.Nat8),
      'size' : IDL.Nat,
      'mimeType' : IDL.Text,
    }),
    'err' : IDL.Text,
  });
  const Result_49 = IDL.Variant({
    'ok' : IDL.Record({
      'files' : IDL.Vec(CodeArtifact),
      'isLastBatch' : IDL.Bool,
    }),
    'err' : IDL.Text,
  });
  const Result_48 = IDL.Variant({ 'ok' : IDL.Vec(IDL.Nat8), 'err' : IDL.Text });
  const ExportMetadata = IDL.Record({
    'projectName' : IDL.Text,
    'projectType' : ProjectType__1,
    'fileCount' : IDL.Nat,
    'npmPackages' : IDL.Opt(IDL.Vec(NPMPackageInfo)),
    'exportedBy' : IDL.Principal,
    'motokoPackages' : IDL.Opt(IDL.Vec(PackageInfo)),
  });
  const ProjectExport = IDL.Record({
    'exportId' : IDL.Text,
    'expiresAt' : IDL.Opt(IDL.Nat64),
    'compressionType' : IDL.Text,
    'metadata' : ExportMetadata,
    'createdAt' : IDL.Nat64,
    'isChunked' : IDL.Bool,
    'fileName' : IDL.Text,
    'fileSize' : IDL.Nat,
    'totalChunks' : IDL.Opt(IDL.Nat),
    'projectId' : IDL.Text,
    'checksum' : IDL.Text,
  });
  const Result_47 = IDL.Variant({ 'ok' : ProjectExport, 'err' : IDL.Text });
  const DownloadToken = IDL.Record({
    'exportId' : IDL.Text,
    'lastUsedAt' : IDL.Opt(IDL.Nat64),
    'tokenId' : IDL.Text,
    'expiresAt' : IDL.Nat64,
    'isRevoked' : IDL.Bool,
    'createdAt' : IDL.Nat64,
    'maxDownloads' : IDL.Nat,
    'projectId' : IDL.Text,
    'downloadCount' : IDL.Nat,
    'buyer' : IDL.Principal,
    'purchaseId' : IDL.Text,
    'revokedAt' : IDL.Opt(IDL.Nat64),
    'revokedReason' : IDL.Opt(IDL.Text),
  });
  const Result_46 = IDL.Variant({ 'ok' : DownloadToken, 'err' : IDL.Text });
  const AIUsageRecord = IDL.Record({
    'model' : IDL.Text,
    'tokensUsed' : IDL.Nat,
    'creditsDeducted' : IDL.Nat,
    'inputTokens' : IDL.Nat,
    'projectId' : IDL.Text,
    'outputTokens' : IDL.Nat,
    'operation' : IDL.Text,
    'timestamp' : Timestamp,
  });
  const Result_45 = IDL.Variant({ 'ok' : APICredential, 'err' : IDL.Text });
  const Result_44 = IDL.Variant({
    'ok' : IDL.Vec(APIEndpoint),
    'err' : IDL.Text,
  });
  const DeploymentReference__1 = IDL.Record({
    'id' : IDL.Text,
    'status' : IDL.Text,
    'name' : IDL.Text,
    'lastUpdated' : Timestamp,
    'network' : IDL.Text,
    'projectId' : IDL.Text,
    'canisterId' : IDL.Opt(IDL.Principal),
  });
  const TemplateReference = IDL.Record({
    'id' : IDL.Text,
    'name' : IDL.Text,
    'salesCount' : IDL.Nat,
    'price' : IDL.Opt(IDL.Nat64),
    'visibility' : Visibility,
  });
  const ProjectReference = IDL.Record({
    'id' : IDL.Text,
    'name' : IDL.Text,
    'lastModified' : Timestamp,
    'visibility' : Visibility,
  });
  const AccountResources = IDL.Record({
    'deployments' : IDL.Vec(DeploymentReference__1),
    'templates' : IDL.Vec(TemplateReference),
    'projects' : IDL.Vec(ProjectReference),
  });
  const ActivityLog = IDL.Record({
    'activityType' : IDL.Text,
    'timestamp' : Timestamp,
    'details' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
  });
  const AccountStats = IDL.Record({
    'billingCycleEnd' : IDL.Opt(IDL.Nat64),
    'aiCreditsUsed' : IDL.Nat,
    'storageUsed' : IDL.Nat64,
    'subscriptionTier' : IDL.Text,
    'reputation' : IDL.Nat,
    'templatesPublished' : IDL.Nat,
    'stripeCustomerId' : IDL.Opt(IDL.Text),
    'subscriptionActive' : IDL.Bool,
    'projectsCreated' : IDL.Nat,
    'totalRevenue' : IDL.Nat64,
    'aiCreditsAllocated' : IDL.Nat,
    'templatesSold' : IDL.Nat,
    'cyclesBalance' : IDL.Nat64,
    'lastActive' : Timestamp,
    'activity' : IDL.Vec(ActivityLog),
    'monthlyAIUsage' : IDL.Nat,
    'lastAICreditsRefresh' : Timestamp,
    'aiCreditsBalance' : IDL.Nat,
  });
  const NotificationSettings = IDL.Record({
    'enabled' : IDL.Bool,
    'muteTimeEnd' : IDL.Opt(IDL.Nat64),
    'eventTypes' : IDL.Vec(IDL.Text),
    'customSettings' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'frequency' : IDL.Opt(IDL.Text),
    'muteTimeStart' : IDL.Opt(IDL.Nat64),
  });
  const DiscordConfig = IDL.Record({
    'channelId' : IDL.Text,
    'notificationSettings' : NotificationSettings,
    'serverId' : IDL.Text,
    'webhookUrl' : IDL.Text,
  });
  const TelegramConfig = IDL.Record({
    'botEnabled' : IDL.Bool,
    'notificationSettings' : NotificationSettings,
    'chatId' : IDL.Text,
  });
  const WebhookConfig = IDL.Record({
    'id' : IDL.Text,
    'url' : IDL.Text,
    'active' : IDL.Bool,
    'secret' : IDL.Text,
    'events' : IDL.Vec(IDL.Text),
  });
  const GitHubConfig = IDL.Record({
    'webhookConfigs' : IDL.Vec(WebhookConfig),
    'tokenExpiry' : Timestamp,
    'accessToken' : IDL.Text,
    'connectedRepositories' : IDL.Vec(IDL.Text),
  });
  const ExternalServiceTokens = IDL.Record({
    'discord' : IDL.Opt(DiscordConfig),
    'telegram' : IDL.Opt(TelegramConfig),
    'github' : IDL.Opt(GitHubConfig),
  });
  const NotificationPreferences = IDL.Record({
    'channelPreferences' : IDL.Record({
      'email' : IDL.Bool,
      'discord' : IDL.Bool,
      'inApp' : IDL.Bool,
      'telegram' : IDL.Bool,
    }),
    'notificationTypes' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Bool))),
    'digestFrequency' : IDL.Opt(IDL.Text),
  });
  const DeploymentPreferences = IDL.Record({
    'cyclesRequirement' : IDL.Nat64,
    'network' : IDL.Text,
    'replica' : IDL.Text,
    'automaticDeployment' : IDL.Bool,
  });
  const ProjectFramework = IDL.Variant({
    'Vue' : IDL.Null,
    'Custom' : IDL.Text,
    'React' : IDL.Null,
    'Motoko' : IDL.Null,
  });
  const ProjectCategory = IDL.Variant({
    'Frontend' : IDL.Null,
    'FullStack' : IDL.Null,
    'Backend' : IDL.Null,
  });
  const ProjectType = IDL.Record({
    'framework' : ProjectFramework,
    'category' : ProjectCategory,
  });
  const AccessControlPreferences = IDL.Record({
    'allowedUsers' : IDL.Vec(IDL.Principal),
    'allowedRoles' : IDL.Vec(IDL.Text),
    'restrictedActions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Text))),
    'visibility' : IDL.Text,
  });
  const BuildPreferences = IDL.Record({
    'artifacts' : IDL.Vec(IDL.Text),
    'variables' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'environment' : IDL.Text,
    'commands' : IDL.Vec(IDL.Text),
  });
  const VisibilityType = IDL.Variant({
    'Contacts' : IDL.Null,
    'Private' : IDL.Null,
    'Public' : IDL.Null,
  });
  const ProjectPreferences = IDL.Record({
    'deploymentPreferences' : IDL.Opt(DeploymentPreferences),
    'projectType' : ProjectType,
    'defaultPreferences' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'accessPreferences' : IDL.Opt(AccessControlPreferences),
    'buildPreferences' : IDL.Opt(BuildPreferences),
    'visibility' : VisibilityType,
  });
  const AccountPreferences = IDL.Record({
    'timezone' : IDL.Opt(IDL.Text),
    'notificationPreferences' : NotificationPreferences,
    'customPreferences' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'defaultProjectPreferences' : IDL.Opt(ProjectPreferences),
    'defaultVisibility' : Visibility,
    'sessionTimeout' : IDL.Opt(IDL.Nat64),
  });
  const AccountType = IDL.Variant({
    'Premium' : IDL.Null,
    'Enterprise' : IDL.Null,
    'Basic' : IDL.Null,
    'Custom' : IDL.Text,
  });
  const CanisterType = IDL.Variant({
    'Frontend' : IDL.Null,
    'Custom' : IDL.Text,
    'Asset' : IDL.Null,
    'Backend' : IDL.Null,
  });
  const CanisterSettings = IDL.Record({
    'duration' : IDL.Opt(IDL.Nat),
    'controllers' : IDL.Vec(IDL.Principal),
    'canisterType' : CanisterType,
    'freezingThreshold' : IDL.Nat,
    'name' : IDL.Text,
    'initialCycles' : IDL.Nat64,
    'memoryAllocation' : IDL.Nat,
    'computeAllocation' : IDL.Nat,
  });
  const AccountInfo = IDL.Record({
    'lastAccessed' : Timestamp,
    'createdAt' : Timestamp,
    'externalServices' : IDL.Opt(ExternalServiceTokens),
    'preferences' : IDL.Opt(AccountPreferences),
    'accountType' : AccountType,
    'firstLoginAt' : IDL.Opt(Timestamp),
    'canisterSettings' : IDL.Opt(CanisterSettings),
    'hasCompletedOnboarding' : IDL.Bool,
  });
  const CollaboratorStatus = IDL.Variant({
    'Invited' : IDL.Null,
    'Active' : IDL.Null,
    'Removed' : IDL.Null,
  });
  const Collaborator = IDL.Record({
    'status' : CollaboratorStatus,
    'permissions' : IDL.Vec(IDL.Text),
    'principal' : IDL.Principal,
    'expiresAt' : IDL.Opt(Timestamp),
    'role' : RoleType,
    'addedAt' : Timestamp,
  });
  const Account = IDL.Record({
    'id' : IDL.Principal,
    'created' : Timestamp,
    'owner' : IDL.Principal,
    'resources' : AccountResources,
    'stats' : AccountStats,
    'accountInfo' : AccountInfo,
    'collaborators' : IDL.Vec(Collaborator),
  });
  const Result_43 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
  const Result_42 = IDL.Variant({ 'ok' : AgentCredentials, 'err' : IDL.Text });
  const Result_41 = IDL.Variant({
    'ok' : IDL.Vec(APICredential),
    'err' : IDL.Text,
  });
  const Result_40 = IDL.Variant({
    'ok' : IDL.Vec(AgentCredentials),
    'err' : IDL.Text,
  });
  const Result_39 = IDL.Variant({
    'ok' : IDL.Vec(DatabaseCredential),
    'err' : IDL.Text,
  });
  const Result_28 = IDL.Variant({
    'ok' : IDL.Vec(EnvironmentConfig),
    'err' : IDL.Text,
  });
  const Result_38 = IDL.Variant({
    'ok' : IDL.Record({
      'references' : IDL.Vec(ReferenceItem),
      'designInspirations' : IDL.Vec(DesignInspiration),
      'documentationItems' : IDL.Vec(DocumentationItem),
      'codeTemplates' : IDL.Vec(CodeTemplate),
      'colorPalettes' : IDL.Vec(ColorPalette),
      'codeRules' : IDL.Vec(CodeRule),
      'gitHubGuidelines' : IDL.Vec(GitHubGuideline),
      'apiEndpoints' : IDL.Vec(APIEndpoint),
    }),
    'err' : IDL.Text,
  });
  const Chunk = IDL.Record({
    'id' : ChunkId,
    'content' : IDL.Vec(IDL.Nat8),
    'size' : IDL.Nat,
  });
  const Result_36 = IDL.Variant({ 'ok' : IDL.Vec(CodeRule), 'err' : IDL.Text });
  const Result_35 = IDL.Variant({
    'ok' : IDL.Vec(CodeTemplate),
    'err' : IDL.Text,
  });
  const Result_34 = IDL.Variant({
    'ok' : IDL.Vec(ColorPalette),
    'err' : IDL.Text,
  });
  const Result_33 = IDL.Variant({
    'ok' : DatabaseCredential,
    'err' : IDL.Text,
  });
  const Result_32 = IDL.Variant({
    'ok' : IDL.Record({
      'lastFrontendDeployment' : IDL.Opt(IDL.Nat64),
      'hasFrontendChanged' : IDL.Bool,
      'lastDeploymentServerPairId' : IDL.Opt(IDL.Text),
      'lastBackendDeployment' : IDL.Opt(IDL.Nat64),
      'hasBackendChanged' : IDL.Bool,
    }),
    'err' : IDL.Text,
  });
  const Result_31 = IDL.Variant({
    'ok' : IDL.Vec(DesignInspiration),
    'err' : IDL.Text,
  });
  const Result_30 = IDL.Variant({
    'ok' : IDL.Vec(DocumentationItem),
    'err' : IDL.Text,
  });
  const DownloadLog = IDL.Record({
    'exportId' : IDL.Text,
    'tokenId' : IDL.Text,
    'errorMessage' : IDL.Opt(IDL.Text),
    'downloadedAt' : IDL.Nat64,
    'success' : IDL.Bool,
    'buyer' : IDL.Principal,
    'userAgent' : IDL.Opt(IDL.Text),
    'ipAddress' : IDL.Opt(IDL.Text),
  });
  const Result_29 = IDL.Variant({ 'ok' : EnvironmentConfig, 'err' : IDL.Text });
  const FileShareLink = IDL.Record({
    'token' : IDL.Text,
    'expiresAt' : IDL.Opt(IDL.Nat64),
    'isRevoked' : IDL.Bool,
    'createdAt' : IDL.Nat64,
    'createdBy' : IDL.Principal,
    'fileId' : IDL.Text,
    'maxDownloads' : IDL.Opt(IDL.Nat),
    'downloadCount' : IDL.Nat,
    'revokedAt' : IDL.Opt(IDL.Nat64),
    'linkId' : IDL.Text,
  });
  const Result_27 = IDL.Variant({
    'ok' : IDL.Vec(GitHubGuideline),
    'err' : IDL.Text,
  });
  const LoggerConfig = IDL.Record({
    'retentionDays' : IDL.Nat,
    'maxSize' : IDL.Nat,
  });
  const Result_26 = IDL.Variant({ 'ok' : Project, 'err' : IDL.Text });
  const Result_25 = IDL.Variant({
    'ok' : IDL.Vec(DeployedAgent),
    'err' : IDL.Text,
  });
  const FileMetadata = IDL.Record({
    'id' : IDL.Text,
    'path' : IDL.Text,
    'size' : IDL.Nat,
    'isChunked' : IDL.Bool,
    'mimeType' : IDL.Text,
    'fileName' : IDL.Text,
    'lastModified' : IDL.Int,
    'language' : IDL.Text,
    'version' : IDL.Nat,
    'projectId' : IDL.Text,
    'chunkCount' : IDL.Opt(IDL.Nat),
  });
  const Result_24 = IDL.Variant({
    'ok' : IDL.Vec(FileMetadata),
    'err' : IDL.Text,
  });
  FileTreeNode.fill(
    IDL.Record({
      'name' : IDL.Text,
      'path' : IDL.Text,
      'children' : IDL.Opt(IDL.Vec(FileTreeNode)),
      'isDirectory' : IDL.Bool,
    })
  );
  const Result_23 = IDL.Variant({ 'ok' : FileTreeNode, 'err' : IDL.Text });
  const Result_21 = IDL.Variant({
    'ok' : IDL.Vec(ChatMessage),
    'err' : IDL.Text,
  });
  const Result_20 = IDL.Variant({ 'ok' : ProjectMetadata, 'err' : IDL.Text });
  const ServerPair = IDL.Record({
    'creditsAllocated' : IDL.Nat,
    'frontendCanisterId' : IDL.Principal,
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'backendCanisterId' : IDL.Principal,
    'pairId' : IDL.Text,
  });
  const Result_19 = IDL.Variant({
    'ok' : IDL.Vec(ServerPair),
    'err' : IDL.Text,
  });
  const Result_18 = IDL.Variant({
    'ok' : IDL.Record({
      'totalFiles' : IDL.Nat,
      'totalEstimatedSize' : IDL.Nat,
      'largeFiles' : IDL.Nat,
      'textFiles' : IDL.Nat,
      'averageFileSize' : IDL.Nat,
      'recommendedBatchSize' : IDL.Nat,
      'binaryFiles' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const Result_17 = IDL.Variant({
    'ok' : IDL.Vec(ProjectVersion),
    'err' : IDL.Text,
  });
  const BackgroundStyle = IDL.Variant({
    'Gradient' : IDL.Tuple(IDL.Text, IDL.Text),
    'Solid' : IDL.Text,
    'Image' : IDL.Text,
    'Default' : IDL.Null,
  });
  const ProfileTheme = IDL.Record({
    'primaryColor' : IDL.Text,
    'backgroundStyle' : BackgroundStyle,
    'accentColor' : IDL.Text,
  });
  const SocialLinks = IDL.Record({
    'linkedin' : IDL.Opt(IDL.Text),
    'twitter' : IDL.Opt(IDL.Text),
    'custom' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'discord' : IDL.Opt(IDL.Text),
    'youtube' : IDL.Opt(IDL.Text),
    'telegram' : IDL.Opt(IDL.Text),
    'github' : IDL.Opt(IDL.Text),
    'medium' : IDL.Opt(IDL.Text),
  });
  const CustomSection = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'content' : IDL.Text,
    'order' : IDL.Nat,
    'icon' : IDL.Text,
    'isVisible' : IDL.Bool,
  });
  const PublicProfile = IDL.Record({
    'bio' : IDL.Opt(IDL.Text),
    'timezone' : IDL.Opt(IDL.Text),
    'theme' : IDL.Opt(ProfileTheme),
    'title' : IDL.Opt(IDL.Text),
    'displayName' : IDL.Opt(IDL.Text),
    'tagline' : IDL.Opt(IDL.Text),
    'interests' : IDL.Vec(IDL.Text),
    'socialLinks' : SocialLinks,
    'featuredProjects' : IDL.Vec(IDL.Text),
    'createdAt' : Timestamp,
    'email' : IDL.Opt(IDL.Text),
    'website' : IDL.Opt(IDL.Text),
    'updatedAt' : Timestamp,
    'company' : IDL.Opt(IDL.Text),
    'avatarUrl' : IDL.Opt(IDL.Text),
    'showStats' : IDL.Bool,
    'bannerUrl' : IDL.Opt(IDL.Text),
    'isPublic' : IDL.Bool,
    'profileViews' : IDL.Nat,
    'showMarketplace' : IDL.Bool,
    'skills' : IDL.Vec(IDL.Text),
    'customSections' : IDL.Vec(CustomSection),
    'location' : IDL.Opt(IDL.Text),
  });
  const PublicProfileStats = IDL.Record({
    'totalDeployments' : IDL.Nat,
    'totalProjects' : IDL.Nat,
    'marketplaceListings' : IDL.Nat,
    'joinedDate' : Timestamp,
    'profileViews' : IDL.Nat,
  });
  const Result_16 = IDL.Variant({
    'ok' : IDL.Vec(ReferenceItem),
    'err' : IDL.Text,
  });
  const SecurityResult = IDL.Variant({
    'Blocked' : IDL.Text,
    'Success' : IDL.Null,
    'Failure' : IDL.Text,
  });
  const SecurityAction = IDL.Variant({
    'PermissionChanged' : IDL.Null,
    'CredentialUpdated' : IDL.Null,
    'Custom' : IDL.Text,
    'APIKeyUsed' : IDL.Null,
    'CredentialRotated' : IDL.Null,
    'CredentialCreated' : IDL.Null,
    'CredentialDeleted' : IDL.Null,
    'TokenRefreshed' : IDL.Null,
    'CredentialAccessed' : IDL.Null,
    'UnauthorizedAccess' : IDL.Null,
    'EnvironmentVariableAccessed' : IDL.Null,
  });
  const SecurityAuditLog = IDL.Record({
    'result' : SecurityResult,
    'action' : SecurityAction,
    'metadata' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'resourceId' : IDL.Text,
    'userId' : IDL.Principal,
    'resourceType' : IDL.Text,
    'timestamp' : IDL.Nat64,
  });
  const Result_15 = IDL.Variant({
    'ok' : IDL.Vec(SecurityAuditLog),
    'err' : IDL.Text,
  });
  const Subscription = IDL.Record({
    'monthlyAllocation' : IDL.Nat,
    'tier' : IDL.Text,
    'isActive' : IDL.Bool,
    'billingCycleStart' : Timestamp,
    'autoRefresh' : IDL.Bool,
  });
  const VisibilityPreferences = IDL.Record({
    'projects' : Visibility,
    'stats' : Visibility,
    'activity' : Visibility,
    'profile' : Visibility,
  });
  const UserPreferences = IDL.Record({
    'theme' : IDL.Opt(IDL.Text),
    'notifications' : NotificationPreferences,
    'customPreferences' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'defaultProjectPreferences' : IDL.Opt(ProjectPreferences),
    'visibility' : VisibilityPreferences,
  });
  const ImageAsset = IDL.Record({
    'height' : IDL.Opt(IDL.Nat),
    'data' : IDL.Vec(IDL.Nat8),
    'name' : IDL.Text,
    'mimeType' : IDL.Text,
    'sizeBytes' : IDL.Nat,
    'width' : IDL.Opt(IDL.Nat),
    'uploadedAt' : IDL.Nat64,
  });
  const UserSocials = IDL.Record({
    'twitter' : IDL.Opt(IDL.Text),
    'discord' : IDL.Opt(IDL.Text),
    'telegram' : IDL.Opt(IDL.Text),
    'openchat' : IDL.Opt(IDL.Text),
  });
  const UserProfile = IDL.Record({
    'bio' : IDL.Opt(IDL.Text),
    'coverPhotoAsset' : IDL.Opt(ImageAsset),
    'username' : IDL.Text,
    'displayName' : IDL.Opt(IDL.Text),
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'socials' : IDL.Opt(UserSocials),
    'avatarAsset' : IDL.Opt(ImageAsset),
    'email' : IDL.Opt(IDL.Text),
    'website' : IDL.Opt(IDL.Text),
    'coverPhoto' : IDL.Opt(IDL.Text),
    'github' : IDL.Opt(IDL.Text),
    'avatar' : IDL.Opt(IDL.Text),
  });
  const User = IDL.Record({
    'id' : IDL.Principal,
    'primaryAccountId' : IDL.Opt(IDL.Principal),
    'created' : IDL.Nat64,
    'preferences' : IDL.Opt(UserPreferences),
    'linkedAccounts' : IDL.Vec(IDL.Principal),
    'lastActive' : IDL.Nat64,
    'profile' : UserProfile,
  });
  const Metadata = IDL.Record({
    'balance' : IDL.Nat,
    'cycleBalance' : IDL.Nat64,
    'moduleHash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'lastUpdated' : IDL.Nat64,
    'totalKeys' : IDL.Nat,
    'memoryUsage' : IDL.Nat64,
    'version' : IDL.Text,
    'uptime' : IDL.Nat64,
    'totalUsers' : IDL.Nat,
    'idleCyclesBurnedPerDay' : IDL.Nat,
    'stableStateSize' : IDL.Nat,
    'stableMemoryUsage' : IDL.Nat,
    'heapMemoryUsage' : IDL.Nat64,
    'memorySize' : IDL.Nat,
  });
  const TransactionType = IDL.Variant({
    'sent' : IDL.Null,
    'canister' : IDL.Null,
    'received' : IDL.Null,
  });
  const Transaction = IDL.Record({
    'transactionType' : TransactionType,
    'isPositive' : IDL.Bool,
    'memo' : IDL.Opt(IDL.Text),
    'counterparty' : IDL.Text,
    'timestamp' : IDL.Int,
    'amount' : IDL.Nat,
  });
  const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
  });
  const StreamingCallbackToken = IDL.Record({
    'exportId' : IDL.Text,
    'tokenId' : IDL.Text,
    'chunkIndex' : IDL.Nat,
  });
  const StreamingCallbackResponse = IDL.Record({
    'token' : IDL.Opt(StreamingCallbackToken),
    'body' : IDL.Vec(IDL.Nat8),
  });
  const StreamingStrategy = IDL.Variant({
    'Callback' : IDL.Record({
      'token' : StreamingCallbackToken,
      'callback' : IDL.Func(
          [StreamingCallbackToken],
          [StreamingCallbackResponse],
          ['query'],
        ),
    }),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
    'streaming_strategy' : IDL.Opt(StreamingStrategy),
    'status_code' : IDL.Nat16,
  });
  const Result_5 = IDL.Variant({ 'ok' : User, 'err' : IDL.Text });
  const Result_12 = IDL.Variant({
    'ok' : IDL.Record({
      'totalFiles' : IDL.Nat,
      'totalBatches' : IDL.Nat,
      'sessionId' : IDL.Text,
      'batchSize' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const Result_11 = IDL.Variant({
    'ok' : IDL.Record({
      'totalSize' : IDL.Nat,
      'totalChunks' : IDL.Nat,
      'chunkSize' : IDL.Nat,
      'sessionId' : IDL.Text,
    }),
    'err' : IDL.Text,
  });
  const Result_10 = IDL.Variant({ 'ok' : Account, 'err' : IDL.Text });
  const Result_2 = IDL.Variant({
    'ok' : IDL.Record({ 'completed' : IDL.Bool, 'progress' : IDL.Nat }),
    'err' : IDL.Text,
  });
  const Result = IDL.Variant({
    'ok' : IDL.Record({ 'receivedChunks' : IDL.Nat, 'totalChunks' : IDL.Nat }),
    'err' : IDL.Text,
  });
  return IDL.Service({
    'addAPICredential' : IDL.Func([APICredential], [Result_4], []),
    'addAPIEndpoint' : IDL.Func([APIEndpoint], [Result_4], []),
    'addAgentCredentials' : IDL.Func([AgentCredentials], [Result_4], []),
    'addCanisterMetadata' : IDL.Func([IDL.Principal, CanisterMetadata], [], []),
    'addCanisterToProject' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'addCodeRule' : IDL.Func([CodeRule], [Result_4], []),
    'addCodeTemplate' : IDL.Func([CodeTemplate], [Result_4], []),
    'addCollaborator' : IDL.Func(
        [IDL.Principal, RoleType, IDL.Vec(IDL.Text), IDL.Opt(Timestamp)],
        [Result_4],
        [],
      ),
    'addColorPalette' : IDL.Func([ColorPalette], [Result_4], []),
    'addDatabaseCredential' : IDL.Func([DatabaseCredential], [Result_4], []),
    'addDeployedAgentToProject' : IDL.Func(
        [IDL.Text, DeployedAgent],
        [Result_4],
        [],
      ),
    'addDeploymentToAccount' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Opt(IDL.Principal),
          IDL.Text,
          IDL.Text,
        ],
        [Result_4],
        [],
      ),
    'addDeploymentToVersion' : IDL.Func(
        [IDL.Text, DeploymentReference],
        [Result_3],
        [],
      ),
    'addDesignInspiration' : IDL.Func([DesignInspiration], [Result_4], []),
    'addDocumentationItem' : IDL.Func([DocumentationItem], [Result_4], []),
    'addEnvironmentConfig' : IDL.Func([EnvironmentConfig], [Result_4], []),
    'addExternalService' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))],
        [Result_4],
        [],
      ),
    'addGitHubGuideline' : IDL.Func([GitHubGuideline], [Result_4], []),
    'addGitHubWebhook' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Text)],
        [Result_7],
        [],
      ),
    'addMessageToProject' : IDL.Func(
        [IDL.Text, IDL.Text, ChatMessageType, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'addNpmPackageToProject' : IDL.Func(
        [IDL.Text, NPMPackageInfo],
        [Result_7],
        [],
      ),
    'addPackageToProject' : IDL.Func(
        [IDL.Text, PackageInfo, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'addProjectToAccount' : IDL.Func(
        [IDL.Text, IDL.Text, Visibility],
        [Result_4],
        [],
      ),
    'addReferenceItem' : IDL.Func([ReferenceItem], [Result_4], []),
    'cleanOldLogs' : IDL.Func([], [], []),
    'cleanupExpiredSessions' : IDL.Func([], [], ['oneway']),
    'cleanupProjectFilesDownloadSession' : IDL.Func([IDL.Text], [Result_7], []),
    'cleanupWasmDownloadSession' : IDL.Func([IDL.Text], [Result_7], []),
    'clearAllLogs' : IDL.Func([], [IDL.Nat], []),
    'clearBackendChangedFlag' : IDL.Func([IDL.Text], [Result_4], []),
    'clearFrontendChangedFlag' : IDL.Func([IDL.Text], [Result_4], []),
    'clearProjectMessages' : IDL.Func([IDL.Text], [Result_4], []),
    'completeFileUpload' : IDL.Func(
        [
          IDL.Text,
          FileVisibility,
          IDL.Vec(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_1],
        [],
      ),
    'completeOnboarding' : IDL.Func([], [Result_6], []),
    'completeSubscriptionSetup' : IDL.Func(
        [IDL.Text, IDL.Bool, IDL.Nat64, IDL.Text, IDL.Nat],
        [Result_4],
        [],
      ),
    'copyVersionArtifacts' : IDL.Func([IDL.Text, IDL.Text], [Result_3], []),
    'createCanisterWithSettings' : IDL.Func(
        [
          IDL.Principal,
          IDL.Nat,
          IDL.Nat,
          IDL.Opt(IDL.Nat),
          IDL.Nat,
          IDL.Nat,
          IDL.Text,
          IDL.Text,
        ],
        [Result_7],
        [],
      ),
    'createCodeArtifact' : IDL.Func(
        [
          IDL.Principal,
          IDL.Text,
          IDL.Text,
          FileContent,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Opt(IDL.Text),
        ],
        [Result_9],
        [],
      ),
    'createCodeArtifactForVersion' : IDL.Func(
        [
          IDL.Principal,
          IDL.Text,
          IDL.Text,
          FileContent,
          IDL.Text,
          IDL.Text,
          IDL.Text,
        ],
        [Result_14],
        [],
      ),
    'createFileShareLink' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Nat), IDL.Opt(IDL.Nat)],
        [Result_51],
        [],
      ),
    'createMarketplaceListing' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Text,
        ],
        [Result_8],
        [],
      ),
    'createMultipleCodeArtifacts' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Vec(FileData), IDL.Opt(IDL.Text)],
        [Result_22],
        [],
      ),
    'createProject' : IDL.Func([Project, IDL.Opt(IDL.Bool)], [Result_7], []),
    'createProjectVersion' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat,
          IDL.Nat,
          IDL.Nat,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_3],
        [],
      ),
    'createServerPair' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Principal, IDL.Principal, IDL.Nat],
        [Result_7],
        [],
      ),
    'createUserWallet' : IDL.Func([], [IDL.Text], []),
    'createVersionArtifacts' : IDL.Func(
        [IDL.Text, IDL.Vec(ArtifactFile)],
        [Result_13],
        [],
      ),
    'deductAICredits' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat, IDL.Text, IDL.Text],
        [Result_37],
        [],
      ),
    'deleteAPICredential' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteAPIEndpoint' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteAgentCredentials' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteCanister' : IDL.Func([IDL.Principal], [Result_7], []),
    'deleteCodeArtifact' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'deleteCodeRule' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteCodeTemplate' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteColorPalette' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteDatabaseCredential' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteDeployment' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'deleteDesignInspiration' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteDocumentationItem' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteEnvironmentConfig' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteGitHubGuideline' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteMarketplaceListing' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteProject' : IDL.Func([IDL.Text], [Result_7], []),
    'deleteProjectExport' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteProjectFile' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteProjectFromAccount' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteProjectVersion' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteReferenceItem' : IDL.Func([IDL.Text], [Result_4], []),
    'deleteServerPair' : IDL.Func([IDL.Text], [Result_4], []),
    'deployStoredWasm' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Principal,
          IDL.Text,
          IDL.Text,
          IDL.Principal,
          IDL.Opt(CanisterMetadata),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_7],
        [],
      ),
    'deployToExistingCanister' : IDL.Func(
        [
          IDL.Principal,
          IDL.Vec(IDL.Nat8),
          IDL.Text,
          IDL.Text,
          IDL.Principal,
          IDL.Opt(CanisterMetadata),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_7],
        [],
      ),
    'downloadLargeFileIndividually' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_50],
        [],
      ),
    'downloadProjectFilesBatch' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [Result_49],
        [],
      ),
    'downloadWasmChunk' : IDL.Func([IDL.Text, IDL.Nat], [Result_48], []),
    'exportProject' : IDL.Func([IDL.Text], [Result_47], []),
    'finalizeWasmUpload' : IDL.Func([IDL.Text], [Result_7], []),
    'generateDownloadToken' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Principal],
        [Result_46],
        [],
      ),
    'getAICreditsBalance' : IDL.Func([], [IDL.Nat], ['query']),
    'getAIUsageHistory' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(AIUsageRecord)],
        ['query'],
      ),
    'getAIUsageThisMonth' : IDL.Func([], [IDL.Nat], ['query']),
    'getAPICredential' : IDL.Func([IDL.Text], [Result_45], []),
    'getAPIEndpoints' : IDL.Func([], [Result_44], []),
    'getAccountDetails' : IDL.Func([], [IDL.Opt(Account)], ['query']),
    'getAccountIdByUsername' : IDL.Func([IDL.Text], [Result_43], []),
    'getAgentCredentials' : IDL.Func([IDL.Text], [Result_42], []),
    'getAllAPICredentials' : IDL.Func([], [Result_41], []),
    'getAllAgentCredentials' : IDL.Func([], [Result_40], []),
    'getAllDatabaseCredentials' : IDL.Func([], [Result_39], []),
    'getAllEnvironmentConfigs' : IDL.Func([], [Result_28], []),
    'getAllUserContext' : IDL.Func([], [Result_38], []),
    'getBillingCycleEnd' : IDL.Func([], [IDL.Opt(IDL.Nat64)], ['query']),
    'getCanisterBalance' : IDL.Func([IDL.Principal], [Result_37], []),
    'getCanisterMetadata' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(CanisterMetadata)],
        [],
      ),
    'getCanisterStatus' : IDL.Func([IDL.Principal], [Result_7], []),
    'getChunk' : IDL.Func([ChunkId], [IDL.Opt(Chunk)], []),
    'getChunksBatch' : IDL.Func(
        [IDL.Vec(IDL.Nat)],
        [IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Opt(Chunk)))],
        [],
      ),
    'getCodeRules' : IDL.Func([], [Result_36], []),
    'getCodeTemplates' : IDL.Func([], [Result_35], []),
    'getColorPalettes' : IDL.Func([], [Result_34], []),
    'getCycleBalance' : IDL.Func([], [IDL.Nat], []),
    'getDatabaseCredential' : IDL.Func([IDL.Text], [Result_33], []),
    'getDeploymentFlags' : IDL.Func([IDL.Text], [Result_32], ['query']),
    'getDesignInspirations' : IDL.Func([], [Result_31], []),
    'getDocumentationItems' : IDL.Func([], [Result_30], []),
    'getDownloadLogs' : IDL.Func([IDL.Text], [IDL.Vec(DownloadLog)], ['query']),
    'getDownloadToken' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(DownloadToken)],
        ['query'],
      ),
    'getEnvironmentConfig' : IDL.Func([IDL.Text], [Result_29], []),
    'getEnvironmentConfigsByProject' : IDL.Func([IDL.Text], [Result_28], []),
    'getExternalServices' : IDL.Func(
        [],
        [IDL.Opt(ExternalServiceTokens)],
        ['query'],
      ),
    'getFeaturedProjects' : IDL.Func([], [IDL.Vec(Project)], ['query']),
    'getFileDownloadSystemHealth' : IDL.Func(
        [],
        [
          IDL.Record({
            'recommendedAction' : IDL.Text,
            'activeSessions' : IDL.Nat,
            'systemStatus' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'getFileShareLinks' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(FileShareLink)],
        ['query'],
      ),
    'getGitHubGuidelines' : IDL.Func([], [Result_27], []),
    'getLatestProjectVersion' : IDL.Func([IDL.Text], [Result_3], []),
    'getLinkedAccounts' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'getLoggerConfig' : IDL.Func([], [LoggerConfig], ['query']),
    'getLogs' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'getLogsByLevel' : IDL.Func([IDL.Text], [IDL.Vec(IDL.Text)], ['query']),
    'getMarketplaceListing' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(MarketplaceListing)],
        ['query'],
      ),
    'getNewLogsSince' : IDL.Func(
        [IDL.Nat, IDL.Opt(IDL.Nat)],
        [IDL.Record({ 'logs' : IDL.Vec(IDL.Text), 'nextMarker' : IDL.Nat })],
        ['query'],
      ),
    'getOnboardingStatus' : IDL.Func(
        [],
        [
          IDL.Record({
            'accountCreatedAt' : IDL.Opt(IDL.Nat64),
            'firstLoginAt' : IDL.Opt(IDL.Nat64),
            'hasCompletedOnboarding' : IDL.Bool,
          }),
        ],
        ['query'],
      ),
    'getProject' : IDL.Func([IDL.Text], [Result_26], []),
    'getProjectDeployedAgents' : IDL.Func([IDL.Text], [Result_25], []),
    'getProjectExport' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(ProjectExport)],
        ['query'],
      ),
    'getProjectExports' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(ProjectExport)],
        ['query'],
      ),
    'getProjectFileMetadata' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_24],
        [],
      ),
    'getProjectFileTree' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_23],
        [],
      ),
    'getProjectFiles' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_22],
        [],
      ),
    'getProjectMessages' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Nat), IDL.Opt(IDL.Nat)],
        [Result_21],
        ['query'],
      ),
    'getProjectMetadata' : IDL.Func([IDL.Text], [Result_20], ['query']),
    'getProjectServerPairs' : IDL.Func([IDL.Text], [Result_19], []),
    'getProjectStatistics' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_18],
        [],
      ),
    'getProjectVersion' : IDL.Func([IDL.Text], [Result_3], []),
    'getProjectVersions' : IDL.Func([IDL.Text], [Result_17], []),
    'getPublicProfile' : IDL.Func([], [IDL.Opt(PublicProfile)], ['query']),
    'getPublicProfileStats' : IDL.Func([], [PublicProfileStats], ['query']),
    'getReferenceItems' : IDL.Func([], [Result_16], []),
    'getSecurityAuditLogs' : IDL.Func([IDL.Opt(IDL.Nat)], [Result_15], []),
    'getSelectedProject' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'getSelectedServerPair' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'getStorageUsage' : IDL.Func([IDL.Text], [IDL.Nat], ['query']),
    'getStoredFile' : IDL.Func([IDL.Text], [IDL.Opt(StoredFile)], ['query']),
    'getStoredFiles' : IDL.Func([IDL.Text], [IDL.Vec(StoredFile)], ['query']),
    'getStoredFilesByCategory' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Vec(StoredFile)],
        ['query'],
      ),
    'getStripeCustomerId' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'getSubscriptionInfo' : IDL.Func([], [IDL.Opt(Subscription)], ['query']),
    'getSubscriptionTier' : IDL.Func([], [IDL.Text], ['query']),
    'getUIState' : IDL.Func(
        [],
        [
          IDL.Record({
            'selectedServerPair' : IDL.Opt(IDL.Text),
            'selectedProject' : IDL.Opt(IDL.Text),
          }),
        ],
        ['query'],
      ),
    'getUserAccountInfo' : IDL.Func([], [IDL.Opt(User)], ['query']),
    'getUserBalance' : IDL.Func([], [IDL.Nat], []),
    'getUserCanisters' : IDL.Func(
        [],
        [
          IDL.Vec(
            IDL.Record({
              'principal' : IDL.Principal,
              'canisterType' : IDL.Text,
              'name' : IDL.Text,
            })
          ),
        ],
        [],
      ),
    'getUserMarketplaceListings' : IDL.Func(
        [],
        [IDL.Vec(MarketplaceListing)],
        ['query'],
      ),
    'getUserProjects' : IDL.Func([], [IDL.Vec(Project)], ['query']),
    'getUserServerPairs' : IDL.Func([], [IDL.Vec(ServerPair)], ['query']),
    'getUserStateMetadata' : IDL.Func([], [Metadata], []),
    'getUserWalletId' : IDL.Func(
        [],
        [
          IDL.Opt(
            IDL.Record({
              'principal' : IDL.Text,
              'subaccount' : IDL.Text,
              'accountIdentifier' : IDL.Text,
            })
          ),
        ],
        ['query'],
      ),
    'getVersionArtifactFile' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [Result_14],
        [],
      ),
    'getVersionArtifacts' : IDL.Func([IDL.Text], [Result_13], []),
    'getVersionByString' : IDL.Func([IDL.Text, IDL.Text], [Result_3], []),
    'getWalletTransactions' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(Transaction)],
        ['query'],
      ),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'incrementProfileViews' : IDL.Func([], [], []),
    'initializeDefaultSubscription' : IDL.Func([], [Result_6], []),
    'initializeProjectVersion' : IDL.Func([IDL.Text], [Result_3], []),
    'initializeUserAccount' : IDL.Func([UserProfile], [Result_5], []),
    'isCanisterController' : IDL.Func([IDL.Principal], [IDL.Bool], []),
    'isFirstTimeUser' : IDL.Func([], [IDL.Bool], ['query']),
    'isModuleInstalled' : IDL.Func([IDL.Principal], [Result_6], []),
    'isSubscriptionActiveLocal' : IDL.Func([], [IDL.Bool], ['query']),
    'linkAccount' : IDL.Func([IDL.Principal], [Result_4], []),
    'logDebug' : IDL.Func([IDL.Text], [], []),
    'logError' : IDL.Func([IDL.Text], [], []),
    'logInfo' : IDL.Func([IDL.Text], [], []),
    'logWarn' : IDL.Func([IDL.Text], [], []),
    'markBackendChanged' : IDL.Func([IDL.Text], [Result_4], []),
    'markFirstLogin' : IDL.Func([], [Result_6], []),
    'markFrontendChanged' : IDL.Func([IDL.Text], [Result_4], []),
    'markProjectAccessed' : IDL.Func([IDL.Text], [Result_4], []),
    'markServerPairChanged' : IDL.Func([IDL.Text, IDL.Text], [Result_4], []),
    'migratePathsToStandard' : IDL.Func([], [], []),
    'moveServerPairToProject' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [Result_4],
        [],
      ),
    'promoteVersionToWorkingCopy' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Text, IDL.Bool],
        [Result_7],
        [],
      ),
    'readCodeArtifact' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_9],
        [],
      ),
    'refreshMonthlyAICredits' : IDL.Func([], [Result_6], []),
    'refundAICredits' : IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result_6], []),
    'removeCanisterFromProject' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'removeCanisterMetadata' : IDL.Func([IDL.Principal], [], []),
    'removeDeployedAgentFromProject' : IDL.Func(
        [IDL.Text, IDL.Text],
        [Result_4],
        [],
      ),
    'removeExternalService' : IDL.Func([IDL.Text], [Result_4], []),
    'removeNpmPackageFromProject' : IDL.Func(
        [IDL.Text, IDL.Text],
        [Result_7],
        [],
      ),
    'removePackageFromProject' : IDL.Func([IDL.Text, IDL.Text], [Result_7], []),
    'revokeDownloadToken' : IDL.Func([IDL.Text, IDL.Text], [Result_4], []),
    'revokeFileShareLink' : IDL.Func([IDL.Text], [Result_4], []),
    'sendICP' : IDL.Func(
        [IDL.Principal, IDL.Principal, IDL.Nat],
        [Result_7],
        [],
      ),
    'sendICPToAccountId' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Nat],
        [Result_7],
        [],
      ),
    'setLocalMode' : IDL.Func([IDL.Bool], [], []),
    'setPrimaryAccount' : IDL.Func([IDL.Principal], [Result_4], []),
    'setSelectedProject' : IDL.Func([IDL.Opt(IDL.Text)], [Result_4], []),
    'setSelectedServerPair' : IDL.Func([IDL.Opt(IDL.Text)], [Result_4], []),
    'setStripeCustomerId' : IDL.Func([IDL.Text], [Result_4], []),
    'setUIState' : IDL.Func(
        [IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
        [Result_4],
        [],
      ),
    'startCanister' : IDL.Func([IDL.Principal], [Result_7], []),
    'startFileUploadSession' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Nat, IDL.Nat],
        [Result_7],
        [],
      ),
    'startProjectFilesDownloadSession' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_12],
        [],
      ),
    'startWasmDownloadSession' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [Result_11],
        [],
      ),
    'startWasmUploadSession' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Nat,
          IDL.Nat,
          IDL.Opt(IDL.Principal),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_7],
        [],
      ),
    'stopCanister' : IDL.Func([IDL.Principal], [Result_7], []),
    'streamProjectChunk' : IDL.Func(
        [StreamingCallbackToken],
        [StreamingCallbackResponse],
        ['query'],
      ),
    'testLogSequence' : IDL.Func(
        [],
        [
          IDL.Record({
            'afterLog' : IDL.Nat,
            'before' : IDL.Nat,
            'afterIncrement' : IDL.Nat,
          }),
        ],
        [],
      ),
    'toggleMarketplaceForSale' : IDL.Func([IDL.Text, IDL.Bool], [Result_4], []),
    'topUpCanister' : IDL.Func([IDL.Principal, IDL.Float64], [Result_7], []),
    'topUpCanisterCMC' : IDL.Func(
        [IDL.Principal, IDL.Principal, IDL.Nat],
        [Result_7],
        [],
      ),
    'topUpExternalCanister' : IDL.Func([IDL.Text, IDL.Float64], [Result_7], []),
    'topUpSelf' : IDL.Func([IDL.Float64], [Result_7], []),
    'unlinkAccount' : IDL.Func([IDL.Principal], [Result_4], []),
    'updateAPICredential' : IDL.Func([APICredential], [Result_4], []),
    'updateAPIEndpoint' : IDL.Func([APIEndpoint], [Result_4], []),
    'updateAccountCanisterSettings' : IDL.Func(
        [CanisterSettings],
        [Result_4],
        [],
      ),
    'updateAccountCyclesBalance' : IDL.Func([IDL.Nat64], [Result_4], []),
    'updateAccountPreferences' : IDL.Func(
        [AccountPreferences],
        [Result_10],
        [],
      ),
    'updateAccountProject' : IDL.Func(
        [IDL.Text, IDL.Text, Visibility],
        [Result_4],
        [],
      ),
    'updateAccountType' : IDL.Func([AccountType], [Result_4], []),
    'updateAgentCredentials' : IDL.Func([AgentCredentials], [Result_4], []),
    'updateBillingCycleEnd' : IDL.Func([IDL.Nat64], [Result_4], []),
    'updateCanisterMetadata' : IDL.Func(
        [IDL.Principal, CanisterMetadata],
        [],
        [],
      ),
    'updateCanisterMetadataBC' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Text],
        [Result_7],
        [],
      ),
    'updateCodeArtifact' : IDL.Func(
        [
          IDL.Principal,
          IDL.Text,
          IDL.Text,
          FileContent,
          IDL.Text,
          IDL.Opt(IDL.Text),
        ],
        [Result_9],
        [],
      ),
    'updateCodeRule' : IDL.Func([CodeRule], [Result_4], []),
    'updateCodeTemplate' : IDL.Func([CodeTemplate], [Result_4], []),
    'updateCollaboratorStatus' : IDL.Func(
        [IDL.Principal, CollaboratorStatus],
        [Result_4],
        [],
      ),
    'updateColorPalette' : IDL.Func([ColorPalette], [Result_4], []),
    'updateDatabaseCredential' : IDL.Func([DatabaseCredential], [Result_4], []),
    'updateDeployedAgentInProject' : IDL.Func(
        [IDL.Text, DeployedAgent],
        [Result_4],
        [],
      ),
    'updateDeploymentStatus' : IDL.Func([IDL.Text, IDL.Text], [Result_4], []),
    'updateDeploymentStatusWithVersion' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_4],
        [],
      ),
    'updateDesignInspiration' : IDL.Func([DesignInspiration], [Result_4], []),
    'updateDocumentationItem' : IDL.Func([DocumentationItem], [Result_4], []),
    'updateEnvironmentConfig' : IDL.Func([EnvironmentConfig], [Result_4], []),
    'updateFileMetadata' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(FileVisibility),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Opt(IDL.Text)),
          IDL.Opt(IDL.Opt(IDL.Text)),
        ],
        [Result_4],
        [],
      ),
    'updateGitHubGuideline' : IDL.Func([GitHubGuideline], [Result_4], []),
    'updateGitHubRepositories' : IDL.Func([IDL.Vec(IDL.Text)], [Result_4], []),
    'updateLoggerConfig' : IDL.Func([IDL.Nat, IDL.Nat], [], []),
    'updateMarketplaceListing' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Opt(IDL.Text)),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Bool),
        ],
        [Result_8],
        [],
      ),
    'updateMessageInProject' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Opt(IDL.Bool)],
        [Result_4],
        [],
      ),
    'updateNotificationPreferences' : IDL.Func(
        [NotificationPreferences],
        [Result_4],
        [],
      ),
    'updateProject' : IDL.Func(
        [Project, IDL.Bool, IDL.Opt(IDL.Text)],
        [Result_7],
        [],
      ),
    'updateProjectMetadata' : IDL.Func(
        [IDL.Text, ProjectMetadata],
        [Result_4],
        [],
      ),
    'updatePublicProfile' : IDL.Func([PublicProfile], [Result_4], []),
    'updateReferenceItem' : IDL.Func([ReferenceItem], [Result_4], []),
    'updateServerPair' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Text), IDL.Opt(IDL.Nat)],
        [Result_4],
        [],
      ),
    'updateStripeData' : IDL.Func(
        [IDL.Opt(IDL.Text), IDL.Bool, IDL.Opt(IDL.Nat64)],
        [Result_4],
        [],
      ),
    'updateStripeSubscriptionStatus' : IDL.Func([IDL.Bool], [Result_4], []),
    'updateSubscriptionTier' : IDL.Func([IDL.Text, IDL.Nat], [Result_6], []),
    'updateUserPreferences' : IDL.Func([UserPreferences], [Result_5], []),
    'updateUserProfile' : IDL.Func([UserProfile], [Result_5], []),
    'updateUserReputation' : IDL.Func([IDL.Nat], [Result_4], []),
    'updateVersionCanisters' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Vec(IDL.Principal))],
        [Result_3],
        [],
      ),
    'updateVersionPackages' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Vec(PackageInfo)),
          IDL.Opt(IDL.Vec(NPMPackageInfo)),
        ],
        [Result_3],
        [],
      ),
    'updateVersionStatus' : IDL.Func([IDL.Text, IDL.Text], [Result_3], []),
    'uploadFileChunkToSession' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Vec(IDL.Nat8)],
        [Result_2],
        [],
      ),
    'uploadProjectFile' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Nat8),
          FileVisibility,
          IDL.Vec(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_1],
        [],
      ),
    'uploadWasmChunk' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
    'wallet_receive' : IDL.Func(
        [],
        [IDL.Record({ 'accepted' : IDL.Nat64 })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
