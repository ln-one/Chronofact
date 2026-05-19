import { failureScenarios } from "./failures";
import { successScenarios } from "./success";

export const scenarios = {
  ...successScenarios,
  ...failureScenarios,
};

export function getFallbackScenario(key) {
  return scenarios[key] || scenarios.normalSubmission;
}
