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
export interface Agency {
  'id' : string,
  'defaultTimeout' : bigint,
  'created' : bigint,
  'owner' : Principal,
  'name' : string,
  'globalTriggers' : Array<TriggerConfig>,
  'description' : string,
  'triggerEnabled' : boolean,
  'connections' : Array<AgentConnection>,
  'enabled' : boolean,
  'steps' : Array<AgentStep>,
  'updated' : bigint,
  'maxConcurrentExecutions' : bigint,
  'authorizedManagers' : Array<Principal>,
  'executionMode' : string,
}
export interface AgencyMetrics {
  'totalExecutions' : bigint,
  'averageExecutionTime' : number,
  'lastExecutionAt' : [] | [bigint],
  'pendingApprovals' : bigint,
  'totalCyclesUsed' : bigint,
  'successfulExecutions' : bigint,
  'failedExecutions' : bigint,
  'executionSuccessRate' : number,
  'activeAgents' : bigint,
  'triggersConfigured' : bigint,
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
export interface AgentConnection {
  'sourceStepIndex' : bigint,
  'targetStepIndex' : bigint,
  'condition' : ConnectionCondition,
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
export interface AgentStep {
  'triggerConfig' : [] | [TriggerConfig],
  'inputTemplate' : string,
  'agentName' : string,
  'requiresApproval' : boolean,
  'agentConfig' : [] | [AgentConfig],
  'retryOnFailure' : boolean,
  'timeout' : [] | [bigint],
  'agentCanisterId' : Principal,
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
export type ConnectionCondition = { 'always' : null } |
  { 'onSuccess' : null } |
  { 'onFailure' : null } |
  { 'ifContains' : { 'field' : string, 'value' : string } } |
  { 'ifEquals' : { 'field' : string, 'value' : string } };
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
export interface Execution {
  'id' : string,
  'startTime' : bigint,
  'status' : ExecutionStatus,
  'pausedAt' : [] | [bigint],
  'totalAgents' : bigint,
  'endTime' : [] | [bigint],
  'metadata' : Array<[string, string]>,
  'agencyId' : string,
  'results' : Array<StepResult>,
  'error' : [] | [string],
  'triggerSource' : [] | [string],
  'currentStep' : bigint,
  'cyclesUsed' : bigint,
  'triggeredBy' : string,
  'agencyName' : string,
  'input' : string,
  'agentFailures' : bigint,
  'executionMode' : string,
  'resumedAt' : [] | [bigint],
}
export interface ExecutionLimits {
  'maxExecutionsPerHour' : bigint,
  'maxConcurrentTasks' : bigint,
  'timeoutSeconds' : bigint,
}
export type ExecutionStatus = { 'scheduled' : null } |
  { 'waiting_approval' : null } |
  { 'pending' : null } |
  { 'completed' : null } |
  { 'triggered' : null } |
  { 'failed' : null } |
  { 'running' : null } |
  { 'paused' : null };
export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export interface InitializationResult {
  'managers' : Array<string>,
  'message' : string,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : string } |
  { 'err' : string };
export type Result_2 = { 'ok' : boolean } |
  { 'err' : string };
export type Result_3 = { 'ok' : InitializationResult } |
  { 'err' : string };
export type Result_4 = { 'ok' : TriggerConfig } |
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
export interface StepResult {
  'output' : string,
  'duration' : bigint,
  'agentMetrics' : [] | [AgentMetrics],
  'stepIndex' : bigint,
  'approvalRequired' : boolean,
  'agentName' : string,
  'agentTask' : [] | [Task],
  'error' : [] | [string],
  'approvalStatus' : [] | [string],
  'triggerUsed' : [] | [string],
  'retryCount' : bigint,
  'success' : boolean,
  'input' : string,
}
export interface Task {
  'id' : string,
  'triggerMetadata' : Array<[string, string]>,
  'status' : string,
  'result' : [] | [string],
  'conversationHistory' : Array<ConversationMessage>,
  'createdAt' : bigint,
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
  'signature' : [] | [string],
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'triggerId' : string,
}
export interface WorkflowConfig {
  'defaultTimeout' : bigint,
  'defaultExecutionMode' : string,
  'name' : string,
  'description' : string,
  'enabled' : boolean,
  'maxConcurrentExecutions' : bigint,
}
export interface _SERVICE {
  'cancelExecution' : ActorMethod<[string], Result>,
  'cleanupOldExecutions' : ActorMethod<[bigint], Result_1>,
  'createAgency' : ActorMethod<
    [string, string, Array<AgentStep>, Array<AgentConnection>],
    Result_1
  >,
  'createAgencyTrigger' : ActorMethod<
    [
      string,
      string,
      string,
      TriggerType,
      string,
      [] | [RetryConfig],
      [] | [ExecutionLimits],
    ],
    Result_4
  >,
  'deleteAgency' : ActorMethod<[string], Result>,
  'deleteAgencyTrigger' : ActorMethod<[string, string], Result>,
  'executeAgency' : ActorMethod<[string, string], Result_1>,
  'executeAgencyTrigger' : ActorMethod<[string, string], Result_1>,
  'getActiveErrors' : ActorMethod<[], Array<ErrorLog>>,
  'getAgencies' : ActorMethod<[], Array<Agency>>,
  'getAgency' : ActorMethod<[string], [] | [Agency]>,
  'getAgencyExecutions' : ActorMethod<[string], Array<Execution>>,
  'getAgencyMetrics' : ActorMethod<[string], [] | [AgencyMetrics]>,
  'getAgencyTriggers' : ActorMethod<[string], Array<TriggerConfig>>,
  'getAgentHealth' : ActorMethod<[Principal], string>,
  'getAgentMetrics' : ActorMethod<[Principal], [] | [AgentMetrics]>,
  'getAgentTasks' : ActorMethod<[Principal, bigint], Array<Task>>,
  'getAllAgencyMetrics' : ActorMethod<[], Array<[string, AgencyMetrics]>>,
  'getAllExecutions' : ActorMethod<[], Array<Execution>>,
  'getApprovalHistory' : ActorMethod<[bigint], Array<Approval>>,
  'getAuthorizedManagers' : ActorMethod<[], Array<Principal>>,
  'getExecution' : ActorMethod<[string], [] | [Execution]>,
  'getOwner' : ActorMethod<[], Principal>,
  'getPendingApprovals' : ActorMethod<[], Array<Approval>>,
  'getRecentActivity' : ActorMethod<[bigint], Array<ActivityEvent>>,
  'getRegisteredAgents' : ActorMethod<[], Array<[Principal, AgentIdentity]>>,
  'getStatus' : ActorMethod<
    [],
    {
      'initializedAt' : bigint,
      'executionCount' : bigint,
      'initialized' : boolean,
      'owner' : Principal,
      'scheduledExecutions' : bigint,
      'activeExecutions' : bigint,
      'totalCyclesUsed' : bigint,
      'agencyCount' : bigint,
      'registeredAgents' : bigint,
      'authorizedManagers' : Array<Principal>,
      'triggerCount' : bigint,
      'kontextOwner' : [] | [Principal],
    }
  >,
  'getTriggerHistory' : ActorMethod<[string, string, bigint], Array<Execution>>,
  'getWebhooks' : ActorMethod<[], Array<[string, TriggerConfig]>>,
  'handleWebhook' : ActorMethod<
    [WebhookRequest],
    { 'ok' : { 'executionId' : [] | [string], 'message' : string } } |
      { 'err' : { 'code' : bigint, 'message' : string } }
  >,
  'health' : ActorMethod<[], string>,
  'initialize' : ActorMethod<[Principal], Result>,
  'initializeFromIndependentUI' : ActorMethod<[WorkflowConfig], Result_3>,
  'initializeFromKontext' : ActorMethod<[WorkflowConfig], Result_3>,
  'pauseExecution' : ActorMethod<[string], Result>,
  'processApproval' : ActorMethod<[string, boolean, [] | [string]], Result_1>,
  'processEventQueue' : ActorMethod<[], Result_1>,
  'registerAgent' : ActorMethod<[Principal, AgentConfig], Result_1>,
  'registerWebhook' : ActorMethod<[string, string, [] | [string]], Result_1>,
  'resolveError' : ActorMethod<[string], Result>,
  'resumeExecution' : ActorMethod<[string], Result>,
  'retryFailedStep' : ActorMethod<[string, bigint], Result_1>,
  'setKontextOwner' : ActorMethod<[Principal], Result_1>,
  'toggleAgency' : ActorMethod<[string], Result_2>,
  'toggleAgencyTrigger' : ActorMethod<[string, string], Result_1>,
  'transform' : ActorMethod<
    [{ 'context' : Uint8Array | number[], 'response' : HttpResponse }],
    HttpResponse
  >,
  'unregisterAgent' : ActorMethod<[Principal], Result>,
  'unregisterWebhook' : ActorMethod<[string], Result>,
  'updateAgency' : ActorMethod<
    [string, string, string, Array<AgentStep>, Array<AgentConnection>],
    Result
  >,
  'updateAgencyTrigger' : ActorMethod<
    [
      string,
      string,
      [] | [string],
      [] | [string],
      [] | [boolean],
      [] | [string],
    ],
    Result
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
