/**
 * Returns the Step Functions ASL definition for the generation pipeline.
 * Stages:
 *   1. intake_enrichment  (fast model)
 *   2. outline            (quality model → parsed JSON)
 *   3. section writers    (parallel map over sections, quality model)
 *   4. consistency        (fast model, no RAG)
 *   5. executive_summary  (quality model)
 *   6. finalize           (persist + S3)
 *
 * For preview jobs only the `preview` stage runs, then finalize.
 */

export function buildPipelineAsl(workerArn: string, finalizeArn: string): object {
  const invokeWorker = (stage: string) => ({
    Type: "Task",
    Resource: "arn:aws:states:::lambda:invoke",
    Parameters: {
      FunctionName: workerArn,
      Payload: {
        "job_id.$": "$.job_id",
        "user_id.$": "$.user_id",
        "tier.$": "$.tier",
        "is_preview.$": "$.is_preview",
        "input.$": "$.input",
        "prior_sections.$": "$.prior_sections",
        "outline.$": "$.outline",
        stage,
      },
    },
    ResultSelector: { "result.$": "$.Payload" },
    ResultPath: `$.stage_results.${stage}`,
    Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 2 }],
  });

  return {
    Comment: "Build-Block generation pipeline",
    StartAt: "CheckPreview",
    States: {
      CheckPreview: {
        Type: "Choice",
        Choices: [
          {
            Variable: "$.is_preview",
            BooleanEquals: true,
            Next: "PreviewSection",
          },
        ],
        Default: "IntakeEnrichment",
      },

      // ── Preview path ──────────────────────────────────────────────────────
      PreviewSection: {
        ...invokeWorker("preview"),
        Next: "Finalize",
      },

      // ── Full plan path ────────────────────────────────────────────────────
      IntakeEnrichment: {
        ...invokeWorker("intake_enrichment"),
        Next: "Outline",
      },

      Outline: {
        ...invokeWorker("outline"),
        // Merge parsed outline back into root state for downstream stages
        ResultPath: "$.outline_result",
        Next: "ExtractOutline",
      },

      ExtractOutline: {
        Type: "Pass",
        Parameters: {
          "job_id.$": "$.job_id",
          "user_id.$": "$.user_id",
          "tier.$": "$.tier",
          "is_preview.$": "$.is_preview",
          "input.$": "$.input",
          "prior_sections.$": "$.prior_sections",
          "outline.$": "$.outline_result.result.outline",
          "stage_results.$": "$.stage_results",
        },
        Next: "SectionWriters",
      },

      SectionWriters: {
        Type: "Parallel",
        Branches: [
          { StartAt: "MarketAnalysis", States: { MarketAnalysis: { ...invokeWorker("market_analysis"), End: true } } },
          { StartAt: "Financials",     States: { Financials:     { ...invokeWorker("financials"),      End: true } } },
          { StartAt: "Competitive",    States: { Competitive:    { ...invokeWorker("competitive_landscape"), End: true } } },
          { StartAt: "Operations",     States: { Operations:     { ...invokeWorker("operations"),      End: true } } },
        ],
        ResultPath: "$.parallel_results",
        Next: "MergeParallel",
      },

      MergeParallel: {
        Type: "Pass",
        Comment: "Flatten parallel branch results into prior_sections for consistency pass",
        Parameters: {
          "job_id.$": "$.job_id",
          "user_id.$": "$.user_id",
          "tier.$": "$.tier",
          "is_preview.$": "$.is_preview",
          "input.$": "$.input",
          "prior_sections.$": "$.stage_results",
          "outline.$": "$.outline",
        },
        Next: "Consistency",
      },

      Consistency: {
        ...invokeWorker("consistency"),
        Next: "ExecutiveSummary",
      },

      ExecutiveSummary: {
        ...invokeWorker("executive_summary"),
        Next: "Finalize",
      },

      // ── Finalize (both paths) ─────────────────────────────────────────────
      Finalize: {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        Parameters: {
          FunctionName: finalizeArn,
          Payload: {
            "job_id.$": "$.job_id",
            "user_id.$": "$.user_id",
            "is_preview.$": "$.is_preview",
            "sections.$": "$.stage_results",
            tokens_by_stage: {},
          },
        },
        ResultPath: "$.finalize_result",
        End: true,
      },
    },
  };
}
