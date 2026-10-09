import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';

export interface VideoOrchestrationProps {
    scriptWriterLambdaArn: string;
}

export class VideoOrchestration extends Construct {
    public readonly stateMachineArn: string;

    constructor(scope: Construct, id: string, props: VideoOrchestrationProps) {
        super(scope, id);
        const stack = cdk.Stack.of(this);

        const alertsTopic = new sns.Topic(this, 'VanguardVideoAlerts', {
            topicName: 'VanguardVideoAlertsTopic',
            displayName: 'Vanguard Video Engine Alerts'
        });

        const mediaConvertRole = new iam.Role(this, 'MediaConvertExecutionRole', {
            roleName: 'VanguardMediaConvertRole',
            assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
        });
        
        mediaConvertRole.addToPolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
            resources: ['*'] 
        }));

        const sfnRole = new iam.Role(this, 'LongFormVideoSfnRole', {
            assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
        });

        sfnRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                'lambda:InvokeFunction',
                'bedrock:InvokeModel',
                'bedrock:StartAsyncInvoke',
                'polly:StartSpeechSynthesisTask',
                'mediaconvert:CreateJob',
                'sns:Publish',
                's3:PutObject',
                's3:GetObject'
            ],
            resources: ['*'],
        }));

        sfnRole.addToPolicy(new iam.PolicyStatement({
            actions: ['iam:PassRole'],
            resources: [mediaConvertRole.roleArn],
        }));

        const aslFilePath = path.join(__dirname, 'long-form-video-sfn.json');
        let aslDefinition = fs.readFileSync(aslFilePath, 'utf8');

        aslDefinition = aslDefinition
            .replace(/SCRIPT_WRITER_LAMBDA_ARN/g, props.scriptWriterLambdaArn)
            .replace(/MEDIACONVERT_ROLE_ARN/g, mediaConvertRole.roleArn)
            .replace(/SNS_TOPIC_ARN/g, alertsTopic.topicArn)
            .replace(/ACCOUNT_ID/g, stack.account)
            .replace(/REGION/g, stack.region);

        const stateMachine = new sfn.CfnStateMachine(this, 'LongFormVideoStateMachine', {
            stateMachineName: 'VanguardLongFormVideoEngine',
            roleArn: sfnRole.roleArn,
            definitionString: aslDefinition,
        });

        this.stateMachineArn = stateMachine.attrArn;
    }
}