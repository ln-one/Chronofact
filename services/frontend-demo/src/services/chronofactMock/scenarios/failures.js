import { proofAccessScenarios } from "./proofAccess";
import { serviceFailureScenarios } from "./serviceFailures";
import { tamperScenarios } from "./tamper";

export const failureScenarios = {
  ...tamperScenarios,
  ...proofAccessScenarios,
  ...serviceFailureScenarios,
};
