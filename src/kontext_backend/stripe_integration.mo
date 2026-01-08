import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Time "mo:base/Time";

module StripeIntegration {
    
    type StripeConfig = {
        secretKey: Text;
        publishableKey: Text;
        webhookSecret: Text;
    };
    
    // ===== IC MANAGEMENT CANISTER TYPES =====
    
    type IC = actor {
        http_request : shared {
            url : Text;
            max_response_bytes : ?Nat64;
            headers : [{ name : Text; value : Text }];
            body : ?Blob;
            method : { #get; #post; #head };
            transform : ?{
                function : shared query ({ response : HttpResponse; context : Blob }) -> async HttpResponse;
                context : Blob;
            };
            is_replicated : ?Bool; // 🔥 CRITICAL: Must be false for external APIs!
        } -> async HttpResponse;
    };
    
    type HttpResponse = {
        status : Nat;
        headers : [{ name : Text; value : Text }];
        body : Blob;
    };
    
    private let ic : IC = actor("aaaaa-aa");
    
    // ===== STRIPE API FUNCTIONS =====
    
    /**
     * Create a Stripe Payment Intent (for one-time payments)
     * 🔐 BACKEND ONLY - Secret key never exposed to frontend
     */
    public func createPaymentIntent(
        config: StripeConfig,
        amountInCents: Nat,
        currency: Text,
        userPrincipal: Principal,
        description: Text
    ) : async Result.Result<{
        id: Text;
        clientSecret: Text;
        amount: Nat;
    }, Text> {
        
        let url = "https://api.stripe.com/v1/payment_intents";
        
        // Prepare form-encoded body
        let body = 
            "amount=" # Nat.toText(amountInCents) #
            "&currency=" # currency #
            "&description=" # urlEncode(description) #
            "&automatic_payment_methods[enabled]=true" #
            "&metadata[user_principal]=" # Principal.toText(userPrincipal) #
            "&metadata[platform]=kontext" #
            "&metadata[timestamp]=" # Int.toText(Time.now());
        
        // Prepare headers with authorization
        let headers = [
            { name = "Authorization"; value = "Bearer " # config.secretKey },
            { name = "Content-Type"; value = "application/x-www-form-urlencoded" }
        ];
        
        // 🔥 CRITICAL: is_replicated = ?false to avoid duplicate API calls
        let request = {
            url = url;
            max_response_bytes = ?(10000 : Nat64);
            headers = headers;
            body = ?Text.encodeUtf8(body);
            method = #post;
            transform = null; // No transform needed for non-replicated calls
            is_replicated = ?false; // 🔥 Execute only once, not across all nodes
        };
        
        try {
            // Add cycles for HTTP outcall (~0.4M cycles per call)
            Cycles.add(500_000_000); // 0.5M cycles
            
            let response = await ic.http_request(request);
            
            if (response.status != 200) {
                let errorBody = switch (Text.decodeUtf8(response.body)) {
                    case (?text) { text };
                    case null { "Unknown error" };
                };
                return #err("Stripe API error: " # Nat.toText(response.status) # " - " # errorBody);
            };
            
            // Parse JSON response
            let responseText = switch (Text.decodeUtf8(response.body)) {
                case (?text) { text };
                case null { return #err("Failed to decode response") };
            };
            
            // 🔍 LOG: Full response for debugging
            Debug.print("📦 [Stripe] PaymentIntent Response (length: " # Nat.toText(Text.size(responseText)) # "): " # responseText);
            
            // Extract fields from JSON (simplified parsing)
            let id = extractJsonField(responseText, "id");
            let clientSecret = extractJsonField(responseText, "client_secret");
            
            switch (id, clientSecret) {
                case (?idVal, ?secretVal) {
                    #ok({
                        id = idVal;
                        clientSecret = secretVal;
                        amount = amountInCents;
                    })
                };
                case (_, _) {
                    // Return full response to UI for debugging
                    let truncatedResponse = if (Text.size(responseText) > 500) {
                        let firstPart = Text.toArray(responseText);
                        var result = "";
                        var i = 0;
                        label l loop {
                            if (i >= 500) break l;
                            if (i >= firstPart.size()) break l;
                            result #= Text.fromChar(firstPart[i]);
                            i += 1;
                        };
                        result # "... (truncated)"
                    } else {
                        responseText
                    };
                    #err("Failed to parse Stripe PaymentIntent response - missing id or client_secret. Response: " # truncatedResponse)
                };
            };
            
        } catch (error) {
            #err("HTTP request failed: " # Error.message(error))
        };
    };
    
    /**
     * Create a Stripe Checkout Session (for subscriptions)
     * 🔐 BACKEND ONLY - Secret key never exposed to frontend
     */
    public func createCheckoutSession(
        config: StripeConfig,
        priceId: Text,
        userPrincipal: Principal,
        tier: Text,
        successUrl: Text,
        cancelUrl: Text
    ) : async Result.Result<{
        id: Text;
        url: Text;
    }, Text> {
        
        // 🔍 LOG: Function called
        Debug.print("🚀 [Stripe] createCheckoutSession called");
        Debug.print("📋 [Stripe] Price ID: " # priceId);
        Debug.print("👤 [Stripe] User Principal: " # Principal.toText(userPrincipal));
        Debug.print("🎯 [Stripe] Tier: " # tier);
        
        let url = "https://api.stripe.com/v1/checkout/sessions";
        
        let body = 
            "payment_method_types[0]=card" #
            "&line_items[0][price]=" # priceId #
            "&line_items[0][quantity]=1" #
            "&mode=subscription" #
            "&success_url=" # urlEncode(successUrl) #
            "&cancel_url=" # urlEncode(cancelUrl) #
            "&client_reference_id=" # Principal.toText(userPrincipal) #
            "&metadata[user_principal]=" # Principal.toText(userPrincipal) #
            "&metadata[tier]=" # tier #
            "&metadata[platform]=kontext" #
            "&allow_promotion_codes=true" #
            "&billing_address_collection=auto" #
            "&subscription_data[metadata][user_principal]=" # Principal.toText(userPrincipal) #
            "&subscription_data[metadata][tier]=" # tier;
        
        Debug.print("📤 [Stripe] Request body prepared (length: " # Nat.toText(Text.size(body)) # " chars)");
        
        let headers = [
            { name = "Authorization"; value = "Bearer " # config.secretKey },
            { name = "Content-Type"; value = "application/x-www-form-urlencoded" }
        ];
        
        let request = {
            url = url;
            max_response_bytes = ?(10000 : Nat64);
            headers = headers;
            body = ?Text.encodeUtf8(body);
            method = #post;
            transform = null;
            is_replicated = ?false; // 🔥 Non-replicated
        };
        
        try {
            Debug.print("🌐 [Stripe] Sending HTTP request to Stripe API...");
            Cycles.add(500_000_000);
            let response = await ic.http_request(request);
            
            Debug.print("📥 [Stripe] Response received with status: " # Nat.toText(response.status));
            
            if (response.status != 200) {
                let errorBody = switch (Text.decodeUtf8(response.body)) {
                    case (?text) { text };
                    case null { "Unknown error" };
                };
                Debug.print("❌ [Stripe] API error response: " # errorBody);
                return #err("Stripe API error: " # Nat.toText(response.status) # " - " # errorBody);
            };
            
            let responseText = switch (Text.decodeUtf8(response.body)) {
                case (?text) { text };
                case null { return #err("Failed to decode response") };
            };
            
            // 🔍 LOG: Full response for debugging
            Debug.print("📦 [Stripe] Checkout Session Response (length: " # Nat.toText(Text.size(responseText)) # "): " # responseText);
            
            let id = extractJsonField(responseText, "id");
            let sessionUrl = extractJsonField(responseText, "url");
            
            // 🔍 LOG: Detailed parsing debug
            Debug.print("🔍 [Stripe] Extracted ID: " # debug_show(id));
            Debug.print("🔍 [Stripe] Extracted URL: " # debug_show(sessionUrl));
            Debug.print("🔍 [Stripe] Searching for pattern in response...");
            Debug.print("🔍 [Stripe] Contains '\"id\":'? " # debug_show(Text.contains(responseText, #text "\"id\":")));
            Debug.print("🔍 [Stripe] Contains '\"url\":'? " # debug_show(Text.contains(responseText, #text "\"url\":")));
            
            // 🔍 LOG: Parsed fields
            Debug.print("🔍 [Stripe] Parsed ID: " # debug_show(id));
            Debug.print("🔍 [Stripe] Parsed URL: " # debug_show(sessionUrl));
            
            switch (id, sessionUrl) {
                case (?idVal, ?urlVal) {
                    Debug.print("✅ [Stripe] Checkout session created successfully");
                    #ok({
                        id = idVal;
                        url = urlVal;
                    })
                };
                case (_, _) {
                    Debug.print("❌ [Stripe] Failed to parse required fields from response");
                    Debug.print("📄 [Stripe] Full response: " # responseText);
                    // Return full response to UI for debugging
                    let truncatedResponse = if (Text.size(responseText) > 500) {
                        // Truncate to first 500 chars to avoid huge error messages
                        let firstPart = Text.toArray(responseText);
                        var result = "";
                        var i = 0;
                        label l loop {
                            if (i >= 500) break l;
                            if (i >= firstPart.size()) break l;
                            result #= Text.fromChar(firstPart[i]);
                            i += 1;
                        };
                        result # "... (truncated)"
                    } else {
                        responseText
                    };
                    #err("Failed to parse Stripe response - missing id or url field. Response: " # truncatedResponse)
                };
            };
            
        } catch (error) {
            let errorMsg = Error.message(error);
            Debug.print("💥 [Stripe] createCheckoutSession HTTP request exception: " # errorMsg);
            #err("HTTP request failed: " # errorMsg)
        };
    };
    
    /**
     * Verify a Payment Intent status
     * 🔐 BACKEND ONLY
     */
    public func verifyPaymentIntent(
        config: StripeConfig,
        paymentIntentId: Text
    ) : async Result.Result<{
        id: Text;
        status: Text;
        amount: Nat;
        currency: Text;
    }, Text> {
        
        let url = "https://api.stripe.com/v1/payment_intents/" # paymentIntentId;
        
        let headers = [
            { name = "Authorization"; value = "Bearer " # config.secretKey }
        ];
        
        let request = {
            url = url;
            max_response_bytes = ?(10000 : Nat64);
            headers = headers;
            body = null;
            method = #get;
            transform = null;
            is_replicated = ?false; // 🔥 Non-replicated
        };
        
        try {
            Cycles.add(500_000_000);
            let response = await ic.http_request(request);
            
            if (response.status != 200) {
                return #err("Failed to verify payment: " # Nat.toText(response.status));
            };
            
            let responseText = switch (Text.decodeUtf8(response.body)) {
                case (?text) { text };
                case null { return #err("Failed to decode response") };
            };
            
            // 🔍 LOG: Full response for debugging
            Debug.print("📦 [Stripe] Payment Verification Response (length: " # Nat.toText(Text.size(responseText)) # "): " # responseText);
            
            let id = extractJsonField(responseText, "id");
            let status = extractJsonField(responseText, "status");
            let amountStr = extractJsonField(responseText, "amount");
            let currency = extractJsonField(responseText, "currency");
            
            switch (id, status, amountStr, currency) {
                case (?idVal, ?statusVal, ?amtStr, ?curr) {
                    let amount = switch (textToNat(amtStr)) {
                        case (?n) { n };
                        case null { 0 };
                    };
                    
                    #ok({
                        id = idVal;
                        status = statusVal;
                        amount = amount;
                        currency = curr;
                    })
                };
                case (_, _, _, _) {
                    // Return full response to UI for debugging
                    let truncatedResponse = if (Text.size(responseText) > 500) {
                        let firstPart = Text.toArray(responseText);
                        var result = "";
                        var i = 0;
                        label l loop {
                            if (i >= 500) break l;
                            if (i >= firstPart.size()) break l;
                            result #= Text.fromChar(firstPart[i]);
                            i += 1;
                        };
                        result # "... (truncated)"
                    } else {
                        responseText
                    };
                    #err("Failed to parse payment verification response. Response: " # truncatedResponse)
                };
            };
            
        } catch (error) {
            #err("HTTP request failed: " # Error.message(error))
        };
    };
    
    /**
     * Create a Billing Portal Session
     * 🔐 BACKEND ONLY
     */
    public func createBillingPortalSession(
        config: StripeConfig,
        customerId: Text,
        returnUrl: Text
    ) : async Result.Result<{ url: Text }, Text> {
        
        let url = "https://api.stripe.com/v1/billing_portal/sessions";
        
        let body = 
            "customer=" # customerId #
            "&return_url=" # urlEncode(returnUrl);
        
        let headers = [
            { name = "Authorization"; value = "Bearer " # config.secretKey },
            { name = "Content-Type"; value = "application/x-www-form-urlencoded" }
        ];
        
        let request = {
            url = url;
            max_response_bytes = ?(10000 : Nat64);
            headers = headers;
            body = ?Text.encodeUtf8(body);
            method = #post;
            transform = null;
            is_replicated = ?false; // 🔥 Non-replicated
        };
        
        try {
            Cycles.add(500_000_000);
            let response = await ic.http_request(request);
            
            if (response.status != 200) {
                return #err("Failed to create billing portal: " # Nat.toText(response.status));
            };
            
            let responseText = switch (Text.decodeUtf8(response.body)) {
                case (?text) { text };
                case null { return #err("Failed to decode response") };
            };
            
            // 🔍 LOG: Full response for debugging
            Debug.print("📦 [Stripe] Billing Portal Response (length: " # Nat.toText(Text.size(responseText)) # "): " # responseText);
            
            let portalUrl = extractJsonField(responseText, "url");
            
            switch (portalUrl) {
                case (?urlVal) {
                    #ok({ url = urlVal })
                };
                case null {
                    // Return full response to UI for debugging
                    let truncatedResponse = if (Text.size(responseText) > 500) {
                        let firstPart = Text.toArray(responseText);
                        var result = "";
                        var i = 0;
                        label l loop {
                            if (i >= 500) break l;
                            if (i >= firstPart.size()) break l;
                            result #= Text.fromChar(firstPart[i]);
                            i += 1;
                        };
                        result # "... (truncated)"
                    } else {
                        responseText
                    };
                    #err("Failed to parse billing portal response. Response: " # truncatedResponse)
                };
            };
            
        } catch (error) {
            #err("HTTP request failed: " # Error.message(error))
        };
    };
    
    /**
     * Search for customer by user principal
     * 🔐 BACKEND ONLY
     */
    public func searchCustomer(
        config: StripeConfig,
        userPrincipal: Principal
    ) : async Result.Result<?{ customerId: Text; email: ?Text }, Text> {
        
        let searchQuery = "metadata['user_principal']:'" # Principal.toText(userPrincipal) # "'";
        let url = "https://api.stripe.com/v1/customers/search?query=" # urlEncode(searchQuery) # "&limit=1";
        
        let headers = [
            { name = "Authorization"; value = "Bearer " # config.secretKey }
        ];
        
        let request = {
            url = url;
            max_response_bytes = ?(10000 : Nat64);
            headers = headers;
            body = null;
            method = #get;
            transform = null;
            is_replicated = ?false; // 🔥 Non-replicated
        };
        
        try {
            Cycles.add(500_000_000);
            let response = await ic.http_request(request);
            
            if (response.status != 200) {
                return #err("Customer search failed: " # Nat.toText(response.status));
            };
            
            let responseText = switch (Text.decodeUtf8(response.body)) {
                case (?text) { text };
                case null { return #err("Failed to decode response") };
            };
            
            // 🔍 LOG: Full response for debugging
            Debug.print("📦 [Stripe] Customer Search Response (length: " # Nat.toText(Text.size(responseText)) # "): " # responseText);
            
            // Check if data array has results
            if (Text.contains(responseText, #text "\"data\":[]")) {
                return #ok(null); // No customer found
            };
            
            let customerId = extractJsonField(responseText, "id");
            let email = extractJsonField(responseText, "email");
            
            switch (customerId) {
                case (?id) {
                    #ok(?{ customerId = id; email = email })
                };
                case null {
                    #ok(null) // No customer found
                };
            };
            
        } catch (error) {
            #err("HTTP request failed: " # Error.message(error))
        };
    };
    
    // ===== HELPER FUNCTIONS =====
    
    /**
     * Simple JSON field extraction (for basic use cases)
     * Handles both "field":"value" and "field": "value" (with space)
     * For production, consider using a proper JSON parser library
     */
    private func extractJsonField(json: Text, fieldName: Text) : ?Text {
        // Try pattern with no space: "field":"value"
        let pattern1 = "\"" # fieldName # "\":\"";
        // Try pattern with space: "field": "value"
        let pattern2 = "\"" # fieldName # "\": \"";
        
        var pattern = pattern1;
        if (not Text.contains(json, #text pattern1)) {
            if (not Text.contains(json, #text pattern2)) {
                Debug.print("❌ [extractJsonField] Field '" # fieldName # "' not found with either pattern");
                return null;
            };
            pattern := pattern2;
        };
        
        Debug.print("✅ [extractJsonField] Found field '" # fieldName # "' with pattern: " # pattern);
        
        let parts = Text.split(json, #text pattern);
        var iter = parts;
        
        // Skip first part (before field)
        let _ = iter.next();
        
        // Get value part
        switch (iter.next()) {
            case (?valuePart) {
                Debug.print("🔍 [extractJsonField] Value part starts with: " # debug_show(Text.size(valuePart)) # " chars");
                // Find the closing quote (ASCII 34)
                let quoteChar : Char = '\u{0022}';
                let endQuote = Text.split(valuePart, #char quoteChar);
                var endIter = endQuote;
                let extractedValue = endIter.next();
                Debug.print("✅ [extractJsonField] Extracted value: " # debug_show(extractedValue));
                extractedValue
            };
            case null { 
                Debug.print("❌ [extractJsonField] No value part found");
                null 
            };
        };
    };
    
    /**
     * URL encode a string
     */
    private func urlEncode(text: Text) : Text {
        // Basic URL encoding (expand as needed)
        var result = text;
        result := Text.replace(result, #text " ", "%20");
        result := Text.replace(result, #text ":", "%3A");
        result := Text.replace(result, #text "/", "%2F");
        result := Text.replace(result, #text "?", "%3F");
        result := Text.replace(result, #text "&", "%26");
        result := Text.replace(result, #text "=", "%3D");
        result
    };
    
    /**
     * Convert Text to Nat
     */
    private func textToNat(text: Text) : ?Nat {
        var result: Nat = 0;
        for (char in text.chars()) {
            let digit = switch (char) {
                case ('0') { 0 };
                case ('1') { 1 };
                case ('2') { 2 };
                case ('3') { 3 };
                case ('4') { 4 };
                case ('5') { 5 };
                case ('6') { 6 };
                case ('7') { 7 };
                case ('8') { 8 };
                case ('9') { 9 };
                case (_) { return null };
            };
            result := result * 10 + digit;
        };
        ?result
    };
}

