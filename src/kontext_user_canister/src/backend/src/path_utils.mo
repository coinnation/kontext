import Text "mo:base/Text";
import Iter "mo:base/Iter";

module PathUtils {
    public func normalizePath(path: Text) : Text {
        // REMOVE THIS BLOCK ENTIRELY - don't strip any project prefixes
        
        // Just do the slash cleanup:
        let noDoubleSlashes = Text.replace(path, #text "//", "/");
        
        let noTrailingSlash = if (Text.endsWith(noDoubleSlashes, #text "/") and noDoubleSlashes != "/") {
            Text.trimEnd(noDoubleSlashes, #text "/")
        } else {
            noDoubleSlashes
        };
        
        return noTrailingSlash;
    }
}