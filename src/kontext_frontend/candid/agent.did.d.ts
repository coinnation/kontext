
import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ActivityEvent {
  'id' : string,
  'metadata' : Array<[string, string]>,
  'taskId' : [] | [string],
  'timestamp' : bigint,
  'details' : string,
  'severity' : string,
  'eventType' : string,
}
export interface AgentConfig {
  'confidenceThreshold' : number,
  'defaultMcpServers' : Array<string>,
  'requireApproval' : boolean,
  'temperature' : number,
  'name' : string,
  'description' : string,
  'mcpClientEndpoint' : string,
  'instructions' : string,
  'claudeApiKey' : string,
  'maxTokens' : bigint,
  'mcpTokens' : Array<[string, string]>,
}
export interface AgentIdentity {
  'confidenceThreshold' : number,
  'defaultMcpServers' : Array<string>,
  'requireApproval' : boolean,
  'owner' : Principal,
  'temperature' : number,
  'name' : string,
  'createdAt' : bigint,
  'description' : string,
  'agentId' : string,
  'mcpClientEndpoint' : string,
  'instructions' : string,
  'claudeApiKey' : string,
  'maxTokens' : bigint,
  'authorizedManagers' : Array<Principal>,
  'mcpTokens' : Array<[string, string]>,
}
export interface AgentMetrics {
  'totalTasks' : bigint,
  'pendingApprovals' : bigint,
  'successRate' : number,
  'mcpToolsConfigured' : bigint,
  'totalCyclesUsed' : bigint,
  'activeErrors' : bigint,
  'totalApprovals' : bigint,
  'avgResponseTime' : number,
  'failedTasks' : bigint,
  'successfulTasks' : bigint,
}
export interface ApiKeyDebugInfo {
  'storedKeyPreview' : string,
  'requestBodyFullMasked' : string,
  'storedKeyLength' : bigint,
  'requestBodyApiKeySection' : string,
  'currentIdentityKeyPreview' : string,
  'storedKeyFullMasked' : string,
  'requestBodyPreview' : string,
  'currentIdentityKeyLength' : bigint,
  'requestBodyLength' : bigint,
}
export interface Approval {
  'id' : string,
  'status' : string,
  'action' : string,
  'approvedAt' : [] | [bigint],
  'approvedBy' : [] | [Principal],
  'reasoning' : string,
  'taskId' : string,
  'timestamp' : bigint,
  'confidence' : number,
}
export type ConditionType = {
    'http_check' : { 'url' : string, 'expected_status' : bigint }
  } |
  {
    'threshold' : { 'metric' : string, 'value' : number, 'operator' : string }
  } |
  {
    'custom' : { 'expression' : string, 'variables' : Array<[string, string]> }
  } |
  { 'webhook' : { 'method' : string, 'endpoint' : string } };
export interface ConversationMessage {
  'content' : string,
  'role' : string,
  'toolCalls' : [] | [Array<ToolCall>],
  'timestamp' : bigint,
}
export interface ErrorLog {
  'id' : string,
  'resolved' : boolean,
  'context' : string,
  'stackTrace' : [] | [string],
  'errorMessage' : string,
  'errorType' : string,
  'taskId' : [] | [string],
  'timestamp' : bigint,
}
export interface ExecutionLimits {
  'maxExecutionsPerHour' : bigint,
  'maxConcurrentTasks' : bigint,
  'timeoutSeconds' : bigint,
}
export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : string } |
  { 'err' : string };
export type Result_2 = { 'ok' : boolean } |
  { 'err' : string };
export interface RetryConfig {
  'backoffMultiplier' : number,
  'maxRetries' : bigint,
  'initialDelaySeconds' : bigint,
}
export type ScheduleType = { 'interval' : { 'seconds' : bigint } } |
  { 'cron' : { 'expression' : string } } |
  { 'once' : { 'timestamp' : bigint } } |
  { 'recurring' : { 'pattern' : string, 'nextRun' : bigint } };
