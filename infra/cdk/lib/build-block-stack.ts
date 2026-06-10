import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { buildPipelineAsl } from "./pipeline-asl";
import { BuildBlockAlarms } from "./alarms";

export interface BuildBlockStackProps extends cdk.StackProps {
  stage: string;
}

export class BuildBlockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BuildBlockStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // ── S3 ────────────────────────────────────────────────────────────────
    const corpusBucket = new s3.Bucket(this, "CorpusBucket", {
      bucketName: `build-block-corpus-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const plansBucket = new s3.Bucket(this, "PlansBucket", {
      bucketName: `build-block-plans-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── VPC (no NAT — cost minimized) ─────────────────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Aurora pgvector access",
      allowAllOutbound: true,
    });
    // Allow Lambda security group to connect (added below after Lambda SG created)

    // ── Aurora Serverless v2 + pgvector ───────────────────────────────────
    const cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      defaultDatabaseName: "buildblock",
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // ── Cognito ───────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `build-block-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: { minLength: 10, requireDigits: true, requireSymbols: true },
    });

    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userPassword: true, userSrp: true },
    });

    // ── Secrets Manager ───────────────────────────────────────────────────
    // Store sensitive values in Secrets Manager; Lambdas read via SDK at cold start.
    // Populate these secrets after first deploy:
    //   aws secretsmanager put-secret-value --secret-id build-block/db-password-{stage} --secret-string "yourpassword"
    //   aws secretsmanager put-secret-value --secret-id build-block/stripe-{stage} --secret-string '{"secret_key":"sk_live_...","webhook_secret":"whsec_..."}'

    const dbSecret = new secretsmanager.Secret(this, "DbSecret", {
      secretName: `build-block/db-password-${stage}`,
      description: "Aurora DB password for build-block app user",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "buildblock_app" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    const stripeSecret = new secretsmanager.Secret(this, "StripeSecret", {
      secretName: `build-block/stripe-${stage}`,
      description: "Stripe secret key and webhook secret",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({ secret_key: "", webhook_secret: "" })
      ),
    });

    // ── Shared Lambda config ──────────────────────────────────────────────
    const sharedEnv: Record<string, string> = {
      AWS_REGION_NAME: this.region,
      CORPUS_BUCKET: corpusBucket.bucketName,
      PLANS_BUCKET: plansBucket.bucketName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      // DB URL uses secret reference; password resolved at runtime via config.py
      DB_HOST: cluster.clusterEndpoint.hostname,
      DB_NAME: "buildblock",
      DB_SECRET_ARN: dbSecret.secretArn,
      STRIPE_SECRET_ARN: stripeSecret.secretArn,
      WEB_URL: process.env.WEB_URL ?? "https://your-domain.com",
    };

    const bedrockPolicy = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:Converse"],
      resources: ["*"],
    });

    // Lambda Layer: Python dependencies (built by scripts/build-lambda.ps1)
    // Run `.\scripts\build-lambda.ps1` before `cdk deploy`.
    const depsLayer = new lambda.LayerVersion(this, "DepsLayer", {
      layerVersionName: `build-block-deps-${stage}`,
      code: lambda.Code.fromAsset("../../dist/lambda-layer"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: "Build-Block Python dependencies (reportlab, psycopg, boto3, stripe, etc.)",
    });

    // Application source code only — fast to update, no dep rebuild needed
    const pythonCode = lambda.Code.fromAsset("../../dist/lambda-src.zip");

    // Shared layer list — attached to every Lambda
    const layers = [depsLayer];

    // ── API Lambda ────────────────────────────────────────────────────────
    const apiHandler = new lambda.Function(this, "ApiHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.generate.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: sharedEnv,
    });
    apiHandler.addToRolePolicy(bedrockPolicy);
    corpusBucket.grantRead(apiHandler);
    plansBucket.grantReadWrite(apiHandler);

    // ── Pipeline worker Lambda ────────────────────────────────────────────
    const workerHandler = new lambda.Function(this, "PipelineWorker", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.pipeline_worker.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: sharedEnv,
    });
    workerHandler.addToRolePolicy(bedrockPolicy);
    corpusBucket.grantRead(workerHandler);

    // ── Finalize Lambda ───────────────────────────────────────────────────
    const finalizeHandler = new lambda.Function(this, "FinalizeHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.finalize.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });
    plansBucket.grantReadWrite(finalizeHandler);

    // ── Step Functions (real ASL) ─────────────────────────────────────────
    const asl = buildPipelineAsl(
      workerHandler.functionArn,
      finalizeHandler.functionArn,
    );

    const stateMachine = new sfn.StateMachine(this, "GenerationWorkflow", {
      stateMachineName: `build-block-generation-${stage}`,
      definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(asl)),
    });

    stateMachine.grantStartExecution(apiHandler);
    workerHandler.grantInvoke(stateMachine);
    finalizeHandler.grantInvoke(stateMachine);

    // Grant all Lambdas read access to secrets
    const allLambdas = [
      apiHandler, workerHandler, finalizeHandler,
    ];
    for (const fn of allLambdas) {
      dbSecret.grantRead(fn);
      stripeSecret.grantRead(fn);
    }

    // Pass state machine ARN to API handler
    apiHandler.addEnvironment("STATE_MACHINE_ARN", stateMachine.stateMachineArn);

    // ── Job-status Lambda ─────────────────────────────────────────────────
    const jobsHandler = new lambda.Function(this, "JobsHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.jobs.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
    });

    // ── Plans list Lambda ─────────────────────────────────────────────────
    const plansHandler = new lambda.Function(this, "PlansHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.plans.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
    });

    // ── Stripe Lambdas ────────────────────────────────────────────────────
    const checkoutHandler = new lambda.Function(this, "CheckoutHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.checkout.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: sharedEnv,
    });

    const webhookHandler = new lambda.Function(this, "WebhookHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.stripe_webhook.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: sharedEnv,
    });

    const portalHandler = new lambda.Function(this, "PortalHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.portal.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: sharedEnv,
    });

    const accountHandler = new lambda.Function(this, "AccountHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.account.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: sharedEnv,
    });

    // ── API Gateway HTTP API ──────────────────────────────────────────────
    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: `build-block-${stage}`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ["Authorization", "Content-Type"],
      },
    });

    httpApi.addRoutes({
      path: "/generate",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("GenerateIntegration", apiHandler),
    });

    httpApi.addRoutes({
      path: "/jobs/{jobId}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("JobsIntegration", jobsHandler),
    });

    httpApi.addRoutes({
      path: "/plans",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("PlansIntegration", plansHandler),
    });

    httpApi.addRoutes({
      path: "/plans/{planId}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("PlanDetailIntegration", plansHandler),
    });

    httpApi.addRoutes({
      path: "/checkout",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CheckoutIntegration", checkoutHandler),
    });

    httpApi.addRoutes({
      path: "/webhooks/stripe",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("WebhookIntegration", webhookHandler),
    });

    httpApi.addRoutes({
      path: "/portal",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("PortalIntegration", portalHandler),
    });

    httpApi.addRoutes({
      path: "/account",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("AccountIntegration", accountHandler),
    });

    // ── Admin Lambdas ─────────────────────────────────────────────────────
    const mkAdmin = (id: string, handlerPath: string) =>
      new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: handlerPath,
        code: pythonCode,
        layers,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment: sharedEnv,
      });

    const adminStats   = mkAdmin("AdminStats",   "build_block.handlers.admin.stats.handler");
    const adminJobs    = mkAdmin("AdminJobs",    "build_block.handlers.admin.jobs.handler");
    const adminUsers   = mkAdmin("AdminUsers",   "build_block.handlers.admin.users.handler");
    const adminPrompts = mkAdmin("AdminPrompts", "build_block.handlers.admin.prompts.handler");
    const adminCorpus  = mkAdmin("AdminCorpus",  "build_block.handlers.admin.corpus.handler");
    corpusBucket.grantRead(adminCorpus);

    httpApi.addRoutes({
      path: "/admin/stats",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminStatsInt", adminStats),
    });
    httpApi.addRoutes({
      path: "/admin/jobs",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminJobsInt", adminJobs),
    });
    httpApi.addRoutes({
      path: "/admin/users",
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminUsersInt", adminUsers),
    });
    httpApi.addRoutes({
      path: "/admin/users/{userId}/{action}",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminUserActionInt", adminUsers),
    });
    httpApi.addRoutes({
      path: "/admin/prompts",
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminPromptsInt", adminPrompts),
    });
    httpApi.addRoutes({
      path: "/admin/corpus",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminCorpusInt", adminCorpus),
    });
    httpApi.addRoutes({
      path: "/admin/corpus/{docId}/{action}",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminCorpusActionInt", adminCorpus),
    });

    // ── Export Lambda ─────────────────────────────────────────────────────
    const exportHandler = new lambda.Function(this, "ExportHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.export.handler",
      code: pythonCode,
      layers,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,   // ReportLab + python-docx need headroom
      environment: sharedEnv,
    });
    plansBucket.grantReadWrite(exportHandler);

    httpApi.addRoutes({
      path: "/plans/{planId}/export",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("ExportIntegration", exportHandler),
    });

    // ── WAF (REGIONAL) ────────────────────────────────────────────────────
    // Protects the HTTP API with:
    //   1. AWS Managed Common Rule Set  (SQLi, XSS, known bad inputs)
    //   2. AWS Managed Known Bad Inputs (log4j, Spring4Shell, etc.)
    //   3. IP-based rate limit: 200 req / 5 min per IP
    const webAcl = new wafv2.CfnWebACL(this, "ApiWaf", {
      name: `build-block-${stage}`,
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `build-block-waf-${stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "CommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CommonRuleSet",
            sampledRequestsEnabled: false,
          },
        },
        {
          name: "KnownBadInputs",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "KnownBadInputs",
            sampledRequestsEnabled: false,
          },
        },
        {
          name: "IpRateLimit",
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 200,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "IpRateLimit",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate WAF with the HTTP API stage
    const defaultStage = httpApi.defaultStage?.node.defaultChild as cdk.CfnResource | undefined;
    if (defaultStage) {
      new wafv2.CfnWebACLAssociation(this, "WafAssociation", {
        resourceArn: `arn:aws:apigateway:${this.region}::/apis/${httpApi.apiId}/stages/$default`,
        webAclArn: webAcl.attrArn,
      });
    }

    // ── CloudWatch alarms ─────────────────────────────────────────────────
    new BuildBlockAlarms(this, "Alarms", {
      stage,
      alarmEmail: process.env.ALARM_EMAIL,
      lambdaFunctions: [
        apiHandler, workerHandler, finalizeHandler,
        jobsHandler, plansHandler,
        checkoutHandler, webhookHandler, portalHandler, accountHandler,
        exportHandler,
        adminStats, adminJobs, adminUsers, adminPrompts, adminCorpus,
      ],
      workerFunction: workerHandler,
      apiFunction: apiHandler,
      wafMetricName: `build-block-${stage}`,
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "CorpusBucketName", { value: corpusBucket.bucketName });
    new cdk.CfnOutput(this, "PlansBucketName", { value: plansBucket.bucketName });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "StateMachineArn", { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, "DbClusterEndpoint", { value: cluster.clusterEndpoint.hostname });
  }
}
