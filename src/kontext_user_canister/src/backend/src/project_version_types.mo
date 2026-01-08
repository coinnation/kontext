import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import ProjectTypes "project_types";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";


module ProjectVersionTypes {
    // Import existing types
    public type Project = ProjectTypes.Project;
    public type PackageInfo = ProjectTypes.PackageInfo;
    public type NPMPackageInfo = ProjectTypes.NPMPackageInfo;
    public type ProjectType = ProjectTypes.ProjectType;
    public type ChatMessage = ProjectTypes.ChatMessage;
    public type ChatMessageType = ProjectTypes.ChatMessageType;
    public type ProjectMetadata = ProjectTypes.ProjectMetadata;

    // Semantic version structure
    public type SemanticVersion = {
        major: Nat;
        minor: Nat;
        patch: Nat;
        prerelease: ?Text; // Optional prerelease identifier (e.g., "alpha.1")
        build: ?Text;      // Optional build metadata (e.g., "build.123")
    };

    // String representation of semantic version
    public func versionToString(version: SemanticVersion) : Text {
        let base = Nat.toText(version.major) # "." # Nat.toText(version.minor) # "." # Nat.toText(version.patch);
        let withPrerelease = switch (version.prerelease) {
            case (null) { base };
            case (?pre) { base # "-" # pre };
        };
        switch (version.build) {
            case (null) { withPrerelease };
            case (?build) { withPrerelease # "+" # build };
        }
    };

    // Parse string to semantic version
    public func parseVersion(versionStr: Text) : ?SemanticVersion {
        // Basic implementation - in production you would want more robust parsing
        let parts = Text.split(versionStr, #char('.'));
        let partsArray = Iter.toArray(parts);
        
        if (partsArray.size() < 3) {
            return null;
        };
        
        let major = Nat.fromText(partsArray[0]);
        let minor = Nat.fromText(partsArray[1]);
        
        // Handle patch version which might contain prerelease/build info
        let patchParts = Text.split(partsArray[2], #char('-'));
        let patchPartsArray = Iter.toArray(patchParts);
        
        let patch = Nat.fromText(patchPartsArray[0]);
        
        // Extract prerelease and build info if present
        var prerelease: ?Text = null;
        var build: ?Text = null;
        
        if (patchPartsArray.size() > 1) {
            let buildParts = Text.split(patchPartsArray[1], #char('+'));
            let buildPartsArray = Iter.toArray(buildParts);
            
            prerelease := ?buildPartsArray[0];
            
            if (buildPartsArray.size() > 1) {
                build := ?buildPartsArray[1];
            };
        };
        
        switch (major, minor, patch) {
            case (?maj, ?min, ?pat) {
                ?{
                    major = maj;
                    minor = min;
                    patch = pat;
                    prerelease = prerelease;
                    build = build;
                }
            };
            case _ { null };
        }
    };

    // Project version that extends the base project
    public type ProjectVersion = {
        id: Text;                  // Unique identifier for this version
        projectId: Text;           // Reference to parent project
        name: Text;                // Version name (e.g., "1.0.0")
        semanticVersion: SemanticVersion;
        description: ?Text;        // Version-specific description
        releaseNotes: ?Text;       // Optional release notes
        canisters: [Principal];    // Canisters associated with this version
        motokoPackages: ?[PackageInfo];    // Version-specific Motoko packages
        npmPackages: ?[NPMPackageInfo];    // Version-specific NPM packages
        created: Nat64;            // When this version was created
        status: VersionStatus;     // Version status
        artifactSnapshot: ?Text;   // Reference to artifact snapshot ID
        tags: [Text];              // Optional tags for this version
        parentVersion: ?Text;      // Reference to parent version (if any)
        deployments: ?[DeploymentReference];
    };


    public type DeploymentReference = {
        id: Text;               // Unique identifier
        name: Text;             // User-friendly name
        projectId: Text;        // Associated project
        canisterId: ?Principal; // The actual canister ID once deployed
        status: Text;           // Simple status like "running", "stopped"
        network: Text;          // "ic", "local", etc.
        lastUpdated: Nat64; // When it was last updated
    };

    // Status options for a version
    public type VersionStatus = {
        #Development;  // In active development
        #Released;     // Official release
        #Deprecated;   // No longer supported
        #Draft;        // Not yet ready for development
    };

    // A structure to track code artifacts specific to a version
    public type VersionArtifact = {
        id: Text;                  // Unique identifier for this artifact snapshot
        versionId: Text;           // Reference to associated version
        projectId: Text;           // Reference to parent project
        files: [ArtifactFile];     // List of files in this snapshot
        created: Nat64;            // When this snapshot was created
    };

    // Individual file in a version snapshot
    public type ArtifactFile = {
        path: Text;                // Relative path within project
        fileName: Text;            // Name of file
        mimeType: Text;            // MIME type
        language: Text;            // Programming language
        content: ArtifactContent;  // File content
        lastModified: Nat64;       // Last modification timestamp
    };

    // Content for version artifacts
    public type ArtifactContent = {
        #Text: Text;               // For text-based files (< 2MB)
        #Binary: [Nat8];           // For binary files (< 2MB)
        #Reference: Text;          // Reference to existing artifact (to save space)
        #ChunkReference: [(Nat, Nat)]; // Chunk IDs and sizes for large files (> 2MB)
    };

    // Functions to convert between current Project and ProjectVersion
    public func projectToInitialVersion(project: Project) : ProjectVersion {
        {
            id = project.id # "-v1.0.0"; // Generate version ID
            projectId = project.id;
            name = "1.0.0";
            semanticVersion = {
                major = 1;
                minor = 0;
                patch = 0;
                prerelease = null;
                build = null;
            };
            description = project.description;
            releaseNotes = null;
            canisters = project.canisters;
            motokoPackages = project.motokoPackages;
            npmPackages = project.npmPackages;
            created = Nat64.fromIntWrap(Time.now());
            status = #Development;
            artifactSnapshot = null;
            tags = [];
            parentVersion = null;
            deployments = null;
        }
    };

    // Generate a new version from a project and a semantic version
    public func createNewVersion(
        project: Project, 
        version: SemanticVersion, 
        parentVersionId: ?Text
    ) : ProjectVersion {
        {
            id = project.id # "-v" # versionToString(version);
            projectId = project.id;
            name = versionToString(version);
            semanticVersion = version;
            description = project.description;
            releaseNotes = null;
            canisters = project.canisters;
            motokoPackages = project.motokoPackages;
            npmPackages = project.npmPackages;
            created = Nat64.fromIntWrap(Time.now());
            status = #Development;
            artifactSnapshot = null;
            tags = [];
            parentVersion = parentVersionId;
            deployments = null;
        }
    };

    // Sync a project with its latest version
    public func syncProjectFromVersion(project: Project, version: ProjectVersion) : Project {
        {
            id = project.id;
            name = project.name;
            description = version.description;
            projectType = project.projectType;
            canisters = version.canisters;
            motokoPackages = version.motokoPackages;
            npmPackages = version.npmPackages;
            created = project.created;
            updated = Nat64.fromIntWrap(Time.now());
            visibility = project.visibility;
            status = project.status;
            collaborators = project.collaborators;
            templateId = project.templateId;
            workingCopyBaseVersion = project.workingCopyBaseVersion;
            // Add the missing fields with appropriate defaults
            messages = project.messages; // Keep existing messages
            metadata = project.metadata; // Keep existing metadata
            messageCount = project.messageCount; // Keep existing count
            lastMessageTime = project.lastMessageTime; // Keep existing timestamp
            deployedAgents = project.deployedAgents; // Keep existing deployed agents
            // Smart deployment tracking fields
            hasBackendChanged = project.hasBackendChanged; // Preserve deployment tracking
            hasFrontendChanged = project.hasFrontendChanged; // Preserve deployment tracking
            lastBackendDeployment = project.lastBackendDeployment; // Preserve deployment history
            lastFrontendDeployment = project.lastFrontendDeployment; // Preserve deployment history
            lastDeploymentServerPairId = project.lastDeploymentServerPairId; // Preserve server pair tracking
        }
    };
};