export interface Task {
  'id' : string,
  'triggerMetadata' : Array<[string, string]>,
  'status' : string,
  'result' : [] | [string],
  'conversationHistory' : Array<ConversationMessage>,
  'createdAt' : bigint,
  'jobId' : [] | [string],
  'updatedAt' : bigint,
  'triggerType' : string,
  'cyclesUsed' : bigint,
  'triggeredBy' : string,
  'mcpToolsUsed' : Array<string>,
  'input' : string,
  'confidence' : [] | [number],
  'responseTime' : number,
}
export interface ToolCall {
  'id' : string,
  'result' : [] | [string],
  'toolName' : string,
  'success' : boolean,
  'arguments' : string,
}
export interface TriggerConfig {
  'id' : string,
  'owner' : Principal,
  'inputTemplate' : string,
  'name' : string,
  'createdAt' : bigint,
  'executionLimits' : [] | [ExecutionLimits],
  'description' : string,
  'enabled' : boolean,
  'updatedAt' : bigint,
  'triggerType' : TriggerType,
  'nextRun' : [] | [bigint],
  'conditions' : Array<[string, string]>,
  'triggerCount' : bigint,
  'lastResult' : [] | [string],
  'lastTriggered' : [] | [bigint],
  'retryConfig' : [] | [RetryConfig],
}
export type TriggerType = { 'api' : { 'source' : string, 'apiKey' : string } } |
  { 'scheduled' : { 'schedule' : ScheduleType } } |
  { 'agent' : { 'sourceCanisterId' : Principal, 'sourceAgentId' : string } } |
  { 'webhook' : { 'signature' : [] | [string], 'source' : string } } |
  { 'event' : { 'source' : string, 'eventType' : string } } |
  { 'manual' : { 'userId' : Principal } } |
  { 'external' : { 'identifier' : string, 'systemType' : string } } |
  { 'condition' : { 'condition' : ConditionType } };
export interface WebhookRequest {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'triggerId' : string,
}
export interface _SERVICE {
  'createConditionTrigger' : ActorMethod<
    [
      string,
      string,
      ConditionType,
      string,
      [] | [RetryConfig],
      [] | [ExecutionLimits],
    ],
    Result_1
  >,
  'createScheduledTrigger' : ActorMethod<
    [
      string,
      string,
      ScheduleType,
      string,
      [] | [RetryConfig],
      [] | [ExecutionLimits],
    ],
    Result_1
  >,
  'createWebhookTrigger' : ActorMethod<
    [
      string,
      string,
      string,
      [] | [string],
      string,
      [] | [RetryConfig],
      [] | [ExecutionLimits],
    ],
    Result_1
  >,
  'deleteTrigger' : ActorMethod<[string], Result>,
  'executeTask' : ActorMethod<
    [string, [] | [Array<string>], Array<[string, string]>, [] | [boolean]],
    Result_1
  >,
  'executeTrigger' : ActorMethod<[string], Result_1>,
  'exportConfig' : ActorMethod<[], [] | [AgentConfig]>,
  'getActiveErrors' : ActorMethod<[], Array<ErrorLog>>,
  'getAgentIdentity' : ActorMethod<[], [] | [AgentIdentity]>,
  'getAllTasks' : ActorMethod<[bigint], Array<Task>>,
  'getApiKeyDebugInfo' : ActorMethod<[], ApiKeyDebugInfo>,
  'getAuthorizedManagers' : ActorMethod<[], Array<Principal>>,
  'getKontextOwner' : ActorMethod<[], [] | [Principal]>,
  'getMetrics' : ActorMethod<[], AgentMetrics>,
  'getPendingApprovals' : ActorMethod<[], Array<Approval>>,
  'getRecentActivity' : ActorMethod<[bigint], Array<ActivityEvent>>,
  'getTask' : ActorMethod<[string], [] | [Task]>,
  'getTrigger' : ActorMethod<[string], [] | [TriggerConfig]>,
  'getTriggerHistory' : ActorMethod<[string, bigint], Array<Task>>,
  'getTriggers' : ActorMethod<[], Array<TriggerConfig>>,
  'handleJobCompletion' : ActorMethod<
    [WebhookRequest],
    { 'ok' : { 'message' : string } } |
      { 'err' : { 'code' : bigint, 'message' : string } }
  >,
  'handleWebhook' : ActorMethod<
    [WebhookRequest],
    { 'ok' : { 'message' : string } } |
      { 'err' : { 'code' : bigint, 'message' : string } }
  >,
  'http_request' : ActorMethod<
    [
      {
        'url' : string,
        'method' : string,
        'body' : Uint8Array | number[],
        'headers' : Array<HttpHeader>,
      },
    ],
    HttpResponse
  >,
  'initializeAgent' : ActorMethod<[AgentConfig], Result_1>,
  'initializeFromIndependentUI' : ActorMethod<[AgentConfig], Result_1>,
  'initializeFromKontext' : ActorMethod<[AgentConfig], Result_1>,
  'processApproval' : ActorMethod<[string, boolean], Result_1>,
  'processEventQueue' : ActorMethod<[], Result_1>,
  'setKontextOwner' : ActorMethod<[Principal], Result_1>,
  'toggleTrigger' : ActorMethod<[string], Result_2>,
  'transform' : ActorMethod<
    [{ 'context' : Uint8Array | number[], 'response' : HttpResponse }],
    HttpResponse
  >,
  'updateAgentConfig' : ActorMethod<[AgentConfig], Result_1>,
  'updateTrigger' : ActorMethod<
    [
      string,
      [] | [string],
      [] | [string],
      [] | [boolean],
      [] | [string],
      [] | [RetryConfig],
      [] | [ExecutionLimits],
    ],
    Result
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
