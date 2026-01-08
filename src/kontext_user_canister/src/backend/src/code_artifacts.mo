import Hash "mo:base/Hash";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";   
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat8 "mo:base/Nat8";
import Buffer "mo:base/Buffer";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Iter "mo:base/Iter";

module CodeArtifacts {
    public type ChunkId = Nat;

    public type FileContent = {
        #Text: Text;
        #Binary: [Nat8];
    };

    public type CodeArtifact = {
        id: Text;
        projectId: Text;
        fileName: Text;
        mimeType: Text;
        content: ?FileContent;
        chunks: ?[(ChunkId, Nat)];
        language: Text;
        path: Text;
        lastModified: Int;
        version: Nat;
        size: Nat;
    };

    // 🚀 PERFORMANCE OPTIMIZATION: Lightweight metadata without content
    public type FileMetadata = {
        id: Text;
        projectId: Text;
        fileName: Text;
        mimeType: Text;
        language: Text;
        path: Text;
        lastModified: Int;
        version: Nat;
        size: Nat;
        isChunked: Bool;
        chunkCount: ?Nat;
    };

    public type FileTreeNode = {
        name: Text;
        path: Text;
        isDirectory: Bool;
        children: ?[FileTreeNode];
    };

    public type Chunk = {
        id: ChunkId;
        content: [Nat8];
        size: Nat;
    };

    public type AssetCanister = actor {
        store : shared ({ key : Text; content : Blob; content_type : Text }) -> async ();
        delete : shared ({ key : Text }) -> async ();
        list : shared query () -> async [Text];
        get : shared query ({ key : Text }) -> async ?{ content : Blob; content_type : Text };
        clear : shared () -> async ();
    };

    public type CreateResponse = Result.Result<CodeArtifact, Text>;
    public type UpdateResponse = Result.Result<CodeArtifact, Text>;
    public type DeleteResponse = Result.Result<Text, Text>;
    public type ReadResponse = Result.Result<CodeArtifact, Text>;

    public class CodeArtifactManager(_targetCanister: Principal, _assetCanister: Principal) {
        private let natHash = func(n: Nat): Hash.Hash {
            let bytes = Text.encodeUtf8(Nat.toText(n));
            var hash : Nat32 = 0;
            for (byte in Blob.toArray(bytes).vals()) {
                hash := (hash << 8) ^ Nat32.fromNat(Nat8.toNat(byte));
            };
            hash
        };

        private var artifacts = HashMap.HashMap<Text, CodeArtifact>(10, Text.equal, Text.hash);
        private var chunks = HashMap.HashMap<ChunkId, Chunk>(10, Nat.equal, natHash);
        private var nextChunkId: Nat = 0;

        public func getState() : ([(Text, CodeArtifact)], [(ChunkId, Chunk)], Nat) {
            (
                Iter.toArray(artifacts.entries()),
                Iter.toArray(chunks.entries()),
                nextChunkId
            )
        };

        public func setState(entries: [(Text, CodeArtifact)], chunkEntries: [(ChunkId, Chunk)], nextId: Nat) {
            artifacts := HashMap.fromIter<Text, CodeArtifact>(
                entries.vals(),
                10,
                Text.equal,
                Text.hash
            );
            chunks := HashMap.fromIter<ChunkId, Chunk>(
                chunkEntries.vals(),
                10,
                Nat.equal,
                natHash
            );
            nextChunkId := nextId;
        };

        private func createChunks(content: [Nat8], maxChunkSize: Nat) : [(ChunkId, Nat)] {
            var remaining = content;
            let chunkList = Buffer.Buffer<(ChunkId, Nat)>(0);

            var contentPtr = 0;
            while (contentPtr < remaining.size()) {
                let chunkSize = Nat.min(remaining.size() - contentPtr, maxChunkSize);
                var chunk = Buffer.Buffer<Nat8>(chunkSize);

                var i = 0;
                while (i < chunkSize) {
                    chunk.add(remaining[contentPtr + i]);
                    i += 1;
                };

                let chunkId = nextChunkId;
                nextChunkId += 1;

                chunks.put(chunkId, {
                    id = chunkId;
                    content = Buffer.toArray(chunk);
                    size = chunkSize;
                });

                chunkList.add((chunkId, chunkSize));
                contentPtr += chunkSize;
            };

            Buffer.toArray(chunkList)
        };

