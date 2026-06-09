import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ChronofactClient } from "./chronofactClient.js";

export function createChronofactAgentTools(client: ChronofactClient) {
  const preserveEvidence = createTool({
    id: "preserveEvidence",
    description: "Preserve a SHA-256 digest through Chronofact.",
    inputSchema: z.object({
      organizationId: z.string(),
      filename: z.string(),
      sha256: z.string(),
      assetTitle: z.string().optional(),
      assetType: z.string().optional()
    }),
    execute: async (input) => client.preserveEvidence(input)
  });

  const preserveEvidenceVersion = createTool({
    id: "preserveEvidenceVersion",
    description: "Create a new version for an existing Chronofact asset and preserve its SHA-256 digest.",
    inputSchema: z.object({
      organizationId: z.string(),
      assetId: z.string(),
      filename: z.string(),
      sha256: z.string(),
      assetType: z.string().optional()
    }),
    execute: async (input) => client.preserveEvidenceVersion(input)
  });

  const verifyEvidence = createTool({
    id: "verifyEvidence",
    description: "Verify a SHA-256 digest against Chronofact evidence records.",
    inputSchema: z.object({
      organizationId: z.string(),
      sha256: z.string(),
      proofId: z.string().nullable().optional(),
      versionId: z.string().nullable().optional()
    }),
    execute: async (input) => client.verifyEvidence(input)
  });

  const explainEvidence = createTool({
    id: "explainEvidence",
    description: "Explain an evidence verification result using Chronofact's AI explanation endpoint.",
    inputSchema: z.object({
      assetId: z.string().nullable().optional(),
      versionId: z.string().nullable().optional(),
      scenario: z.string().nullable().optional()
    }),
    execute: async (input) => client.explainEvidence(input)
  });

  return { preserveEvidence, preserveEvidenceVersion, verifyEvidence, explainEvidence };
}
