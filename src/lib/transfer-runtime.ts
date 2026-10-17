// Real-money execution stays unavailable until a payment partner is integrated.
// Production may explicitly enable a labelled sandbox for demonstrations.
export function transferSandboxEnabled(environment: NodeJS.ProcessEnv = process.env) {
  const setting = environment.FINBRIDGE_ENABLE_TRANSFER_SANDBOX;
  if (setting !== undefined) return setting === "true";
  return environment.NODE_ENV !== "production";
}
