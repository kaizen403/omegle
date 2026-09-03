#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin:${PATH}"

ACCOUNT="162668739040"
REGION="ap-south-1"
PROJECT="omegle-vitap"
VPC="vpc-008a1e85aef7a392c"
SUBNET="subnet-0e62195f458cad888"
AMI="ami-094210f044117049d"
INSTANCE_TYPE="t3.xlarge"
UPLOADS_BUCKET="omegle-vitap-uploads-${ACCOUNT}"
OPS_BUCKET="omegle-vitap-ops-${ACCOUNT}"
ECR_REPO="omegle-api"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

tag() {
  printf 'Key=%s,Value=%s' "$1" "$2"
}

ensure_bucket() {
  local bucket="$1"
  if aws s3api head-bucket --bucket "$bucket" --region "$REGION" 2>/dev/null; then
    echo "bucket exists $bucket"
    return
  fi
  aws s3api create-bucket \
    --bucket "$bucket" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  echo "created bucket $bucket"
}

echo "== leftover spend =="
RDS_STATE="$(aws rds describe-db-instances --region us-east-1 --db-instance-identifier explore-aws-db --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo missing)"
if [[ "$RDS_STATE" != "missing" && "$RDS_STATE" != "deleting" ]]; then
  aws rds delete-db-instance \
    --region us-east-1 \
    --db-instance-identifier explore-aws-db \
    --skip-final-snapshot \
    --delete-automated-backups
  echo "deleting RDS explore-aws-db"
else
  echo "RDS leftover status: ${RDS_STATE}"
fi
for id in i-09492fefee6f382bf i-06207864d6fd06fcf; do
  region="us-east-1"
  if [[ "$id" == i-06207864d6fd06fcf ]]; then
    region="ap-south-1"
  fi
  state="$(aws ec2 describe-instances --region "$region" --instance-ids "$id" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo missing)"
  if [[ "$state" != "missing" && "$state" != "terminated" && "$state" != "shutting-down" ]]; then
    aws ec2 terminate-instances --region "$region" --instance-ids "$id" >/dev/null
    echo "terminating $id in $region"
  fi
done

echo "== buckets =="
ensure_bucket "$UPLOADS_BUCKET"
ensure_bucket "$OPS_BUCKET"

