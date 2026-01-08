// types.mo
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Debug "mo:base/Debug";


module Types {
   
    public type LogEntry = {
        timestamp: Text;
        level: Text;
        category: Text;
        message: Text;
        details: ?Text;
        metadata: ?[(Text, Text)];
    };

    // File and Storage Types
    public type FileContent = {
        #Text: Text;
        #Binary: [Nat8];
    };

    public type CodeArtifact = {
        projectId: Text;
        fileName: Text;
        content: FileContent;
        mimeType: Text;
        language: Text;
        path: Text;
        created: Nat64;
        updated: Nat64;
        metadata: ?[(Text, Text)];
    };

    public type FileTreeNode = {
        name: Text;
        isDirectory: Bool;
        children: ?[FileTreeNode];
        content: ?CodeArtifact;
        metadata: ?[(Text, Text)];
    };

    public type ChunkId = Nat;

    public type Chunk = {
        id: ChunkId;
        data: [Nat8];
        next: ?ChunkId;
        metadata: ?[(Text, Text)];
    };
};