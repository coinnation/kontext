import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";
import TrieMap "mo:base/TrieMap";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Buffer "mo:base/Buffer";
import Result "mo:base/Result";
import Option "mo:base/Option";
import ProjectTypes "project_types";
import VersionTypes "project_version_types";
import Error "mo:base/Error";
import CustomDebug "Debug";
import PathUtils "path_utils"; 

module VersionManager {
    // Import existing types
    public type Project = ProjectTypes.Project;
    public type PackageInfo = ProjectTypes.PackageInfo;
    public type NPMPackageInfo = ProjectTypes.NPMPackageInfo;
    public type ChatMessage = ProjectTypes.ChatMessage;
    public type ChatMessageType = ProjectTypes.ChatMessageType;
    public type ProjectMetadata = ProjectTypes.ProjectMetadata;
    
    // Import versioning types
    public type ProjectVersion = VersionTypes.ProjectVersion;
    public type SemanticVersion = VersionTypes.SemanticVersion;
    public type VersionArtifact = VersionTypes.VersionArtifact;
    public type VersionStatus = VersionTypes.VersionStatus;
    public type ArtifactFile = VersionTypes.ArtifactFile;
    
    // Error types
    public type VersionError = {
        #VersionNotFound;
        #InvalidVersion;
        #ProjectNotFound;
        #ArtifactNotFound;
        #VersionExists;
        #CanisterError;
        #Unauthorized;
        #Other: Text;
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
    
    public class VersionManager() {
        // Storage for versions
        private var versions = TrieMap.TrieMap<Text, ProjectVersion>(Text.equal, Text.hash);
        
        // Storage for artifacts
        private var artifacts = TrieMap.TrieMap<Text, VersionArtifact>(Text.equal, Text.hash);
        
        // Map of project IDs to version IDs
        private var projectVersions = TrieMap.TrieMap<Text, [Text]>(Text.equal, Text.hash);
        
        // Logs for debugging
        private var logs: [CustomDebug.LogEntry] = [];
        
        private func log(message: Text) {
            logs := Array.append(logs, [CustomDebug.print(message)]);
        };
        
        public func getLogs() : [Text] {
            Array.map<CustomDebug.LogEntry, Text>(
                logs,
                func(entry: CustomDebug.LogEntry) : Text {
                    entry.timestamp # " [" # entry.level # "] " # entry.message # 
                    (switch (entry.details) {
                        case (null) { "" };
                        case (?details) { ": " # details };
                    })
                }
            )
        };
        
        // Initialize a project with its first version
        public func initializeProjectVersion(
            project: Project
        ) : Result.Result<ProjectVersion, VersionError> {
            log("Initializing version for project: " # project.id);
            
            // Check if project already has versions
            switch (projectVersions.get(project.id)) {
                case (?existingVersions) {
                    if (existingVersions.size() > 0) {
                        log("Project already has versions: " # Nat.toText(existingVersions.size()));
                        return #err(#VersionExists);
                    };
                };
                case (null) {
                    // This is the first version, which is fine
                };
            };
            
            // Create initial version
            let initialVersion = VersionTypes.projectToInitialVersion(project);
            log("Created initial version: " # initialVersion.id);
            
            // Store the version
            versions.put(initialVersion.id, initialVersion);
            
            // Update the project versions map
            projectVersions.put(project.id, [initialVersion.id]);
            
            #ok(initialVersion)
        };
        
        public func createNewVersion(
            projectId: Text,
            newSemanticVersion: SemanticVersion,
            description: ?Text,
            releaseNotes: ?Text,
            parentVersionId: ?Text
        ) : Result.Result<ProjectVersion, VersionError> {
            log("Creating new version for project: " # projectId);
            
            // Get parent project versions
            let projectVersionsList = switch (projectVersions.get(projectId)) {
                case (?vList) { vList };
                case (null) { 
                    log("Project has no versions: " # projectId);
                    return #err(#ProjectNotFound); 
                };
            };
            
            // Validate parent version if specified
            switch (parentVersionId) {
                case (?pvId) {
                    // Check if the parent version is NOT found
                    if (Array.find<Text>(projectVersionsList, func(id: Text) : Bool { id == pvId }) == null) {
                        log("Parent version not found: " # pvId);
                        return #err(#VersionNotFound);
                    };
                };
                case (null) {
                    // If no parent specified, use the latest version
                    if (projectVersionsList.size() > 0) {
                        // No need to do anything, we'll get the project below
                    } else {
                        log("No parent version specified and project has no versions");
                        return #err(#VersionNotFound);
                    };
                };
            };
            
            // Generate version string for comparison
            let newVersionStr = VersionTypes.versionToString(newSemanticVersion);
            
            // Check if version already exists
            let versionExists = Array.find<Text>(
                projectVersionsList,
                func(vId: Text) : Bool {
                    switch (versions.get(vId)) {
                        case (?v) {
                            VersionTypes.versionToString(v.semanticVersion) == newVersionStr
                        };
                        case (null) { false };
                    }
                }
            );
            
            if (versionExists != null) {
                log("Version already exists: " # newVersionStr);
                return #err(#VersionExists);
            };
            
            // Get existing project data with all required fields including message fields
            let projectData: Project = {
                id = projectId;
                name = "Project Name"; // This would come from your project storage
                description = description;
                projectType = {
                    name = "Unknown";
                    subType = "Unknown";
                };
                canisters = [];
                motokoPackages = null;
                npmPackages = null;
                created = 0;
                updated = 0;
                visibility = "private";
                status = "active";
                collaborators = null;
                templateId = null;
                workingCopyBaseVersion = null;
                // Add the missing required message fields with defaults
                messages = null;
                metadata = null;
                messageCount = null;
                lastMessageTime = null;
                deployedAgents = null; // Add deployed agents field
                // Smart deployment tracking fields
                hasBackendChanged = null;
                hasFrontendChanged = null;
                lastBackendDeployment = null;
                lastFrontendDeployment = null;
                lastDeploymentServerPairId = null;
            };
            
            // Create the new version
            let newVersion = VersionTypes.createNewVersion(projectData, newSemanticVersion, parentVersionId);
            
            // Add description and release notes if provided
            let versionWithMetadata = {
                newVersion with
                description = description;
                releaseNotes = releaseNotes;
            };
            
            // Now handle copying artifacts from the parent version
            let finalVersion = switch (parentVersionId) {
                case (?pvId) {
                    // Get parent version's artifacts
                    switch (getVersionArtifacts(pvId)) {
                        case (#ok(parentArtifact)) {
                            // Create a snapshot ID for the new version
                            let snapshotId = versionWithMetadata.id # "-snapshot-" # Nat64.toText(Nat64.fromIntWrap(Time.now()));
                            
                            // Create a new artifact snapshot with the parent's files
                            let newSnapshot: VersionArtifact = {
                                id = snapshotId;
                                versionId = versionWithMetadata.id;
                                projectId = versionWithMetadata.projectId;
                                files = parentArtifact.files; // Copy parent files
                                created = Nat64.fromIntWrap(Time.now());
                            };
                            
                            // Store the new artifact
                            artifacts.put(snapshotId, newSnapshot);
                            
                            // Return version with reference to the new snapshot
                            { versionWithMetadata with artifactSnapshot = ?snapshotId }
                        };
                        case (#err(_)) {
                            // No parent artifacts or error, proceed without copying
                            log("No parent artifacts found to copy or error occurred");
                            versionWithMetadata
                        };
                    }
                };
                case (null) {
                    // No parent specified, proceed without copying
                    versionWithMetadata
                };
            };
            
            // Store the version
            versions.put(finalVersion.id, finalVersion);
            
            // Update the project versions map
            let updatedVersionsList = Array.append(projectVersionsList, [finalVersion.id]);
            projectVersions.put(projectId, updatedVersionsList);
            
            log("Created new version: " # finalVersion.id);
            #ok(finalVersion)
        };
        
        // Get all versions of a project
        public func getProjectVersions(
            projectId: Text
        ) : Result.Result<[ProjectVersion], VersionError> {
            switch (projectVersions.get(projectId)) {
                case (?versionIds) {
                    let versionsList = Buffer.Buffer<ProjectVersion>(versionIds.size());
                    
                    for (vId in versionIds.vals()) {
                        switch (versions.get(vId)) {
                            case (?version) {
                                versionsList.add(version);
                            };
                            case (null) {
                                // Skip missing versions
                            };
                        };
                    };
                    
                    #ok(Buffer.toArray(versionsList))
                };
                case (null) {
                    log("No versions found for project: " # projectId);
                    #err(#ProjectNotFound)
                };
            }
        };
        
        // Get a specific version
        public func getVersion(
            versionId: Text
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    #ok(version)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };
        
        // Get a specific version by project and semantic version
        public func getVersionBySemanticVersion(
            projectId: Text,
            semanticVersion: SemanticVersion
        ) : Result.Result<ProjectVersion, VersionError> {
            let versionStr = VersionTypes.versionToString(semanticVersion);
            
            switch (projectVersions.get(projectId)) {
                case (?versionIds) {
                    for (vId in versionIds.vals()) {
                        switch (versions.get(vId)) {
                            case (?version) {
                                if (VersionTypes.versionToString(version.semanticVersion) == versionStr) {
                                    return #ok(version);
                                };
                            };
                            case (null) {
                                // Skip missing versions
                            };
                        };
                    };
                    
                    log("Version not found: " # versionStr # " for project: " # projectId);
                    #err(#VersionNotFound)
                };
                case (null) {
                    log("No versions found for project: " # projectId);
                    #err(#ProjectNotFound)
                };
            }
        };
        
        // Get latest version of a project
        public func getLatestVersion(
            projectId: Text
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (projectVersions.get(projectId)) {
                case (?versionIds) {
                    if (versionIds.size() == 0) {
                        log("Project has no versions: " # projectId);
                        return #err(#VersionNotFound);
                    };
                    
                    var latestVersion: ?ProjectVersion = null;
                    var latestMajor: Nat = 0;
                    var latestMinor: Nat = 0;
                    var latestPatch: Nat = 0;
                    
                    for (vId in versionIds.vals()) {
                        switch (versions.get(vId)) {
                            case (?version) {
                                let semVer = version.semanticVersion;
                                
                                // Only consider released versions
                                let isReleased = switch (version.status) {
                                    case (#Released) { true };
                                    case (_) { false };
                                };
                                
                                if (isReleased) {
                                    if (latestVersion == null or
                                        semVer.major > latestMajor or
                                        (semVer.major == latestMajor and semVer.minor > latestMinor) or
                                        (semVer.major == latestMajor and semVer.minor == latestMinor and semVer.patch > latestPatch)) {
                                        latestVersion := ?version;
                                        latestMajor := semVer.major;
                                        latestMinor := semVer.minor;
                                        latestPatch := semVer.patch;
                                    };
                                };
                            };
                            case (null) {
                                // Skip missing versions
                            };
                        };
                    };
                    
                    switch (latestVersion) {
                        case (?v) { #ok(v) };
                        case (null) {
                            // If no released versions, return the latest development version
                            var latestDevVersion: ?ProjectVersion = null;
                            var latestDevMajor: Nat = 0;
                            var latestDevMinor: Nat = 0;
                            var latestDevPatch: Nat = 0;
                            
                            for (vId in versionIds.vals()) {
                                switch (versions.get(vId)) {
                                    case (?version) {
                                        let semVer = version.semanticVersion;
                                        
                                        if (latestDevVersion == null or
                                            semVer.major > latestDevMajor or
                                            (semVer.major == latestDevMajor and semVer.minor > latestDevMinor) or
                                            (semVer.major == latestDevMajor and semVer.minor == latestDevMinor and semVer.patch > latestDevPatch)) {
                                            latestDevVersion := ?version;
                                            latestDevMajor := semVer.major;
                                            latestDevMinor := semVer.minor;
                                            latestDevPatch := semVer.patch;
                                        };
                                    };
                                    case (null) {
                                        // Skip missing versions
                                    };
                                };
                            };
                            
                            switch (latestDevVersion) {
                                case (?v) { #ok(v) };
                                case (null) {
                                    log("No versions found for project: " # projectId);
                                    #err(#VersionNotFound)
                                };
                            }
                        };
                    }
                };
                case (null) {
                    log("No versions found for project: " # projectId);
                    #err(#ProjectNotFound)
                };
            }
        };
        
        // Update version status
        public func updateVersionStatus(
            versionId: Text,
            newStatus: VersionStatus
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Create updated version
                    let updatedVersion = {
                        version with
                        status = newStatus;
                    };
                    
                    versions.put(versionId, updatedVersion);
                    log("Updated status for version: " # versionId);
                    #ok(updatedVersion)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };
        
        public func createArtifactSnapshot(
            versionId: Text,
            files: [ArtifactFile]
        ) : Result.Result<VersionArtifact, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    let snapshotId = versionId # "-snapshot-" # Nat64.toText(Nat64.fromIntWrap(Time.now()));
                    
                    // Process files to normalize paths consistently
                    let normalizedFiles = Array.map<ArtifactFile, ArtifactFile>(
                        files,
                        func (file: ArtifactFile) : ArtifactFile {
                            // Use the centralized path normalization function
                            let normalizedPath = PathUtils.normalizePath(file.path);
                            
                            {
                                path = normalizedPath;
                                fileName = file.fileName;
                                mimeType = file.mimeType;
                                language = file.language;
                                content = file.content;
                                lastModified = file.lastModified;
                            }
                        }
                    );
                    
                    let snapshot: VersionArtifact = {
                        id = snapshotId;
                        versionId = versionId;
                        projectId = version.projectId;
                        files = normalizedFiles;
                        created = Nat64.fromIntWrap(Time.now());
                    };
                    
                    artifacts.put(snapshotId, snapshot);
                    
                    // Update version to reference this snapshot
                    let updatedVersion = {
                        version with
                        artifactSnapshot = ?snapshotId;
                    };
                    
                    versions.put(versionId, updatedVersion);
                    
                    log("Created artifact snapshot: " # snapshotId);
                    #ok(snapshot)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        // Helper to extract project name from project ID (unused but kept for future use)
        private func _getProjectNameFromId(projectId: Text) : Text {
            // This is a placeholder - implement based on your project ID format
            // You may need to look up the project name from a registry
            
            // If project IDs have a format like "project-xyz"
            if (Text.startsWith(projectId, #text "project-")) {
                // Return without the "project-" prefix
                return projectId
            };
            
            // Default case: return the ID itself
            projectId
        };
        
        // Get artifacts for a specific version
        public func getVersionArtifacts(
            versionId: Text
        ) : Result.Result<VersionArtifact, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    switch (version.artifactSnapshot) {
                        case (?snapshotId) {
                            switch (artifacts.get(snapshotId)) {
                                case (?artifact) {
                                    #ok(artifact)
                                };
                                case (null) {
                                    log("Artifact not found: " # snapshotId);
                                    #err(#ArtifactNotFound)
                                };
                            }
                        };
                        case (null) {
                            log("Version has no artifact snapshot: " # versionId);
                            #err(#ArtifactNotFound)
                        };
                    }
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };
        
        // Get state for persistence
        public func getState() : ([(Text, ProjectVersion)], [(Text, VersionArtifact)], [(Text, [Text])]) {
            (
                Iter.toArray(versions.entries()),
                Iter.toArray(artifacts.entries()),
                Iter.toArray(projectVersions.entries())
            )
        };
        
        // Restore state from persistence
        public func setState(
            vs: [(Text, ProjectVersion)],
            arts: [(Text, VersionArtifact)],
            projVs: [(Text, [Text])]
        ) {
            versions := TrieMap.fromEntries<Text, ProjectVersion>(
                vs.vals(),
                Text.equal,
                Text.hash
            );
            
            artifacts := TrieMap.fromEntries<Text, VersionArtifact>(
                arts.vals(),
                Text.equal,
                Text.hash
            );
            
            projectVersions := TrieMap.fromEntries<Text, [Text]>(
                projVs.vals(),
                Text.equal,
                Text.hash
            );
        };

        // Add to VersionManager class to support logging deployments
        public func addDeploymentReference(
            versionId: Text,
            deployment: DeploymentReference
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Update deployments list
                    let deployments = switch (version.deployments) {
                        case (null) { [deployment] };
                        case (?deps) { Array.append(deps, [deployment]) };
                    };
                    
                    // Create updated version
                    let updatedVersion = {
                        version with
                        deployments = ?deployments;
                    };
                    
                    // Store the updated version
                    versions.put(versionId, updatedVersion);
                    log("Added deployment reference to version: " # versionId);
                    
                    #ok(updatedVersion)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        // Add to VersionManager class in version_manager.mo
        public func deleteDeploymentFromVersion(
            versionId: Text,
            deploymentId: Text
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    switch (version.deployments) {
                        case (null) {
                            log("No deployments found for version: " # versionId);
                            #err(#ArtifactNotFound)
                        };
                        case (?deployments) {
                            // Filter out the deployment to delete
                            let updatedDeployments = Array.filter<DeploymentReference>(
                                deployments,
                                func(dep: DeploymentReference) : Bool {
                                    dep.id != deploymentId
                                }
                            );
                            
                            if (updatedDeployments.size() == deployments.size()) {
                                log("Deployment not found in version: " # versionId);
                                #err(#ArtifactNotFound)
                            } else {
                                // Create updated version
                                let updatedVersion = {
                                    version with
                                    deployments = ?updatedDeployments;
                                };
                                
                                // Store the updated version
                                versions.put(versionId, updatedVersion);
                                log("Deleted deployment from version: " # versionId);
                                
                                #ok(updatedVersion)
                            }
                        };
                    }
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        // Add to VersionManager class to support updating deployment status
        public func updateDeploymentStatus(
            versionId: Text,
            deploymentId: Text,
            newStatus: Text
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    switch (version.deployments) {
                        case (null) {
                            log("No deployments found for version: " # versionId);
                            #err(#VersionNotFound)
                        };
                        case (?deployments) {
                            // Update the specific deployment
                            let updatedDeployments = Array.map<DeploymentReference, DeploymentReference>(
                                deployments,
                                func(dep: DeploymentReference) : DeploymentReference {
                                    if (dep.id == deploymentId) {
                                        // Update this deployment's status
                                        {
                                            id = dep.id;
                                            name = dep.name;
                                            projectId = dep.projectId;
                                            canisterId = dep.canisterId;
                                            status = newStatus;
                                            network = dep.network;
                                            lastUpdated = Nat64.fromIntWrap(Time.now());
                                        }
                                    } else {
                                        // Keep this deployment as is
                                        dep
                                    }
                                }
                            );
                            
                            // Create updated version
                            let updatedVersion = {
                                version with
                                deployments = ?updatedDeployments;
                            };
                            
                            // Store the updated version
                            versions.put(versionId, updatedVersion);
                            log("Updated deployment status in version: " # versionId);
                            
                            #ok(updatedVersion)
                        };
                    }
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        // Optional: Add method to record canister status snapshot 
        public func recordCanisterStatusSnapshot(
            versionId: Text,
            canisterId: Principal,
            statusInfo: Text
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Create a deployment reference to store the status
                    let statusDeployment: DeploymentReference = {
                        id = "status-" # Principal.toText(canisterId) # "-" # Nat64.toText(Nat64.fromIntWrap(Time.now()));
                        name = "Status Snapshot";
                        projectId = version.projectId;
                        canisterId = ?canisterId;
                        status = statusInfo; // Store the status info here
                        network = "status";
                        lastUpdated = Nat64.fromIntWrap(Time.now());
                    };
                    
                    // Use the existing addDeploymentReference method
                    return addDeploymentReference(versionId, statusDeployment);
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        public func updateVersionPackages(
            versionId: Text,
            motokoPackages: ?[PackageInfo],
            npmPackages: ?[NPMPackageInfo]
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Create updated version
                    let updatedVersion = {
                        version with
                        motokoPackages = if (motokoPackages != null) { motokoPackages } else { version.motokoPackages };
                        npmPackages = if (npmPackages != null) { npmPackages } else { version.npmPackages };
                    };
                    
                    // Store the updated version
                    versions.put(versionId, updatedVersion);
                    log("Updated packages for version: " # versionId);
                    
                    #ok(updatedVersion)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };
        
        public func updateVersionCanisters(
            versionId: Text,
            canisters: ?[Principal]
        ) : Result.Result<ProjectVersion, VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Create updated version with proper type handling
                    let updatedCanisters = switch (canisters) {
                        case (null) { version.canisters };  // Use existing canisters if none provided
                        case (?newCanisters) { newCanisters }; // Use the new canisters if provided
                    };
                    
                    let updatedVersion = {
                        version with
                        canisters = updatedCanisters;  // Now this is always [Principal], not ?[Principal]
                    };
                    
                    // Store the updated version
                    versions.put(versionId, updatedVersion);
                    log("Updated canisters for version: " # versionId);
                    
                    #ok(updatedVersion)
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };

        // Add to VersionManager class
        public func deleteVersion(
            versionId: Text
        ) : Result.Result<(), VersionError> {
            switch (versions.get(versionId)) {
                case (?version) {
                    // Get the project versions list
                    switch (projectVersions.get(version.projectId)) {
                        case (?vList) {
                            // Remove this version from the project's version list
                            let updatedVersions = Array.filter<Text>(
                                vList,
                                func(id: Text) : Bool { id != versionId }
                            );
                            
                            // Update the project versions map
                            projectVersions.put(version.projectId, updatedVersions);
                            
                            // Remove version's artifact if it exists
                            switch (version.artifactSnapshot) {
                                case (?snapshotId) {
                                    artifacts.delete(snapshotId);
                                };
                                case (null) {
                                    // No artifact to delete
                                };
                            };
                            
                            // Delete the version itself
                            versions.delete(versionId);
                            
                            log("Deleted version: " # versionId);
                            #ok(())
                        };
                        case (null) {
                            log("Project not found for version: " # versionId);
                            #err(#ProjectNotFound)
                        };
                    }
                };
                case (null) {
                    log("Version not found: " # versionId);
                    #err(#VersionNotFound)
                };
            }
        };
    };
};