resource "aws_iam_role_policy" "ec2_iam_role_policy" {
  name = "${var.deployment_name}_WLMDB_Policy_1"
  role = aws_iam_role.ec2_iam_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchDeploymentStatement"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:List*",
          "cloudwatch:Get*",
          "cloudwatch:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudLogDeploymentCreateStatement"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:CreateLogGroup",
          "logs:GetLogEvents",
          "logs:GetLogDelivery",
          "logs:GetLogRecord",
          "logs:ListLogDeliveries",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
          "logs:TagResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "STSStatement"
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMStatement"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetPolicy",
          "iam:GetRolePolicy",
          "iam:PassRole",
          "iam:GetUser",
          "iam:GetPolicyVersion"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMListStatement"
        Effect = "Allow"
        Action = [
          "ssm:DescribeAssociation",
          "ssm:GetDeployablePatchSnapshotForInstance",
          "ssm:GetDocument",
          "ssm:DescribeDocument",
          "ssm:GetManifest",
          "ssm:ListAssociations",
          "ssm:ListInstanceAssociations",
          "ssm:GetCommandInvocation",
          "ec2messages:GetEndpoint",
          "ec2messages:GetMessages"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMCreateStatement"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
          "ssm:PutInventory",
          "ssm:PutComplianceItems",
          "ssm:PutConfigurePackageResult",
          "ssm:UpdateAssociationStatus",
          "ssm:UpdateInstanceAssociationStatus",
          "ssm:UpdateInstanceInformation",
          "ssm:SendCommand"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2MessagesStatement"
        Effect = "Allow"
        Action = [
          "ec2messages:AcknowledgeMessage",
          "ec2messages:DeleteMessage",
          "ec2messages:FailMessage",
          "ec2messages:SendReply"
        ]
        Resource = "*"
      },
      {
        Sid    = "FsxStatement"
        Effect = "Allow"
        Action = [
          "fsx:DescribeFileSystems",
          "fsx:DescribeVolumes",
          "fsx:DescribeStorageVirtualMachines"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2Statement"
        Effect = "Allow"
        Action = [
          "ec2:Get*",
          "ec2:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2TaggingStatement"
        Effect = "Allow"
        Action = [
          "ec2:CreateTags",
          "ec2:AuthorizeSecurityGroupIngress"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMGetPutParameter"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter",
          "ssm:GetParametersByPath",
          "ssm:DeleteParameter"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:ssm:*:*:parameter/netapp/wlmdb/*"
      }
    ]
  })
}
