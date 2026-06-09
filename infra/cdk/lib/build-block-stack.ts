import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";

export interface BuildBlockStackProps extends cdk.StackProps {
  stage: string;
}

export class BuildBlockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BuildBlockStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    // --- S3: corpus (private) + generated plans ---
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
      lifecycleRules: [{ transitions: [{ storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: cdk.Duration.days(30) }] }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // --- Aurora Serverless v2 + pgvector (cost-minimized) ---
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // Avoid NAT gateway cost; use public subnet + security group for dev
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Aurora access for Build-Block",
      allowAllOutbound: true,
    });

    const cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      defaultDatabaseName: "buildblock",
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // --- Cognito ---
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

    // --- Lambda placeholder (wire Python bundle in implementation phase) ---
    const apiHandler = new lambda.Function(this, "ApiHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "build_block.handlers.generate.handler",
      code: lambda.Code.fromAsset("../../apps/api/src", {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: ["bash", "-c", "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output"],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CORPUS_BUCKET: corpusBucket.bucketName,
        PLANS_BUCKET: plansBucket.bucketName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    corpusBucket.grantRead(apiHandler);
    plansBucket.grantReadWrite(apiHandler);

    // --- API Gateway HTTP API ---
    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: `build-block-${stage}`,
      corsPreflight: {
        allowOrigins: ["*"], // Tighten to Amplify/Vercel domain in prod
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
      },
    });

    // --- Step Functions placeholder ---
    const stateMachine = new sfn.StateMachine(this, "GenerationWorkflow", {
      stateMachineName: `build-block-generation-${stage}`,
      definitionBody: sfn.DefinitionBody.fromString(
        JSON.stringify({
          Comment: "Build-Block generation pipeline — replace with ASL in implementation phase",
          StartAt: "Placeholder",
          States: {
            Placeholder: { Type: "Pass", End: true },
          },
        }),
      ),
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "CorpusBucketName", { value: corpusBucket.bucketName });
    new cdk.CfnOutput(this, "PlansBucketName", { value: plansBucket.bucketName });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "StateMachineArn", { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, "DbClusterEndpoint", { value: cluster.clusterEndpoint.hostname });
  }
}
