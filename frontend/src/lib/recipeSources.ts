import type { RecipeSourceCredential } from "@/types";

export function getPlanningSourceReadiness(sources: RecipeSourceCredential[]) {
  const planningSources = sources.filter((source) => source.supportedForPlanning);
  const readySources = planningSources.filter((source) => source.planningReady);
  if (readySources.length > 0) {
    return {
      readySources,
      ready: true,
      message: `${readySources.map((source) => source.label).join(", ")} connected`
    };
  }

  const configuredPlanningSource = planningSources.find((source) => source.configured);
  if (configuredPlanningSource) {
    return {
      readySources,
      ready: false,
      message: `${configuredPlanningSource.label} is configured but not ready: ${formatReadinessIssues(configuredPlanningSource.planningReadinessIssues)}`
    };
  }

  const configuredUnsupportedSource = sources.find((source) => source.configured);
  if (configuredUnsupportedSource) {
    return {
      readySources,
      ready: false,
      message: `${configuredUnsupportedSource.label} is configured, but live planning currently supports America's Test Kitchen.`
    };
  }

  return {
    readySources,
    ready: false,
    message: "Connect and enable America's Test Kitchen with a username and saved password before live planning."
  };
}

export function formatReadinessIssues(issues: string[]) {
  if (issues.length === 0) return "unknown requirement is missing.";
  return issues.map((issue) => issue.replace(/\.$/, "").toLowerCase()).join(", ") + ".";
}
