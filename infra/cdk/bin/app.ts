#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BuildBlockStack } from "../lib/build-block-stack";

const app = new cdk.App();

new BuildBlockStack(app, "BuildBlockDev", {
  env: {
    account: "058170691476",
    region: "us-east-1",
  },
  stage: "dev",
});
