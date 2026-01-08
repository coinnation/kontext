import { AgentDeploymentService } from './services/AgentDeploymentService';

// Deploy an agent
const result = await AgentDeploymentService.deployAgent({
  agentName: "My AI Agent",
  serverPairId: "pair-123",
  frontendCanisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  backendCanisterId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
  projectId: "project-123",
  userCanisterId: "user-canister-id",
  identity: identity,
  principal: principal
}, (progress) => {
  console.log(`${progress.stage}: ${progress.message} (${progress.percent}%)`);
});

if (result.success) {
  console.log('Frontend:', result.frontendUrl);
  console.log('Backend:', result.backendUrl);
} else {
  console.error('Deployment failed:', result.error);
}