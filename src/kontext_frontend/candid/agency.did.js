export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const ExecutionLimits = IDL.Record({
    'maxExecutionsPerHour' : IDL.Nat,
    'maxConcurrentTasks' : IDL.Nat,
    'timeoutSeconds' : IDL.Nat,
  });
  const ScheduleType = IDL.Variant({
    'interval' : IDL.Record({ 'seconds' : IDL.Nat }),
    'cron' : IDL.Record({ 'expression' : IDL.Text }),
    'once' : IDL.Record({ 'timestamp' : IDL.Int }),
    'recurring' : IDL.Record({ 'pattern' : IDL.Text, 'nextRun' : IDL.Int }),
  });
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
  const RetryConfig = IDL.Record({
    'backoffMultiplier' : IDL.Float64,
    'maxRetries' : IDL.Nat,
    'initialDelaySeconds' : IDL.Nat,
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
  const AgentStep = IDL.Record({
    'triggerConfig' : IDL.Opt(TriggerConfig),
    'inputTemplate' : IDL.Text,
    'agentName' : IDL.Text,
    'requiresApproval' : IDL.Bool,
    'agentConfig' : IDL.Opt(AgentConfig),
    'retryOnFailure' : IDL.Bool,
    'timeout' : IDL.Opt(IDL.Nat),
    'agentCanisterId' : IDL.Principal,
  });
  const ConnectionCondition = IDL.Variant({
    'always' : IDL.Null,
    'onSuccess' : IDL.Null,
    'onFailure' : IDL.Null,
    'ifContains' : IDL.Record({ 'field' : IDL.Text, 'value' : IDL.Text }),
    'ifEquals' : IDL.Record({ 'field' : IDL.Text, 'value' : IDL.Text }),
  });
  const AgentConnection = IDL.Record({
    'sourceStepIndex' : IDL.Nat,
    'targetStepIndex' : IDL.Nat,
    'condition' : ConnectionCondition,
  });
  const Result_4 = IDL.Variant({ 'ok' : TriggerConfig, 'err' : IDL.Text });
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
  const Agency = IDL.Record({
    'id' : IDL.Text,
    'defaultTimeout' : IDL.Nat,
    'created' : IDL.Int,
    'owner' : IDL.Principal,
    'name' : IDL.Text,
    'globalTriggers' : IDL.Vec(TriggerConfig),
    'description' : IDL.Text,
    'triggerEnabled' : IDL.Bool,
    'connections' : IDL.Vec(AgentConnection),
    'enabled' : IDL.Bool,
    'steps' : IDL.Vec(AgentStep),
    'updated' : IDL.Int,
    'maxConcurrentExecutions' : IDL.Nat,
    'authorizedManagers' : IDL.Vec(IDL.Principal),
    'executionMode' : IDL.Text,
  });
  const ExecutionStatus = IDL.Variant({
    'scheduled' : IDL.Null,
    'waiting_approval' : IDL.Null,
    'pending' : IDL.Null,
    'completed' : IDL.Null,
    'triggered' : IDL.Null,
    'failed' : IDL.Null,
    'running' : IDL.Null,
    'paused' : IDL.Null,
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
    'updatedAt' : IDL.Int,
    'triggerType' : IDL.Text,
    'cyclesUsed' : IDL.Nat,
    'triggeredBy' : IDL.Text,
    'mcpToolsUsed' : IDL.Vec(IDL.Text),
    'input' : IDL.Text,
    'confidence' : IDL.Opt(IDL.Float64),
    'responseTime' : IDL.Float64,
  });
  const StepResult = IDL.Record({
    'output' : IDL.Text,
    'duration' : IDL.Nat,
    'agentMetrics' : IDL.Opt(AgentMetrics),
    'stepIndex' : IDL.Nat,
    'approvalRequired' : IDL.Bool,
    'agentName' : IDL.Text,
    'agentTask' : IDL.Opt(Task),
    'error' : IDL.Opt(IDL.Text),
    'approvalStatus' : IDL.Opt(IDL.Text),
    'triggerUsed' : IDL.Opt(IDL.Text),
    'retryCount' : IDL.Nat,
    'success' : IDL.Bool,
    'input' : IDL.Text,
  });
  const Execution = IDL.Record({
    'id' : IDL.Text,
    'startTime' : IDL.Int,
    'status' : ExecutionStatus,
    'pausedAt' : IDL.Opt(IDL.Int),
    'totalAgents' : IDL.Nat,
    'endTime' : IDL.Opt(IDL.Int),
    'metadata' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'agencyId' : IDL.Text,
    'results' : IDL.Vec(StepResult),
    'error' : IDL.Opt(IDL.Text),
    'triggerSource' : IDL.Opt(IDL.Text),
    'currentStep' : IDL.Nat,
    'cyclesUsed' : IDL.Nat,
    'triggeredBy' : IDL.Text,
    'agencyName' : IDL.Text,
    'input' : IDL.Text,
    'agentFailures' : IDL.Nat,
    'executionMode' : IDL.Text,
    'resumedAt' : IDL.Opt(IDL.Int),
  });
  const AgencyMetrics = IDL.Record({
    'totalExecutions' : IDL.Nat,
    'averageExecutionTime' : IDL.Float64,
    'lastExecutionAt' : IDL.Opt(IDL.Int),
    'pendingApprovals' : IDL.Nat,
    'totalCyclesUsed' : IDL.Nat,
    'successfulExecutions' : IDL.Nat,
    'failedExecutions' : IDL.Nat,
    'executionSuccessRate' : IDL.Float64,
    'activeAgents' : IDL.Nat,
    'triggersConfigured' : IDL.Nat,
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
  const WebhookRequest = IDL.Record({
    'signature' : IDL.Opt(IDL.Text),
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'triggerId' : IDL.Text,
  });
  const WorkflowConfig = IDL.Record({
    'defaultTimeout' : IDL.Nat,
    'defaultExecutionMode' : IDL.Text,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'enabled' : IDL.Bool,
    'maxConcurrentExecutions' : IDL.Nat,
  });
  const InitializationResult = IDL.Record({
    'managers' : IDL.Vec(IDL.Text),
    'message' : IDL.Text,
  });
  const Result_3 = IDL.Variant({
    'ok' : InitializationResult,
    'err' : IDL.Text,
  });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  return IDL.Service({
    'cancelExecution' : IDL.Func([IDL.Text], [Result], []),
    'cleanupOldExecutions' : IDL.Func([IDL.Nat], [Result_1], []),
    'createAgency' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(AgentStep), IDL.Vec(AgentConnection)],
        [Result_1],
        [],
      ),
    'createAgencyTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          TriggerType,
          IDL.Text,
          IDL.Opt(RetryConfig),
          IDL.Opt(ExecutionLimits),
        ],
        [Result_4],
        [],
      ),
    'deleteAgency' : IDL.Func([IDL.Text], [Result], []),
    'deleteAgencyTrigger' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'executeAgency' : IDL.Func([IDL.Text, IDL.Text], [Result_1], []),
    'executeAgencyTrigger' : IDL.Func([IDL.Text, IDL.Text], [Result_1], []),
    'getActiveErrors' : IDL.Func([], [IDL.Vec(ErrorLog)], ['query']),
    'getAgencies' : IDL.Func([], [IDL.Vec(Agency)], ['query']),
    'getAgency' : IDL.Func([IDL.Text], [IDL.Opt(Agency)], ['query']),
    'getAgencyExecutions' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(Execution)],
        ['query'],
      ),
    'getAgencyMetrics' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(AgencyMetrics)],
        ['query'],
      ),
    'getAgencyTriggers' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(TriggerConfig)],
        ['query'],
      ),
    'getAgentHealth' : IDL.Func([IDL.Principal], [IDL.Text], []),
    'getAgentMetrics' : IDL.Func([IDL.Principal], [IDL.Opt(AgentMetrics)], []),
    'getAgentTasks' : IDL.Func([IDL.Principal, IDL.Nat], [IDL.Vec(Task)], []),
    'getAllAgencyMetrics' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, AgencyMetrics))],
        ['query'],
      ),
    'getAllExecutions' : IDL.Func([], [IDL.Vec(Execution)], ['query']),
    'getApprovalHistory' : IDL.Func([IDL.Nat], [IDL.Vec(Approval)], ['query']),
    'getAuthorizedManagers' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'getExecution' : IDL.Func([IDL.Text], [IDL.Opt(Execution)], ['query']),
    'getOwner' : IDL.Func([], [IDL.Principal], ['query']),
    'getPendingApprovals' : IDL.Func([], [IDL.Vec(Approval)], ['query']),
    'getRecentActivity' : IDL.Func(
        [IDL.Nat],
        [IDL.Vec(ActivityEvent)],
        ['query'],
      ),
    'getRegisteredAgents' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, AgentIdentity))],
        ['query'],
      ),
    'getStatus' : IDL.Func(
        [],
        [
          IDL.Record({
            'initializedAt' : IDL.Int,
            'executionCount' : IDL.Nat,
            'initialized' : IDL.Bool,
            'owner' : IDL.Principal,
            'scheduledExecutions' : IDL.Nat,
            'activeExecutions' : IDL.Nat,
            'totalCyclesUsed' : IDL.Nat,
            'agencyCount' : IDL.Nat,
            'registeredAgents' : IDL.Nat,
            'authorizedManagers' : IDL.Vec(IDL.Principal),
            'triggerCount' : IDL.Nat,
            'kontextOwner' : IDL.Opt(IDL.Principal),
          }),
        ],
        ['query'],
      ),
    'getTriggerHistory' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat],
        [IDL.Vec(Execution)],
        ['query'],
      ),
    'getWebhooks' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, TriggerConfig))],
        ['query'],
      ),
    'handleWebhook' : IDL.Func(
        [WebhookRequest],
        [
          IDL.Variant({
            'ok' : IDL.Record({
              'executionId' : IDL.Opt(IDL.Text),
              'message' : IDL.Text,
            }),
            'err' : IDL.Record({ 'code' : IDL.Nat, 'message' : IDL.Text }),
          }),
        ],
        [],
      ),
    'health' : IDL.Func([], [IDL.Text], ['query']),
    'initialize' : IDL.Func([IDL.Principal], [Result], []),
    'initializeFromIndependentUI' : IDL.Func([WorkflowConfig], [Result_3], []),
    'initializeFromKontext' : IDL.Func([WorkflowConfig], [Result_3], []),
    'pauseExecution' : IDL.Func([IDL.Text], [Result], []),
    'processApproval' : IDL.Func(
        [IDL.Text, IDL.Bool, IDL.Opt(IDL.Text)],
        [Result_1],
        [],
      ),
    'processEventQueue' : IDL.Func([], [Result_1], []),
    'registerAgent' : IDL.Func([IDL.Principal, AgentConfig], [Result_1], []),
    'registerWebhook' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [Result_1],
        [],
      ),
    'resolveError' : IDL.Func([IDL.Text], [Result], []),
    'resumeExecution' : IDL.Func([IDL.Text], [Result], []),
    'retryFailedStep' : IDL.Func([IDL.Text, IDL.Nat], [Result_1], []),
    'setKontextOwner' : IDL.Func([IDL.Principal], [Result_1], []),
    'toggleAgency' : IDL.Func([IDL.Text], [Result_2], []),
    'toggleAgencyTrigger' : IDL.Func([IDL.Text, IDL.Text], [Result_1], []),
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
    'unregisterAgent' : IDL.Func([IDL.Principal], [Result], []),
    'unregisterWebhook' : IDL.Func([IDL.Text], [Result], []),
    'updateAgency' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(AgentStep),
          IDL.Vec(AgentConnection),
        ],
        [Result],
        [],
      ),
    'updateAgencyTrigger' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Bool),
          IDL.Opt(IDL.Text),
        ],
        [Result],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
