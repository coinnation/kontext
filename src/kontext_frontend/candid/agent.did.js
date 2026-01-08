export const idlFactory = ({ IDL }) => {
  const ConditionType = IDL.Variant({
    'http_check' : IDL.Record({
      'url' : IDL.Text,
      'expected_status' : IDL.Nat,
    }),
    'threshold' : IDL.Record({
      'metric' : IDL.Text,
      'value' : IDL.Float64,
      'operator' : IDL.Text,
    }),
    'custom' : IDL.Record({
      'expression' : IDL.Text,
      'variables' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    }),
    'webhook' : IDL.Record({ 'method' : IDL.Text, 'endpoint' : IDL.Text }),
  });
  const RetryConfig = IDL.Record({
    'backoffMultiplier' : IDL.Float64,
    'maxRetries' : IDL.Nat,
    'initialDelaySeconds' : IDL.Nat,
  });
  const ExecutionLimits = IDL.Record({
    'maxExecutionsPerHour' : IDL.Nat,
    'maxConcurrentTasks' : IDL.Nat,
    'timeoutSeconds' : IDL.Nat,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const ScheduleType = IDL.Variant({
    'interval' : IDL.Record({ 'seconds' : IDL.Nat }),
    'cron' : IDL.Record({ 'expression' : IDL.Text }),
    'once' : IDL.Record({ 'timestamp' : IDL.Int }),
    'recurring' : IDL.Record({ 'pattern' : IDL.Text, 'nextRun' : IDL.Int }),
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const AgentConfig = IDL.Record({
    'confidenceThreshold' : IDL.Float64,
    'defaultMcpServers' : IDL.Vec(IDL.Text),
    'requireApproval' : IDL.Bool,
    'temperature' : IDL.Float64,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'mcpClientEndpoint' : IDL.Text,
    'instructions' : IDL.Text,
    'claudeApiKey' : IDL.Text,
    'maxTokens' : IDL.Nat,
    'mcpTokens' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const ErrorLog = IDL.Record({
    'id' : IDL.Text,
    'resolved' : IDL.Bool,
    'context' : IDL.Text,
    'stackTrace' : IDL.Opt(IDL.Text),
    'errorMessage' : IDL.Text,
    'errorType' : IDL.Text,
    'taskId' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Int,
  });
  const AgentIdentity = IDL.Record({
    'confidenceThreshold' : IDL.Float64,
    'defaultMcpServers' : IDL.Vec(IDL.Text),
    'requireApproval' : IDL.Bool,
    'owner' : IDL.Principal,
    'temperature' : IDL.Float64,
    'name' : IDL.Text,
    'createdAt' : IDL.Int,
    'description' : IDL.Text,
    'agentId' : IDL.Text,
    'mcpClientEndpoint' : IDL.Text,
    'instructions' : IDL.Text,
    'claudeApiKey' : IDL.Text,
    'maxTokens' : IDL.Nat,
    'authorizedManagers' : IDL.Vec(IDL.Principal),
    'mcpTokens' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const ToolCall = IDL.Record({
    'id' : IDL.Text,
    'result' : IDL.Opt(IDL.Text),
    'toolName' : IDL.Text,
    'success' : IDL.Bool,
    'arguments' : IDL.Text,
  });
  const ConversationMessage = IDL.Record({
    'content' : IDL.Text,
    'role' : IDL.Text,
    'toolCalls' : IDL.Opt(IDL.Vec(ToolCall)),
    'timestamp' : IDL.Int,
  });
  const Task = IDL.Record({
    'id' : IDL.Text,
    'triggerMetadata' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'status' : IDL.Text,
    'result' : IDL.Opt(IDL.Text),
    'conversationHistory' : IDL.Vec(ConversationMessage),
    'createdAt' : IDL.Int,
    'jobId' : IDL.Opt(IDL.Text),
    'updatedAt' : IDL.Int,
    'triggerType' : IDL.Text,
    'cyclesUsed' : IDL.Nat,
    'triggeredBy' : IDL.Text,
    'mcpToolsUsed' : IDL.Vec(IDL.Text),
    'input' : IDL.Text,
    'confidence' : IDL.Opt(IDL.Float64),
    'responseTime' : IDL.Float64,
  });
  const ApiKeyDebugInfo = IDL.Record({
    'storedKeyPreview' : IDL.Text,
    'requestBodyFullMasked' : IDL.Text,
    'storedKeyLength' : IDL.Nat,
    'requestBodyApiKeySection' : IDL.Text,
    'currentIdentityKeyPreview' : IDL.Text,
    'storedKeyFullMasked' : IDL.Text,
    'requestBodyPreview' : IDL.Text,
    'currentIdentityKeyLength' : IDL.Nat,
    'requestBodyLength' : IDL.Nat,
  });
  const AgentMetrics = IDL.Record({
    'totalTasks' : IDL.Nat,
    'pendingApprovals' : IDL.Nat,
    'successRate' : IDL.Float64,
    'mcpToolsConfigured' : IDL.Nat,
    'totalCyclesUsed' : IDL.Nat,
    'activeErrors' : IDL.Nat,
    'totalApprovals' : IDL.Nat,
    'avgResponseTime' : IDL.Float64,
    'failedTasks' : IDL.Nat,
    'successfulTasks' : IDL.Nat,
  });
  const Approval = IDL.Record({
    'id' : IDL.Text,
    'status' : IDL.Text,
    'action' : IDL.Text,
    'approvedAt' : IDL.Opt(IDL.Int),
    'approvedBy' : IDL.Opt(IDL.Principal),
    'reasoning' : IDL.Text,
    'taskId' : IDL.Text,
    'timestamp' : IDL.Int,
    'confidence' : IDL.Float64,
  });
  const ActivityEvent = IDL.Record({
    'id' : IDL.Text,
    'metadata' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'taskId' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Int,
    'details' : IDL.Text,
    'severity' : IDL.Text,
    'eventType' : IDL.Text,
  });
  const TriggerType = IDL.Variant({
    'api' : IDL.Record({ 'source' : IDL.Text, 'apiKey' : IDL.Text }),
    'scheduled' : IDL.Record({ 'schedule' : ScheduleType }),
    'agent' : IDL.Record({
      'sourceCanisterId' : IDL.Principal,
      'sourceAgentId' : IDL.Text,
    }),
    'webhook' : IDL.Record({
      'signature' : IDL.Opt(IDL.Text),
      'source' : IDL.Text,
    }),
    'event' : IDL.Record({ 'source' : IDL.Text, 'eventType' : IDL.Text }),
    'manual' : IDL.Record({ 'userId' : IDL.Principal }),
    'external' : IDL.Record({
      'identifier' : IDL.Text,
      'systemType' : IDL.Text,
    }),
    'condition' : IDL.Record({ 'condition' : ConditionType }),
  });
  const TriggerConfig = IDL.Record({
    'id' : IDL.Text,
    'owner' : IDL.Principal,
    'inputTemplate' : IDL.Text,
    'name' : IDL.Text,
    'createdAt' : IDL.Int,
    'executionLimits' : IDL.Opt(ExecutionLimits),
    'description' : IDL.Text,
    'enabled' : IDL.Bool,
    'updatedAt' : IDL.Int,
    'triggerType' : TriggerType,
    'nextRun' : IDL.Opt(IDL.Int),
    'conditions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'triggerCount' : IDL.Nat,
    'lastResult' : IDL.Opt(IDL.Text),
    'lastTriggered' : IDL.Opt(IDL.Int),
    'retryConfig' : IDL.Opt(RetryConfig),
  });
  const WebhookRequest = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'triggerId' : IDL.Text,
  });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
  return IDL.Service({
    'createConditionTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          ConditionType,
          IDL.Text,
          IDL.Opt(RetryConfig),
          IDL.Opt(ExecutionLimits),
        ],
        [Result_1],
        [],
      ),
    'createScheduledTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          ScheduleType,
          IDL.Text,
          IDL.Opt(RetryConfig),
          IDL.Opt(ExecutionLimits),
        ],
        [Result_1],
        [],
      ),
    'createWebhookTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Text,
          IDL.Opt(RetryConfig),
          IDL.Opt(ExecutionLimits),
        ],
        [Result_1],
        [],
      ),
    'deleteTrigger' : IDL.Func([IDL.Text], [Result], []),
    'executeTask' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
          IDL.Opt(IDL.Bool),
        ],
        [Result_1],
        [],
      ),
    'executeTrigger' : IDL.Func([IDL.Text], [Result_1], []),
    'exportConfig' : IDL.Func([], [IDL.Opt(AgentConfig)], ['query']),
    'getActiveErrors' : IDL.Func([], [IDL.Vec(ErrorLog)], ['query']),
    'getAgentIdentity' : IDL.Func([], [IDL.Opt(AgentIdentity)], ['query']),
    'getAllTasks' : IDL.Func([IDL.Nat], [IDL.Vec(Task)], ['query']),
    'getApiKeyDebugInfo' : IDL.Func([], [ApiKeyDebugInfo], ['query']),
    'getAuthorizedManagers' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'getKontextOwner' : IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
    'getMetrics' : IDL.Func([], [AgentMetrics], ['query']),
    'getPendingApprovals' : IDL.Func([], [IDL.Vec(Approval)], ['query']),
    'getRecentActivity' : IDL.Func(
        [IDL.Nat],
        [IDL.Vec(ActivityEvent)],
        ['query'],
      ),
    'getTask' : IDL.Func([IDL.Text], [IDL.Opt(Task)], ['query']),
    'getTrigger' : IDL.Func([IDL.Text], [IDL.Opt(TriggerConfig)], []),
    'getTriggerHistory' : IDL.Func([IDL.Text, IDL.Nat], [IDL.Vec(Task)], []),
    'getTriggers' : IDL.Func([], [IDL.Vec(TriggerConfig)], []),
    'handleJobCompletion' : IDL.Func(
        [WebhookRequest],
        [
          IDL.Variant({
            'ok' : IDL.Record({ 'message' : IDL.Text }),
            'err' : IDL.Record({ 'code' : IDL.Nat, 'message' : IDL.Text }),
          }),
        ],
        [],
      ),
    'handleWebhook' : IDL.Func(
        [WebhookRequest],
        [
          IDL.Variant({
            'ok' : IDL.Record({ 'message' : IDL.Text }),
            'err' : IDL.Record({ 'code' : IDL.Nat, 'message' : IDL.Text }),
          }),
        ],
        [],
      ),
    'http_request' : IDL.Func(
        [
          IDL.Record({
            'url' : IDL.Text,
            'method' : IDL.Text,
            'body' : IDL.Vec(IDL.Nat8),
            'headers' : IDL.Vec(HttpHeader),
          }),
        ],
        [HttpResponse],
        ['query'],
      ),
    'initializeAgent' : IDL.Func([AgentConfig], [Result_1], []),
    'initializeFromIndependentUI' : IDL.Func([AgentConfig], [Result_1], []),
    'initializeFromKontext' : IDL.Func([AgentConfig], [Result_1], []),
    'processApproval' : IDL.Func([IDL.Text, IDL.Bool], [Result_1], []),
    'processEventQueue' : IDL.Func([], [Result_1], []),
    'setKontextOwner' : IDL.Func([IDL.Principal], [Result_1], []),
    'toggleTrigger' : IDL.Func([IDL.Text], [Result_2], []),
    'transform' : IDL.Func(
        [
          IDL.Record({
            'context' : IDL.Vec(IDL.Nat8),
            'response' : HttpResponse,
          }),
        ],
        [HttpResponse],
        ['query'],
      ),
    'updateAgentConfig' : IDL.Func([AgentConfig], [Result_1], []),
    'updateTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Bool),
          IDL.Opt(IDL.Text),
          IDL.Opt(RetryConfig),
          IDL.Opt(ExecutionLimits),
        ],
        [Result],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
