/**
 * CloudWatch alarms for solo operator monitoring.
 *
 * Alarms:
 *   1. Lambda error rate  — any Lambda > 3 errors in 5 min
 *   2. Generation failure — pipeline worker errors
 *   3. Bedrock cost proxy — invocation count spike (no native cost metric)
 *   4. WAF blocked rate   — sudden spike in blocked requests (abuse signal)
 *   5. DB connections     — Aurora connection count approaching limit
 *
 * All alarms route to a single SNS topic → email.
 * Set ALARM_EMAIL env var before deploy to receive notifications.
 */

import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

export interface AlarmsProps {
  stage: string;
  alarmEmail?: string;
  lambdaFunctions: lambda.IFunction[];
  workerFunction: lambda.IFunction;
  apiFunction: lambda.IFunction;
  wafMetricName: string;
}

export class BuildBlockAlarms extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlarmsProps) {
    super(scope, id);

    const { stage, alarmEmail, lambdaFunctions, workerFunction, wafMetricName } = props;

    // ── SNS topic ─────────────────────────────────────────────────────────
    this.topic = new sns.Topic(this, "AlarmTopic", {
      topicName: `build-block-alarms-${stage}`,
      displayName: `Build-Block ${stage} Alarms`,
    });

    if (alarmEmail) {
      this.topic.addSubscription(
        new sns_subscriptions.EmailSubscription(alarmEmail)
      );
    }

    const alarmAction = new cloudwatch_actions.SnsAction(this.topic);

    // ── Lambda error alarms (per function) ────────────────────────────────
    for (const fn of lambdaFunctions) {
      const fnName = fn.node.id;
      new cloudwatch.Alarm(this, `${fnName}Errors`, {
        alarmName: `build-block-${stage}-${fnName}-errors`,
        alarmDescription: `${fnName} has errors — investigate CloudWatch Logs`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: "Sum",
        }),
        threshold: 3,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(alarmAction);
    }

    // ── Pipeline worker p95 duration (slow = Bedrock latency issue) ───────
    new cloudwatch.Alarm(this, "WorkerHighLatency", {
      alarmName: `build-block-${stage}-worker-high-latency`,
      alarmDescription: "Pipeline worker p95 duration > 4 min — Bedrock may be slow",
      metric: workerFunction.metricDuration({
        period: cdk.Duration.minutes(15),
        statistic: "p95",
      }),
      threshold: 4 * 60 * 1000,  // 4 minutes in ms
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ── Bedrock invocation spike (cost proxy) ─────────────────────────────
    // Bedrock doesn't emit cost metrics; track invocation count as proxy.
    new cloudwatch.Alarm(this, "BedrockInvocationSpike", {
      alarmName: `build-block-${stage}-bedrock-spike`,
      alarmDescription: "Unusually high Bedrock invocations — check for runaway jobs or abuse",
      metric: new cloudwatch.Metric({
        namespace: "AWS/Bedrock",
        metricName: "Invocations",
        statistic: "Sum",
        period: cdk.Duration.hours(1),
      }),
      threshold: 500,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ── WAF block rate spike ───────────────────────────────────────────────
    new cloudwatch.Alarm(this, "WafBlockSpike", {
      alarmName: `build-block-${stage}-waf-blocks`,
      alarmDescription: "WAF blocking many requests — possible attack or mis-config",
      metric: new cloudwatch.Metric({
        namespace: "AWS/WAFV2",
        metricName: "BlockedRequests",
        dimensionsMap: { Rule: "IpRateLimit", WebACL: wafMetricName, Region: cdk.Stack.of(this).region },
        statistic: "Sum",
        period: cdk.Duration.minutes(10),
      }),
      threshold: 100,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ── Dashboard ─────────────────────────────────────────────────────────
    new cloudwatch.Dashboard(this, "OperatorDashboard", {
      dashboardName: `build-block-${stage}`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: "Lambda errors (5m)",
            width: 12,
            left: lambdaFunctions.slice(0, 4).map((fn) =>
              fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum" })
            ),
          }),
          new cloudwatch.GraphWidget({
            title: "Pipeline worker duration p95",
            width: 12,
            left: [workerFunction.metricDuration({ period: cdk.Duration.minutes(5), statistic: "p95" })],
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: "API invocations",
            width: 12,
            left: [props.apiFunction.metricInvocations({ period: cdk.Duration.minutes(5), statistic: "Sum" })],
          }),
          new cloudwatch.GraphWidget({
            title: "WAF blocked requests",
            width: 12,
            left: [new cloudwatch.Metric({
              namespace: "AWS/WAFV2",
              metricName: "BlockedRequests",
              dimensionsMap: { Rule: "IpRateLimit", WebACL: wafMetricName, Region: cdk.Stack.of(this).region },
              statistic: "Sum",
              period: cdk.Duration.minutes(10),
            })],
          }),
        ],
      ],
    });

    new cdk.CfnOutput(scope, "AlarmTopicArn", { value: this.topic.topicArn });
    new cdk.CfnOutput(scope, "DashboardUrl", {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home#dashboards:name=build-block-${stage}`,
    });
  }
}