        public func createArtifact(
            projectId: Text,
            fileName: Text,
            content: FileContent,
            mimeType: Text,
            language: Text,
            path: Text,
        ) : CreateResponse {
            let artifactId = projectId # ":" # path # "/" # fileName;
            let maxChunkSize = 2_000_000;

            switch(artifacts.get(artifactId)) {
                case (?_) {
                    #err("Artifact already exists at path: " # path # "/" # fileName);
                };
                case null {
                    let (finalContent, fileChunks, totalSize) = switch(content) {
                        case (#Text(textContent)) {
                            if (textContent.size() > maxChunkSize) {
                                let binary = Blob.toArray(Text.encodeUtf8(textContent));
                                (null, ?createChunks(binary, maxChunkSize), binary.size())
                            } else {
                                (?#Text(textContent), null, textContent.size())
                            }
                        };
                        case (#Binary(binaryContent)) {
                            if (binaryContent.size() > maxChunkSize) {
                                (null, ?createChunks(binaryContent, maxChunkSize), binaryContent.size())
                            } else {
                                (?#Binary(binaryContent), null, binaryContent.size())
                            }
                        };
                    };

                    let newArtifact: CodeArtifact = {
                        id = artifactId;
                        projectId = projectId;
                        fileName = fileName;
                        mimeType = mimeType;
                        content = finalContent;
                        chunks = fileChunks;
                        language = language;
                        path = path;
                        lastModified = Time.now();
                        version = 1;
                        size = totalSize;
                    };

                    artifacts.put(artifactId, newArtifact);
                    #ok(newArtifact)
                };
            };
        };

        public func updateArtifact(
            projectId: Text,
            fileName: Text,
            content: FileContent,
            mimeType: Text,
            path: Text,
        ) : UpdateResponse {
            let artifactId = projectId # ":" # path # "/" # fileName;
            let maxChunkSize = 2_000_000;

            switch(artifacts.get(artifactId)) {
                case (?existing) {
                    let (finalContent, fileChunks, totalSize) = switch(content) {
                        case (#Text(textContent)) {
                            if (textContent.size() > maxChunkSize) {
                                let binary = Blob.toArray(Text.encodeUtf8(textContent));
                                (null, ?createChunks(binary, maxChunkSize), binary.size())
                            } else {
                                (?#Text(textContent), null, textContent.size())
                            }
                        };
                        case (#Binary(binaryContent)) {
                            if (binaryContent.size() > maxChunkSize) {
                                (null, ?createChunks(binaryContent, maxChunkSize), binaryContent.size())
                            } else {
                                (?#Binary(binaryContent), null, binaryContent.size())
                            }
                        };
                    };

                    let updatedArtifact: CodeArtifact = {
                        id = existing.id;
                        projectId = existing.projectId;
                        fileName = existing.fileName;
                        mimeType = mimeType;
                        content = finalContent;
                        chunks = fileChunks;
                        language = existing.language;
                        path = existing.path;
                        lastModified = Time.now();
                        version = existing.version + 1;
                        size = totalSize;
                    };

                    artifacts.put(artifactId, updatedArtifact);
                    #ok(updatedArtifact)
                };
                case null {
                    #err("Artifact not found: " # artifactId);
                };
            };
        };

        public func readArtifact(projectId: Text, path: Text, fileName: Text) : ReadResponse {
            let artifactId = projectId # ":" # path # "/" # fileName;

            switch(artifacts.get(artifactId)) {
                case (?artifact) {
                    switch(artifact.chunks) {
                        case (?fileChunks) {
                            let contentSize = artifact.size;
                            let buffer = Buffer.Buffer<Nat8>(contentSize);

                            for ((chunkId, _) in fileChunks.vals()) {
                                switch(chunks.get(chunkId)) {
                                    case (?chunk) {
                                        for (byte in chunk.content.vals()) {
                                            buffer.add(byte);
                                        };
                                    };
                                    case null {
                                        return #err("Chunk missing: " # Nat.toText(chunkId));
                                    };
                                };
                            };

                            let reassembled = Buffer.toArray(buffer);
                            let reassembledArtifact: CodeArtifact = {
                                artifact with
                                content = ?#Binary(reassembled);
                                chunks = null;
                            };
                            #ok(reassembledArtifact)
                        };
                        case null {
                            #ok(artifact)
                        };
                    };
                };
                case null {
                    #err("Artifact not found: " # artifactId);
                };
            };
        };

        public func deleteArtifact(projectId: Text, path: Text, fileName: Text) : DeleteResponse {
            let artifactId = projectId # ":" # path # "/" # fileName;

            switch(artifacts.get(artifactId)) {
                case (?_) {
                    artifacts.delete(artifactId);
                    #ok("Artifact deleted successfully")
                };
                case null {
                    #err("Artifact not found: " # artifactId);
                };
            };
        };

        public func getProjectArtifacts(projectId: Text) : [CodeArtifact] {
            let matching = Buffer.Buffer<CodeArtifact>(0);
            for ((_, artifact) in artifacts.entries()) {
                if (artifact.projectId == projectId) {
                    matching.add(artifact);
                };
            };
            Buffer.toArray(matching)
        };

        // 🚀 PERFORMANCE OPTIMIZATION: Get metadata without content (faster, smaller payload)
        public func getProjectMetadata(projectId: Text) : [FileMetadata] {
            let matching = Buffer.Buffer<FileMetadata>(0);
            for ((_, artifact) in artifacts.entries()) {
                if (artifact.projectId == projectId) {
                    let metadata : FileMetadata = {
                        id = artifact.id;
                        projectId = artifact.projectId;
                        fileName = artifact.fileName;
                        mimeType = artifact.mimeType;
                        language = artifact.language;
                        path = artifact.path;
                        lastModified = artifact.lastModified;
                        version = artifact.version;
                        size = artifact.size;
                        isChunked = switch (artifact.chunks) {
                            case (?_) { true };
                            case (null) { false };
                        };
                        chunkCount = switch (artifact.chunks) {
                            case (?chunkList) { ?chunkList.size() };
                            case (null) { null };
                        };
                    };
                    matching.add(metadata);
                };
            };
            Buffer.toArray(matching)
        };

        public func getProjectFileTree(projectId: Text) : ?FileTreeNode {
            let root: FileTreeNode = {
                name = projectId;
                path = "";
                isDirectory = true;
                children = ?[];
            };

            for ((_, artifact) in artifacts.entries()) {
                if (artifact.projectId == projectId) {
                    addToFileTree(root, artifact);
                };
            };

            ?root
        };

        public func getChunk(chunkId: ChunkId) : ?Chunk {
            chunks.get(chunkId)
        };

        private func addToFileTree(root: FileTreeNode, artifact: CodeArtifact) {
            let parts = Text.split(artifact.path, #char('/'));
            var current = root;

            for (part in parts) {
                if (part != "") {
                    current := ensureDirectoryExists(current, part, artifact.path);
                };
            };
        };

        private func ensureDirectoryExists(node: FileTreeNode, name: Text, path: Text) : FileTreeNode {
            switch(node.children) {
                case (?children) {
                    switch(Array.find<FileTreeNode>(
                        children,
                        func(n: FileTreeNode) : Bool { n.name == name }
                    )) {
                        case (?existing) existing;
                        case null {
                            let newDir: FileTreeNode = {
                                name = name;
                                path = path;
                                isDirectory = true;
                                children = ?[];
                            };
                            {
                                name = node.name;
                                path = node.path;
                                isDirectory = node.isDirectory;
                                children = ?Array.append(children, [newDir]);
                            }
                        };
                    };
                };
                case null node;
            };
        };

        public func cleanupProject(projectId: Text) : () {
            // Remove all artifacts belonging to this project
            let artifactsToRemove = Buffer.Buffer<Text>(0);
            for ((id, artifact) in artifacts.entries()) {
                if (artifact.projectId == projectId) {
                    artifactsToRemove.add(id);
                };
            };

            for (id in artifactsToRemove.vals()) {
                artifacts.delete(id);
            };
        };

    };
};