aws s3api put-public-access-block --bucket "$UPLOADS_BUCKET" --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false'
aws s3api put-bucket-policy --bucket "$UPLOADS_BUCKET" --policy "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadUploads",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${UPLOADS_BUCKET}/*"
  }]
}
EOF
)"
aws s3api put-bucket-cors --bucket "$UPLOADS_BUCKET" --cors-configuration "$(cat <<EOF
{
  "CORSRules": [{
    "AllowedOrigins": ["https://vitap.in", "https://www.vitap.in", "https://admin.vitap.in", "https://omegle-web.pages.dev", "https://omegle-admin.pages.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}
EOF
)"
aws s3api put-public-access-block --bucket "$OPS_BUCKET" --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
aws s3 cp "${ROOT}/infra/compose.yml" "s3://${OPS_BUCKET}/compose.yml"
aws s3 cp "${ROOT}/infra/Caddyfile" "s3://${OPS_BUCKET}/Caddyfile"
aws s3 cp "${ROOT}/infra/deploy.sh" "s3://${OPS_BUCKET}/deploy.sh"

echo "== ecr =="
if ! aws ecr describe-repositories --region "$REGION" --repository-names "$ECR_REPO" >/dev/null 2>&1; then
  aws ecr create-repository \
    --region "$REGION" \
    --repository-name "$ECR_REPO" \
    --image-scanning-configuration scanOnPush=true \
    --tags "Key=Project,Value=${PROJECT}" >/dev/null
fi

echo "== oidc =="
OIDC_ARN="arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com"
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 f879abce0008e4eb126e4090f9150b1edcd42a17 >/dev/null
fi

echo "== iam roles =="
if ! aws iam get-role --role-name omegle-gha >/dev/null 2>&1; then
  aws iam create-role --role-name omegle-gha --assume-role-policy-document "file://${ROOT}/infra/iam/gha-trust.json" >/dev/null
fi
aws iam put-role-policy --role-name omegle-gha --policy-name omegle-gha --policy-document "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:DescribeRepositories"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${ECR_REPO}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::${OPS_BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:PutParameter"],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/omegle/prod/IMAGE_URI"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:SendCommand"],
      "Resource": [
        "arn:aws:ec2:${REGION}:${ACCOUNT}:instance/*",
        "arn:aws:ssm:${REGION}::document/AWS-RunShellScript"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus", "ec2:StartInstances"],
      "Resource": "*"
    }
  ]
}
EOF
)"

if ! aws iam get-role --role-name omegle-ec2 >/dev/null 2>&1; then
  aws iam create-role --role-name omegle-ec2 --assume-role-policy-document "file://${ROOT}/infra/iam/ec2-trust.json" >/dev/null
fi
aws iam attach-role-policy --role-name omegle-ec2 --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore || true
aws iam put-role-policy --role-name omegle-ec2 --policy-name omegle-ec2 --policy-document "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${ECR_REPO}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::${OPS_BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${UPLOADS_BUCKET}",
        "arn:aws:s3:::${UPLOADS_BUCKET}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/omegle/prod*"
    }
  ]
}
EOF
)"
if ! aws iam get-instance-profile --instance-profile-name omegle-ec2 >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name omegle-ec2 >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name omegle-ec2 --role-name omegle-ec2
  sleep 8
fi

echo "== security group =="
SG_ID="$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=omegle-api" "Name=vpc-id,Values=${VPC}" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  SG_ID="$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name omegle-api \
    --description "Omegle API HTTP from Cloudflare" \
    --vpc-id "$VPC" \
    --tag-specifications "ResourceType=security-group,Tags=[{$(tag Project "$PROJECT")},{$(tag Name omegle-api)}]" \
    --query GroupId --output text)"
fi
for port in 80 443; do
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --ip-permissions \
    "IpProtocol=tcp,FromPort=${port},ToPort=${port},IpRanges=[{CidrIp=0.0.0.0/0,Description=http}]" 2>/dev/null || true
done

echo "== eip =="
ALLOC_ID="$(aws ec2 describe-addresses --region "$REGION" --filters "Name=tag:Name,Values=omegle-api" --query 'Addresses[0].AllocationId' --output text)"
if [[ "$ALLOC_ID" == "None" || -z "$ALLOC_ID" ]]; then
  ALLOC_ID="$(aws ec2 allocate-address --region "$REGION" --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{$(tag Project "$PROJECT")},{$(tag Name omegle-api)}]" --query AllocationId --output text)"
fi
EIP="$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)"

echo "== instance =="
INSTANCE_ID="$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=omegle-api" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
if [[ "$INSTANCE_ID" == "None" || -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(aws ec2 run-instances --region "$REGION" \
    --image-id "$AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --subnet-id "$SUBNET" \
    --security-group-ids "$SG_ID" \
    --iam-instance-profile Name=omegle-ec2 \
    --user-data "file://${ROOT}/infra/cloud-init.sh" \
    --metadata-options HttpTokens=required,HttpPutResponseHopLimit=2 \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,DeleteOnTermination=true}' \
    --tag-specifications "ResourceType=instance,Tags=[{$(tag Project "$PROJECT")},{$(tag Name omegle-api)},{$(tag Environment prod)}]" \
    --count 1 \
    --query 'Instances[0].InstanceId' --output text)"
fi
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
ASSOC="$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$ALLOC_ID" --query 'Addresses[0].InstanceId' --output text)"
if [[ "$ASSOC" != "$INSTANCE_ID" ]]; then
  aws ec2 associate-address --region "$REGION" --allocation-id "$ALLOC_ID" --instance-id "$INSTANCE_ID" >/dev/null
fi

echo "== scheduler role =="
if ! aws iam get-role --role-name omegle-scheduler >/dev/null 2>&1; then
  aws iam create-role --role-name omegle-scheduler --assume-role-policy-document "file://${ROOT}/infra/iam/scheduler-trust.json" >/dev/null
fi
aws iam put-role-policy --role-name omegle-scheduler --policy-name omegle-scheduler --policy-document "$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ec2:StartInstances", "ec2:StopInstances", "ec2:DescribeInstances"],
    "Resource": "*"
  }]
}
EOF
)"
SCHEDULER_ROLE="arn:aws:iam::${ACCOUNT}:role/omegle-scheduler"
sleep 5

create_schedule() {
  local name="$1"
  local cron="$2"
  local action="$3"
  local target
  target="$(python3 - <<PY
import json
print(json.dumps({
  "Arn": "arn:aws:scheduler:::aws-sdk:ec2:${action}",
  "RoleArn": "${SCHEDULER_ROLE}",
  "Input": json.dumps({"InstanceIds": ["${INSTANCE_ID}"]}),
}))
PY
)"
  if aws scheduler get-schedule --region "$REGION" --name "$name" >/dev/null 2>&1; then
    aws scheduler update-schedule --region "$REGION" \
      --name "$name" \
      --schedule-expression "$cron" \
      --schedule-expression-timezone "Asia/Kolkata" \
      --flexible-time-window Mode=OFF \
      --target "$target"
  else
    aws scheduler create-schedule --region "$REGION" \
      --name "$name" \
      --schedule-expression "$cron" \
      --schedule-expression-timezone "Asia/Kolkata" \
      --flexible-time-window Mode=OFF \
      --target "$target"
  fi
}
create_schedule omegle-api-start "cron(0 15 * * ? *)" startInstances
create_schedule omegle-api-stop "cron(0 23 * * ? *)" stopInstances

echo "INSTANCE_ID=${INSTANCE_ID}"
echo "EIP=${EIP}"
echo "SG_ID=${SG_ID}"
echo "ALLOC_ID=${ALLOC_ID}"
echo "UPLOADS_BUCKET=${UPLOADS_BUCKET}"
echo "OPS_BUCKET=${OPS_BUCKET}"
echo "ECR=${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"
echo "GHA_ROLE=arn:aws:iam::${ACCOUNT}:role/omegle-gha"
