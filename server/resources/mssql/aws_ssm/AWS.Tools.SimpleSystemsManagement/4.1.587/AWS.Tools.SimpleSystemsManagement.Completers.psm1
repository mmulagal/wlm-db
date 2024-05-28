# Auto-generated argument completers for parameters of SDK ConstantClass-derived type used in cmdlets.
# Do not modify this file; it may be overwritten during version upgrades.

$psMajorVersion = $PSVersionTable.PSVersion.Major
if ($psMajorVersion -eq 2) 
{ 
	Write-Verbose "Dynamic argument completion not supported in PowerShell version 2; skipping load."
	return 
}

# PowerShell's native Register-ArgumentCompleter cmdlet is available on v5.0 or higher. For lower
# version, we can use the version in the TabExpansion++ module if installed.
$registrationCmdletAvailable = ($psMajorVersion -ge 5) -Or !((Get-Command Register-ArgumentCompleter -ea Ignore) -eq $null)

# internal function to perform the registration using either cmdlet or manipulation
# of the options table
function _awsArgumentCompleterRegistration()
{
    param
    (
        [scriptblock]$scriptBlock,
        [hashtable]$param2CmdletsMap
    )

    if ($registrationCmdletAvailable)
    {
        foreach ($paramName in $param2CmdletsMap.Keys)
        {
             $args = @{
                "ScriptBlock" = $scriptBlock
                "Parameter" = $paramName
            }

            $cmdletNames = $param2CmdletsMap[$paramName]
            if ($cmdletNames -And $cmdletNames.Length -gt 0)
            {
                $args["Command"] = $cmdletNames
            }

            Register-ArgumentCompleter @args
        }
    }
    else
    {
        if (-not $global:options) { $global:options = @{ CustomArgumentCompleters = @{ }; NativeArgumentCompleters = @{ } } }

        foreach ($paramName in $param2CmdletsMap.Keys)
        {
            $cmdletNames = $param2CmdletsMap[$paramName]

            if ($cmdletNames -And $cmdletNames.Length -gt 0)
            {
                foreach ($cn in $cmdletNames)
                {
                    $fqn =  [string]::Concat($cn, ":", $paramName)
                    $global:options['CustomArgumentCompleters'][$fqn] = $scriptBlock
                }
            }
            else
            {
                $global:options['CustomArgumentCompleters'][$paramName] = $scriptBlock
            }
        }

        $function:tabexpansion2 = $function:tabexpansion2 -replace 'End\r\n{', 'End { if ($null -ne $options) { $options += $global:options} else {$options = $global:options}'
    }
}

# To allow for same-name parameters of different ConstantClass-derived types 
# each completer function checks on command name concatenated with parameter name.
# Additionally, the standard code pattern for completers is to pipe through 
# sort-object after filtering against $wordToComplete but we omit this as our members 
# are already sorted.

# Argument completions for service AWS Systems Manager


$SSM_Completers = {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameter)

    switch ($("$commandName/$parameterName"))
    {
        # Amazon.SimpleSystemsManagement.AssociationComplianceSeverity
        {
            ($_ -eq "New-SSMAssociation/ComplianceSeverity") -Or
            ($_ -eq "Update-SSMAssociation/ComplianceSeverity")
        }
        {
            $v = "CRITICAL","HIGH","LOW","MEDIUM","UNSPECIFIED"
            break
        }

        # Amazon.SimpleSystemsManagement.AssociationStatusName
        "Update-SSMAssociationStatus/AssociationStatus_Name"
        {
            $v = "Failed","Pending","Success"
            break
        }

        # Amazon.SimpleSystemsManagement.AssociationSyncCompliance
        {
            ($_ -eq "New-SSMAssociation/SyncCompliance") -Or
            ($_ -eq "Update-SSMAssociation/SyncCompliance")
        }
        {
            $v = "AUTO","MANUAL"
            break
        }

        # Amazon.SimpleSystemsManagement.ComplianceUploadType
        "Write-SSMComplianceItem/UploadType"
        {
            $v = "COMPLETE","PARTIAL"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentFormat
        {
            ($_ -eq "Get-SSMDocument/DocumentFormat") -Or
            ($_ -eq "New-SSMDocument/DocumentFormat") -Or
            ($_ -eq "Update-SSMDocument/DocumentFormat")
        }
        {
            $v = "JSON","TEXT","YAML"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentHashType
        {
            ($_ -eq "Send-SSMCommand/DocumentHashType") -Or
            ($_ -eq "Register-SSMTaskWithMaintenanceWindow/RunCommand_DocumentHashType") -Or
            ($_ -eq "Update-SSMMaintenanceWindowTask/RunCommand_DocumentHashType")
        }
        {
            $v = "Sha1","Sha256"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentMetadataEnum
        "Get-SSMDocumentMetadataHistory/Metadata"
        {
            $v = "DocumentReviews"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentPermissionType
        {
            ($_ -eq "Edit-SSMDocumentPermission/PermissionType") -Or
            ($_ -eq "Get-SSMDocumentPermission/PermissionType")
        }
        {
            $v = "Share"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentReviewAction
        "Update-SSMDocumentMetadata/DocumentReviews_Action"
        {
            $v = "Approve","Reject","SendForReview","UpdateReview"
            break
        }

        # Amazon.SimpleSystemsManagement.DocumentType
        "New-SSMDocument/DocumentType"
        {
            $v = "ApplicationConfiguration","ApplicationConfigurationSchema","Automation","Automation.ChangeTemplate","ChangeCalendar","CloudFormation","Command","ConformancePackTemplate","DeploymentStrategy","Package","Policy","ProblemAnalysis","ProblemAnalysisTemplate","QuickSetup","Session"
            break
        }

        # Amazon.SimpleSystemsManagement.ExecutionMode
        "Start-SSMAutomationExecution/Mode"
        {
            $v = "Auto","Interactive"
            break
        }

        # Amazon.SimpleSystemsManagement.InventorySchemaDeleteOption
        "Remove-SSMInventory/SchemaDeleteOption"
        {
            $v = "DeleteSchema","DisableSchema"
            break
        }

        # Amazon.SimpleSystemsManagement.MaintenanceWindowResourceType
        {
            ($_ -eq "Get-SSMMaintenanceWindowSchedule/ResourceType") -Or
            ($_ -eq "Get-SSMMaintenanceWindowsForTarget/ResourceType") -Or
            ($_ -eq "Register-SSMTargetWithMaintenanceWindow/ResourceType")
        }
        {
            $v = "INSTANCE","RESOURCE_GROUP"
            break
        }

        # Amazon.SimpleSystemsManagement.MaintenanceWindowTaskCutoffBehavior
        {
            ($_ -eq "Register-SSMTaskWithMaintenanceWindow/CutoffBehavior") -Or
            ($_ -eq "Update-SSMMaintenanceWindowTask/CutoffBehavior")
        }
        {
            $v = "CANCEL_TASK","CONTINUE_TASK"
            break
        }

        # Amazon.SimpleSystemsManagement.MaintenanceWindowTaskType
        "Register-SSMTaskWithMaintenanceWindow/TaskType"
        {
            $v = "AUTOMATION","LAMBDA","RUN_COMMAND","STEP_FUNCTIONS"
            break
        }

        # Amazon.SimpleSystemsManagement.NotificationType
        {
            ($_ -eq "Register-SSMTaskWithMaintenanceWindow/NotificationConfig_NotificationType") -Or
            ($_ -eq "Send-SSMCommand/NotificationConfig_NotificationType") -Or
            ($_ -eq "Update-SSMMaintenanceWindowTask/NotificationConfig_NotificationType")
        }
        {
            $v = "Command","Invocation"
            break
        }

        # Amazon.SimpleSystemsManagement.OperatingSystem
        {
            ($_ -eq "Get-SSMDeployablePatchSnapshotForInstance/BaselineOverride_OperatingSystem") -Or
            ($_ -eq "Get-SSMDefaultPatchBaseline/OperatingSystem") -Or
            ($_ -eq "Get-SSMPatchBaselineForPatchGroup/OperatingSystem") -Or
            ($_ -eq "Get-SSMPatchProperty/OperatingSystem") -Or
            ($_ -eq "New-SSMPatchBaseline/OperatingSystem")
        }
        {
            $v = "ALMA_LINUX","AMAZON_LINUX","AMAZON_LINUX_2","AMAZON_LINUX_2022","AMAZON_LINUX_2023","CENTOS","DEBIAN","MACOS","ORACLE_LINUX","RASPBIAN","REDHAT_ENTERPRISE_LINUX","ROCKY_LINUX","SUSE","UBUNTU","WINDOWS"
            break
        }

        # Amazon.SimpleSystemsManagement.OpsItemStatus
        "Update-SSMOpsItem/Status"
        {
            $v = "Approved","Cancelled","Cancelling","ChangeCalendarOverrideApproved","ChangeCalendarOverrideRejected","Closed","CompletedWithFailure","CompletedWithSuccess","Failed","InProgress","Open","Pending","PendingApproval","PendingChangeCalendarOverride","Rejected","Resolved","RunbookInProgress","Scheduled","TimedOut"
            break
        }

        # Amazon.SimpleSystemsManagement.ParameterTier
        "Write-SSMParameter/Tier"
        {
            $v = "Advanced","Intelligent-Tiering","Standard"
            break
        }

        # Amazon.SimpleSystemsManagement.ParameterType
        "Write-SSMParameter/Type"
        {
            $v = "SecureString","String","StringList"
            break
        }

        # Amazon.SimpleSystemsManagement.PatchAction
        {
            ($_ -eq "Get-SSMDeployablePatchSnapshotForInstance/BaselineOverride_RejectedPatchesAction") -Or
            ($_ -eq "New-SSMPatchBaseline/RejectedPatchesAction") -Or
            ($_ -eq "Update-SSMPatchBaseline/RejectedPatchesAction")
        }
        {
            $v = "ALLOW_AS_DEPENDENCY","BLOCK"
            break
        }

        # Amazon.SimpleSystemsManagement.PatchComplianceLevel
        {
            ($_ -eq "New-SSMPatchBaseline/ApprovedPatchesComplianceLevel") -Or
            ($_ -eq "Update-SSMPatchBaseline/ApprovedPatchesComplianceLevel") -Or
            ($_ -eq "Get-SSMDeployablePatchSnapshotForInstance/BaselineOverride_ApprovedPatchesComplianceLevel")
        }
        {
            $v = "CRITICAL","HIGH","INFORMATIONAL","LOW","MEDIUM","UNSPECIFIED"
            break
        }

        # Amazon.SimpleSystemsManagement.PatchProperty
        "Get-SSMPatchProperty/Property"
        {
            $v = "CLASSIFICATION","MSRC_SEVERITY","PRIORITY","PRODUCT","PRODUCT_FAMILY","SEVERITY"
            break
        }

        # Amazon.SimpleSystemsManagement.PatchSet
        "Get-SSMPatchProperty/PatchSet"
        {
            $v = "APPLICATION","OS"
            break
        }

        # Amazon.SimpleSystemsManagement.ResourceDataSyncS3Format
        "New-SSMResourceDataSync/S3Destination_SyncFormat"
        {
            $v = "JsonSerDe"
            break
        }

        # Amazon.SimpleSystemsManagement.ResourceTypeForTagging
        {
            ($_ -eq "Add-SSMResourceTag/ResourceType") -Or
            ($_ -eq "Get-SSMResourceTag/ResourceType") -Or
            ($_ -eq "Remove-SSMResourceTag/ResourceType")
        }
        {
            $v = "Association","Automation","Document","MaintenanceWindow","ManagedInstance","OpsItem","OpsMetadata","Parameter","PatchBaseline"
            break
        }

        # Amazon.SimpleSystemsManagement.SessionState
        "Get-SSMSession/State"
        {
            $v = "Active","History"
            break
        }

        # Amazon.SimpleSystemsManagement.SignalType
        "Send-SSMAutomationSignal/SignalType"
        {
            $v = "Approve","Reject","Resume","StartStep","StopStep"
            break
        }

        # Amazon.SimpleSystemsManagement.StopType
        "Stop-SSMAutomationExecution/Type"
        {
            $v = "Cancel","Complete"
            break
        }


    }

    $v |
        Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { New-Object System.Management.Automation.CompletionResult $_, $_, 'ParameterValue', $_ }
}

$SSM_map = @{
    "ApprovedPatchesComplianceLevel"=@("New-SSMPatchBaseline","Update-SSMPatchBaseline")
    "AssociationStatus_Name"=@("Update-SSMAssociationStatus")
    "BaselineOverride_ApprovedPatchesComplianceLevel"=@("Get-SSMDeployablePatchSnapshotForInstance")
    "BaselineOverride_OperatingSystem"=@("Get-SSMDeployablePatchSnapshotForInstance")
    "BaselineOverride_RejectedPatchesAction"=@("Get-SSMDeployablePatchSnapshotForInstance")
    "ComplianceSeverity"=@("New-SSMAssociation","Update-SSMAssociation")
    "CutoffBehavior"=@("Register-SSMTaskWithMaintenanceWindow","Update-SSMMaintenanceWindowTask")
    "DocumentFormat"=@("Get-SSMDocument","New-SSMDocument","Update-SSMDocument")
    "DocumentHashType"=@("Send-SSMCommand")
    "DocumentReviews_Action"=@("Update-SSMDocumentMetadata")
    "DocumentType"=@("New-SSMDocument")
    "Metadata"=@("Get-SSMDocumentMetadataHistory")
    "Mode"=@("Start-SSMAutomationExecution")
    "NotificationConfig_NotificationType"=@("Register-SSMTaskWithMaintenanceWindow","Send-SSMCommand","Update-SSMMaintenanceWindowTask")
    "OperatingSystem"=@("Get-SSMDefaultPatchBaseline","Get-SSMPatchBaselineForPatchGroup","Get-SSMPatchProperty","New-SSMPatchBaseline")
    "PatchSet"=@("Get-SSMPatchProperty")
    "PermissionType"=@("Edit-SSMDocumentPermission","Get-SSMDocumentPermission")
    "Property"=@("Get-SSMPatchProperty")
    "RejectedPatchesAction"=@("New-SSMPatchBaseline","Update-SSMPatchBaseline")
    "ResourceType"=@("Add-SSMResourceTag","Get-SSMMaintenanceWindowSchedule","Get-SSMMaintenanceWindowsForTarget","Get-SSMResourceTag","Register-SSMTargetWithMaintenanceWindow","Remove-SSMResourceTag")
    "RunCommand_DocumentHashType"=@("Register-SSMTaskWithMaintenanceWindow","Update-SSMMaintenanceWindowTask")
    "S3Destination_SyncFormat"=@("New-SSMResourceDataSync")
    "SchemaDeleteOption"=@("Remove-SSMInventory")
    "SignalType"=@("Send-SSMAutomationSignal")
    "State"=@("Get-SSMSession")
    "Status"=@("Update-SSMOpsItem")
    "SyncCompliance"=@("New-SSMAssociation","Update-SSMAssociation")
    "TaskType"=@("Register-SSMTaskWithMaintenanceWindow")
    "Tier"=@("Write-SSMParameter")
    "Type"=@("Stop-SSMAutomationExecution","Write-SSMParameter")
    "UploadType"=@("Write-SSMComplianceItem")
}

_awsArgumentCompleterRegistration $SSM_Completers $SSM_map

$SSM_SelectCompleters = {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameter)

    $cmdletType = Invoke-Expression "[Amazon.PowerShell.Cmdlets.SSM.$($commandName.Replace('-', ''))Cmdlet]"
    if (-not $cmdletType) {
        return
    }
    $awsCmdletAttribute = $cmdletType.GetCustomAttributes([Amazon.PowerShell.Common.AWSCmdletAttribute], $false)
    if (-not $awsCmdletAttribute) {
        return
    }
    $type = $awsCmdletAttribute.SelectReturnType
    if (-not $type) {
        return
    }

    $splitSelect = $wordToComplete -Split '\.'
    $splitSelect | Select-Object -First ($splitSelect.Length - 1) | ForEach-Object {
        $propertyName = $_
        $properties = $type.GetProperties(('Instance', 'Public', 'DeclaredOnly')) | Where-Object { $_.Name -ieq $propertyName }
        if ($properties.Length -ne 1) {
            break
        }
        $type = $properties.PropertyType
        $prefix += "$($properties.Name)."

        $asEnumerableType = $type.GetInterface('System.Collections.Generic.IEnumerable`1')
        if ($asEnumerableType -and $type -ne [System.String]) {
            $type =  $asEnumerableType.GetGenericArguments()[0]
        }
    }

    $v = @( '*' )
    $properties = $type.GetProperties(('Instance', 'Public', 'DeclaredOnly')).Name | Sort-Object
    if ($properties) {
        $v += ($properties | ForEach-Object { $prefix + $_ })
    }
    $parameters = $cmdletType.GetProperties(('Instance', 'Public')) | Where-Object { $_.GetCustomAttributes([System.Management.Automation.ParameterAttribute], $true) } | Select-Object -ExpandProperty Name | Sort-Object
    if ($parameters) {
        $v += ($parameters | ForEach-Object { "^$_" })
    }

    $v |
        Where-Object { $_ -match "^$([System.Text.RegularExpressions.Regex]::Escape($wordToComplete)).*" } |
        ForEach-Object { New-Object System.Management.Automation.CompletionResult $_, $_, 'ParameterValue', $_ }
}

$SSM_SelectMap = @{
    "Select"=@("Add-SSMResourceTag",
               "Register-SSMOpsItemRelatedItem",
               "Stop-SSMCommand",
               "Stop-SSMMaintenanceWindowExecution",
               "New-SSMActivation",
               "New-SSMAssociation",
               "New-SSMAssociationFromBatch",
               "New-SSMDocument",
               "New-SSMMaintenanceWindow",
               "New-SSMOpsItem",
               "New-SSMOpsMetadata",
               "New-SSMPatchBaseline",
               "New-SSMResourceDataSync",
               "Remove-SSMActivation",
               "Remove-SSMAssociation",
               "Remove-SSMDocument",
               "Remove-SSMInventory",
               "Remove-SSMMaintenanceWindow",
               "Remove-SSMOpsItem",
               "Remove-SSMOpsMetadata",
               "Remove-SSMParameter",
               "Remove-SSMParameterCollection",
               "Remove-SSMPatchBaseline",
               "Remove-SSMResourceDataSync",
               "Remove-SSMResourcePolicy",
               "Unregister-SSMManagedInstance",
               "Unregister-SSMPatchBaselineForPatchGroup",
               "Unregister-SSMTargetFromMaintenanceWindow",
               "Unregister-SSMTaskFromMaintenanceWindow",
               "Get-SSMActivation",
               "Get-SSMAssociation",
               "Get-SSMAssociationExecution",
               "Get-SSMAssociationExecutionTarget",
               "Get-SSMAutomationExecutionList",
               "Get-SSMAutomationStepExecution",
               "Get-SSMAvailablePatch",
               "Get-SSMDocumentDescription",
               "Get-SSMDocumentPermission",
               "Get-SSMEffectiveInstanceAssociationList",
               "Get-SSMEffectivePatchesForPatchBaseline",
               "Get-SSMInstanceAssociationsStatus",
               "Get-SSMInstanceInformation",
               "Get-SSMInstancePatch",
               "Get-SSMInstancePatchState",
               "Get-SSMInstancePatchStatesForPatchGroup",
               "Get-SSMInstanceProperty",
               "Get-SSMInventoryDeletionList",
               "Get-SSMMaintenanceWindowExecutionList",
               "Get-SSMMaintenanceWindowExecutionTaskInvocationList",
               "Get-SSMMaintenanceWindowExecutionTaskList",
               "Get-SSMMaintenanceWindowList",
               "Get-SSMMaintenanceWindowSchedule",
               "Get-SSMMaintenanceWindowsForTarget",
               "Get-SSMMaintenanceWindowTarget",
               "Get-SSMMaintenanceWindowTaskList",
               "Get-SSMOpsItemSummary",
               "Get-SSMParameterList",
               "Get-SSMPatchBaseline",
               "Get-SSMPatchGroup",
               "Get-SSMPatchGroupState",
               "Get-SSMPatchProperty",
               "Get-SSMSession",
               "Unregister-SSMOpsItemRelatedItem",
               "Get-SSMAutomationExecution",
               "Get-SSMCalendarState",
               "Get-SSMCommandInvocationDetail",
               "Get-SSMConnectionStatus",
               "Get-SSMDefaultPatchBaseline",
               "Get-SSMDeployablePatchSnapshotForInstance",
               "Get-SSMDocument",
               "Get-SSMInventory",
               "Get-SSMInventorySchema",
               "Get-SSMMaintenanceWindow",
               "Get-SSMMaintenanceWindowExecution",
               "Get-SSMMaintenanceWindowExecutionTask",
               "Get-SSMMaintenanceWindowExecutionTaskInvocation",
               "Get-SSMMaintenanceWindowTask",
               "Get-SSMOpsItem",
               "Get-SSMOpsMetadata",
               "Get-SSMOpsSummary",
               "Get-SSMParameter",
               "Get-SSMParameterHistory",
               "Get-SSMParameterValue",
               "Get-SSMParametersByPath",
               "Get-SSMPatchBaselineDetail",
               "Get-SSMPatchBaselineForPatchGroup",
               "Get-SSMResourcePolicy",
               "Get-SSMServiceSetting",
               "Set-SSMParameterVersionLabel",
               "Get-SSMAssociationList",
               "Get-SSMAssociationVersionList",
               "Get-SSMCommandInvocation",
               "Get-SSMCommand",
               "Get-SSMComplianceItemList",
               "Get-SSMComplianceSummaryList",
               "Get-SSMDocumentMetadataHistory",
               "Get-SSMDocumentList",
               "Get-SSMDocumentVersionList",
               "Get-SSMInventoryEntryList",
               "Get-SSMOpsItemEvent",
               "Get-SSMOpsItemRelatedItem",
               "Get-SSMOpsMetadataList",
               "Get-SSMResourceComplianceSummaryList",
               "Get-SSMResourceDataSync",
               "Get-SSMResourceTag",
               "Edit-SSMDocumentPermission",
               "Write-SSMComplianceItem",
               "Write-SSMInventory",
               "Write-SSMParameter",
               "Write-SSMResourcePolicy",
               "Register-SSMDefaultPatchBaseline",
               "Register-SSMPatchBaselineForPatchGroup",
               "Register-SSMTargetWithMaintenanceWindow",
               "Register-SSMTaskWithMaintenanceWindow",
               "Remove-SSMResourceTag",
               "Reset-SSMServiceSetting",
               "Resume-SSMSession",
               "Send-SSMAutomationSignal",
               "Send-SSMCommand",
               "Start-SSMAssociationsOnce",
               "Start-SSMAutomationExecution",
               "Start-SSMChangeRequestExecution",
               "Start-SSMSession",
               "Stop-SSMAutomationExecution",
               "Stop-SSMSession",
               "Reset-SSMParameterVersionLabel",
               "Update-SSMAssociation",
               "Update-SSMAssociationStatus",
               "Update-SSMDocument",
               "Update-SSMDocumentDefaultVersion",
               "Update-SSMDocumentMetadata",
               "Update-SSMMaintenanceWindow",
               "Update-SSMMaintenanceWindowTarget",
               "Update-SSMMaintenanceWindowTask",
               "Update-SSMManagedInstanceRole",
               "Update-SSMOpsItem",
               "Update-SSMOpsMetadata",
               "Update-SSMPatchBaseline",
               "Update-SSMResourceDataSync",
               "Update-SSMServiceSetting",
               "Get-SSMLatestEC2Image")
}

_awsArgumentCompleterRegistration $SSM_SelectCompleters $SSM_SelectMap


# SIG # Begin signature block
# MIIufQYJKoZIhvcNAQcCoIIubjCCLmoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCA8pWbQ5iO14x1C
# 26ih7wcZKUKWHHfpxogtxGzxECGib6CCE+owggXAMIIEqKADAgECAhAP0bvKeWvX
# +N1MguEKmpYxMA0GCSqGSIb3DQEBCwUAMGwxCzAJBgNVBAYTAlVTMRUwEwYDVQQK
# EwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5jb20xKzApBgNV
# BAMTIkRpZ2lDZXJ0IEhpZ2ggQXNzdXJhbmNlIEVWIFJvb3QgQ0EwHhcNMjIwMTEz
# MDAwMDAwWhcNMzExMTA5MjM1OTU5WjBiMQswCQYDVQQGEwJVUzEVMBMGA1UEChMM
# RGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQD
# ExhEaWdpQ2VydCBUcnVzdGVkIFJvb3QgRzQwggIiMA0GCSqGSIb3DQEBAQUAA4IC
# DwAwggIKAoICAQC/5pBzaN675F1KPDAiMGkz7MKnJS7JIT3yithZwuEppz1Yq3aa
# za57G4QNxDAf8xukOBbrVsaXbR2rsnnyyhHS5F/WBTxSD1Ifxp4VpX6+n6lXFllV
# cq9ok3DCsrp1mWpzMpTREEQQLt+C8weE5nQ7bXHiLQwb7iDVySAdYyktzuxeTsiT
# +CFhmzTrBcZe7FsavOvJz82sNEBfsXpm7nfISKhmV1efVFiODCu3T6cw2Vbuyntd
# 463JT17lNecxy9qTXtyOj4DatpGYQJB5w3jHtrHEtWoYOAMQjdjUN6QuBX2I9YI+
# EJFwq1WCQTLX2wRzKm6RAXwhTNS8rhsDdV14Ztk6MUSaM0C/CNdaSaTC5qmgZ92k
# J7yhTzm1EVgX9yRcRo9k98FpiHaYdj1ZXUJ2h4mXaXpI8OCiEhtmmnTK3kse5w5j
# rubU75KSOp493ADkRSWJtppEGSt+wJS00mFt6zPZxd9LBADMfRyVw4/3IbKyEbe7
# f/LVjHAsQWCqsWMYRJUadmJ+9oCw++hkpjPRiQfhvbfmQ6QYuKZ3AeEPlAwhHbJU
# KSWJbOUOUlFHdL4mrLZBdd56rF+NP8m800ERElvlEFDrMcXKchYiCd98THU/Y+wh
# X8QgUWtvsauGi0/C1kVfnSD8oR7FwI+isX4KJpn15GkvmB0t9dmpsh3lGwIDAQAB
# o4IBZjCCAWIwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5n
# P+e6mK4cD08wHwYDVR0jBBgwFoAUsT7DaQP4v0cB1JgmGggC72NkK8MwDgYDVR0P
# AQH/BAQDAgGGMBMGA1UdJQQMMAoGCCsGAQUFBwMDMH8GCCsGAQUFBwEBBHMwcTAk
# BggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEkGCCsGAQUFBzAC
# hj1odHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRIaWdoQXNzdXJh
# bmNlRVZSb290Q0EuY3J0MEsGA1UdHwREMEIwQKA+oDyGOmh0dHA6Ly9jcmwzLmRp
# Z2ljZXJ0LmNvbS9EaWdpQ2VydEhpZ2hBc3N1cmFuY2VFVlJvb3RDQS5jcmwwHAYD
# VR0gBBUwEzAHBgVngQwBAzAIBgZngQwBBAEwDQYJKoZIhvcNAQELBQADggEBAEHx
# qRH0DxNHecllao3A7pgEpMbjDPKisedfYk/ak1k2zfIe4R7sD+EbP5HU5A/C5pg0
# /xkPZigfT2IxpCrhKhO61z7H0ZL+q93fqpgzRh9Onr3g7QdG64AupP2uU7SkwaT1
# IY1rzAGt9Rnu15ClMlIr28xzDxj4+87eg3Gn77tRWwR2L62t0+od/P1Tk+WMieNg
# GbngLyOOLFxJy34riDkruQZhiPOuAnZ2dMFkkbiJUZflhX0901emWG4f7vtpYeJa
# 3Cgh6GO6Ps9W7Zrk9wXqyvPsEt84zdp7PiuTUy9cUQBY3pBIowrHC/Q7bVUx8ALM
# R3eWUaNetbxcyEMRoacwggawMIIEmKADAgECAhAIrUCyYNKcTJ9ezam9k67ZMA0G
# CSqGSIb3DQEBDAUAMGIxCzAJBgNVBAYTAlVTMRUwEwYDVQQKEwxEaWdpQ2VydCBJ
# bmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5jb20xITAfBgNVBAMTGERpZ2lDZXJ0
# IFRydXN0ZWQgUm9vdCBHNDAeFw0yMTA0MjkwMDAwMDBaFw0zNjA0MjgyMzU5NTla
# MGkxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjFBMD8GA1UE
# AxM4RGlnaUNlcnQgVHJ1c3RlZCBHNCBDb2RlIFNpZ25pbmcgUlNBNDA5NiBTSEEz
# ODQgMjAyMSBDQTEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDVtC9C
# 0CiteLdd1TlZG7GIQvUzjOs9gZdwxbvEhSYwn6SOaNhc9es0JAfhS0/TeEP0F9ce
# 2vnS1WcaUk8OoVf8iJnBkcyBAz5NcCRks43iCH00fUyAVxJrQ5qZ8sU7H/Lvy0da
# E6ZMswEgJfMQ04uy+wjwiuCdCcBlp/qYgEk1hz1RGeiQIXhFLqGfLOEYwhrMxe6T
# SXBCMo/7xuoc82VokaJNTIIRSFJo3hC9FFdd6BgTZcV/sk+FLEikVoQ11vkunKoA
# FdE3/hoGlMJ8yOobMubKwvSnowMOdKWvObarYBLj6Na59zHh3K3kGKDYwSNHR7Oh
# D26jq22YBoMbt2pnLdK9RBqSEIGPsDsJ18ebMlrC/2pgVItJwZPt4bRc4G/rJvmM
# 1bL5OBDm6s6R9b7T+2+TYTRcvJNFKIM2KmYoX7BzzosmJQayg9Rc9hUZTO1i4F4z
# 8ujo7AqnsAMrkbI2eb73rQgedaZlzLvjSFDzd5Ea/ttQokbIYViY9XwCFjyDKK05
# huzUtw1T0PhH5nUwjewwk3YUpltLXXRhTT8SkXbev1jLchApQfDVxW0mdmgRQRNY
# mtwmKwH0iU1Z23jPgUo+QEdfyYFQc4UQIyFZYIpkVMHMIRroOBl8ZhzNeDhFMJlP
# /2NPTLuqDQhTQXxYPUez+rbsjDIJAsxsPAxWEQIDAQABo4IBWTCCAVUwEgYDVR0T
# AQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUaDfg67Y7+F8Rhvv+YXsIiGX0TkIwHwYD
# VR0jBBgwFoAU7NfjgtJxXWRM3y5nP+e6mK4cD08wDgYDVR0PAQH/BAQDAgGGMBMG
# A1UdJQQMMAoGCCsGAQUFBwMDMHcGCCsGAQUFBwEBBGswaTAkBggrBgEFBQcwAYYY
# aHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEEGCCsGAQUFBzAChjVodHRwOi8vY2Fj
# ZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRUcnVzdGVkUm9vdEc0LmNydDBDBgNV
# HR8EPDA6MDigNqA0hjJodHRwOi8vY3JsMy5kaWdpY2VydC5jb20vRGlnaUNlcnRU
# cnVzdGVkUm9vdEc0LmNybDAcBgNVHSAEFTATMAcGBWeBDAEDMAgGBmeBDAEEATAN
# BgkqhkiG9w0BAQwFAAOCAgEAOiNEPY0Idu6PvDqZ01bgAhql+Eg08yy25nRm95Ry
# sQDKr2wwJxMSnpBEn0v9nqN8JtU3vDpdSG2V1T9J9Ce7FoFFUP2cvbaF4HZ+N3HL
# IvdaqpDP9ZNq4+sg0dVQeYiaiorBtr2hSBh+3NiAGhEZGM1hmYFW9snjdufE5Btf
# Q/g+lP92OT2e1JnPSt0o618moZVYSNUa/tcnP/2Q0XaG3RywYFzzDaju4ImhvTnh
# OE7abrs2nfvlIVNaw8rpavGiPttDuDPITzgUkpn13c5UbdldAhQfQDN8A+KVssIh
# dXNSy0bYxDQcoqVLjc1vdjcshT8azibpGL6QB7BDf5WIIIJw8MzK7/0pNVwfiThV
# 9zeKiwmhywvpMRr/LhlcOXHhvpynCgbWJme3kuZOX956rEnPLqR0kq3bPKSchh/j
# wVYbKyP/j7XqiHtwa+aguv06P0WmxOgWkVKLQcBIhEuWTatEQOON8BUozu3xGFYH
# Ki8QxAwIZDwzj64ojDzLj4gLDb879M4ee47vtevLt/B3E+bnKD+sEq6lLyJsQfmC
# XBVmzGwOysWGw/YmMwwHS6DTBwJqakAwSEs0qFEgu60bhQjiWQ1tygVQK+pKHJ6l
# /aCnHwZ05/LWUpD9r4VIIflXO7ScA+2GRfS0YW6/aOImYIbqyK+p/pQd52MbOoZW
# eE4wggduMIIFVqADAgECAhAFJ6TU4X386Byt5yj8tyv0MA0GCSqGSIb3DQEBCwUA
# MGkxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjFBMD8GA1UE
# AxM4RGlnaUNlcnQgVHJ1c3RlZCBHNCBDb2RlIFNpZ25pbmcgUlNBNDA5NiBTSEEz
# ODQgMjAyMSBDQTEwHhcNMjMwOTIxMDAwMDAwWhcNMjQwOTIwMjM1OTU5WjCB9jET
# MBEGCysGAQQBgjc8AgEDEwJVUzEZMBcGCysGAQQBgjc8AgECEwhEZWxhd2FyZTEd
# MBsGA1UEDwwUUHJpdmF0ZSBPcmdhbml6YXRpb24xEDAOBgNVBAUTBzQxNTI5NTQx
# CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdTZWF0
# dGxlMSIwIAYDVQQKExlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRcwFQYDVQQL
# Ew5TREtzIGFuZCBUb29sczEiMCAGA1UEAxMZQW1hem9uIFdlYiBTZXJ2aWNlcywg
# SW5jLjCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAJjhDu3MlIkKp+Nk
# BFz/tVwif+YXxpcvEBx2HLJlN6dfmNJsCTxxH7Y6PQOVeqvqG+K/H0N5gAB0kKMf
# izQ02kZo8d69ffL353eBFjb9J/X3/6jSBQY/DGn8cVVwmKFR0KrR1svzYTiMatU1
# 5wzncoUC18zCn+XWhfrzOlWY2slhewIQbQ28hsEr/bDrXfLJwiEaGs66E8CdNnBM
# Ub6RSP2YW5o87wTZanbJIbYBGFoLuniAribMBacfJCCyhn6FOSVZTL/CwC++u2YA
# ThYJHfH1LlmRmsDYmxCv706KkcN3Ujf8BUJzCqVHcoSEO8V1j7uVknJs/0GYrD7F
# srf+XWOstoM0+6thNOw+OH1RSIJcJHe4cDV7lPXkfMIu+YtmTs/QznXfEDa39HLd
# eHyxALYxnCfZTXwvNi6a1bAJOS6Zfa2VHV9EkcnOQ/vRyP5wAzrwXb6kDfRUfuco
# SnzMFATVN+AcQU0nNSyNLgzE5WILznhJiD1LWvHtBjNFvGGQqQIDAQABo4ICAjCC
# Af4wHwYDVR0jBBgwFoAUaDfg67Y7+F8Rhvv+YXsIiGX0TkIwHQYDVR0OBBYEFKic
# qEG4gGI+4Tit41YNJvlkbAcpMD0GA1UdIAQ2MDQwMgYFZ4EMAQMwKTAnBggrBgEF
# BQcCARYbaHR0cDovL3d3dy5kaWdpY2VydC5jb20vQ1BTMA4GA1UdDwEB/wQEAwIH
# gDATBgNVHSUEDDAKBggrBgEFBQcDAzCBtQYDVR0fBIGtMIGqMFOgUaBPhk1odHRw
# Oi8vY3JsMy5kaWdpY2VydC5jb20vRGlnaUNlcnRUcnVzdGVkRzRDb2RlU2lnbmlu
# Z1JTQTQwOTZTSEEzODQyMDIxQ0ExLmNybDBToFGgT4ZNaHR0cDovL2NybDQuZGln
# aWNlcnQuY29tL0RpZ2lDZXJ0VHJ1c3RlZEc0Q29kZVNpZ25pbmdSU0E0MDk2U0hB
# Mzg0MjAyMUNBMS5jcmwwgZQGCCsGAQUFBwEBBIGHMIGEMCQGCCsGAQUFBzABhhho
# dHRwOi8vb2NzcC5kaWdpY2VydC5jb20wXAYIKwYBBQUHMAKGUGh0dHA6Ly9jYWNl
# cnRzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydFRydXN0ZWRHNENvZGVTaWduaW5nUlNB
# NDA5NlNIQTM4NDIwMjFDQTEuY3J0MAkGA1UdEwQCMAAwDQYJKoZIhvcNAQELBQAD
# ggIBABTiicLmdgbqHUadL+fIpjPMRZ8Ami9r4x0IiG4rp6TCZCwvwbZw5d2NrpQ7
# S+hWsOyY1m672wRfhlQ5wUXLp/nmLatnF7IB8y0Woa8MMaPHlIp9lLjVVYy3bxeu
# +qSXpA5hRVQFQRSd0F8SuPH02qX4en+fr4657WTD8Ct+u/gKEXn4sNskuupkOBDj
# GzT2qSxhGbGznCL7lpJhP4zpF3L6z/lj1O2h8Ug8SpnQJykcWf6FYtFXX5Y0XTjR
# JOsRdUF9uTuVVjsxY6j7rvQESgT9ND8JEDXtMNDAKUyPERgUFB/Gmc8mF8UfDDv9
# KyHtvO3o6oAxvtwdyZd1NLIlLe0/7zP4zYXNsUEPO/DK6ScPzpbLQb9Rrxire3So
# qjF1eENlORJ8aFDdBIDSCurE6SXagGweSAvWyGoaFoqD7vMsJdXIW9P8KeC6qHdl
# iSyIkzlniK9RUSdsiGqayoLNk0+WEM5ncy6p+NPj5W/VeHEh/VuWsuIVQvN8+kzX
# bEt4j260R+cEiIfmRezL+zVQD2CNELpOm0F3dTMvcGBovmsatm2T7u4uLnz3qDTL
# kRhi/HjZ0I1Y1Wk0hBeM2Kslx5hq8ybv405GvHwNIQutECLsX0cY3hXy4c4JpX44
# fEfuFZAVDYNR6kZpdB89U/o26Pv5TRpG9cg9hzqnpPauM0oJMYIZ6TCCGeUCAQEw
# fTBpMQswCQYDVQQGEwJVUzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xQTA/BgNV
# BAMTOERpZ2lDZXJ0IFRydXN0ZWQgRzQgQ29kZSBTaWduaW5nIFJTQTQwOTYgU0hB
# Mzg0IDIwMjEgQ0ExAhAFJ6TU4X386Byt5yj8tyv0MA0GCWCGSAFlAwQCAQUAoHww
# EAYKKwYBBAGCNwIBDDECMAAwGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYK
# KwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIOOmrX9J
# 0DHzk0ZhecolyldLxVjSj7PDN57mnI7/5t1dMA0GCSqGSIb3DQEBAQUABIIBgIPe
# X4RkbYX+M790P8kZN8XD2LdzL51rF32Y1y8vCO8PdNuNGyRjwMaUx86BCAmWWn+X
# BpNCKCnkiiutF+hl5xQ4W1sC/6pBzVaFTwSkkcK++rGq/0RmFjavQKHYPK0yueCg
# zlAbyZndTExt/GLNKanV5Ge//By+gGtCRJZYQWIQU8ZgITIEkHbcnQtC1GoeFPXA
# Q37DjnSRvAKWUfGU1FzTNK1lvUUqAWyy7slxhKIr7UWf6igjZugX94wH4cOFoVgd
# motWf1CVt5cgLKXJvIjykeiPZdKvCPN7efOU6+Jyaj5Gw4lHvuwZAlZf5OqQ6HUG
# 28FZwduP5VeAwao800DJfkPLBJ9rCUai7sZhA5kf81KJo7lPSSGqMVoZxfWlEg+P
# Cmo3dR5wPDBj9Mo3NWGmy1Yf2/s8lLSuWYH6QLjc8o7ICUQ0efDkWuKS+o5ztgHX
# kwLwJ6ghU40+Y1noHFxXx6iIo4pPLJyAeP5bQeynQnB7jvtKlGOKR8AZ6p0RWaGC
# Fz8wghc7BgorBgEEAYI3AwMBMYIXKzCCFycGCSqGSIb3DQEHAqCCFxgwghcUAgED
# MQ8wDQYJYIZIAWUDBAIBBQAwdwYLKoZIhvcNAQkQAQSgaARmMGQCAQEGCWCGSAGG
# /WwHATAxMA0GCWCGSAFlAwQCAQUABCByamcJ2gD2tfg8mMHkjWf/6sS6G8Zcvq8L
# rMYvmc7/cAIQQdJx24mUoyqzFwXu/lLUERgPMjAyNDA1MjQyMTU0MDVaoIITCTCC
# BsIwggSqoAMCAQICEAVEr/OUnQg5pr/bP1/lYRYwDQYJKoZIhvcNAQELBQAwYzEL
# MAkGA1UEBhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0LCBJbmMuMTswOQYDVQQDEzJE
# aWdpQ2VydCBUcnVzdGVkIEc0IFJTQTQwOTYgU0hBMjU2IFRpbWVTdGFtcGluZyBD
# QTAeFw0yMzA3MTQwMDAwMDBaFw0zNDEwMTMyMzU5NTlaMEgxCzAJBgNVBAYTAlVT
# MRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjEgMB4GA1UEAxMXRGlnaUNlcnQgVGlt
# ZXN0YW1wIDIwMjMwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCjU0WH
# HYOOW6w+VLMj4M+f1+XS512hDgncL0ijl3o7Kpxn3GIVWMGpkxGnzaqyat0QKYoe
# YmNp01icNXG/OpfrlFCPHCDqx5o7L5Zm42nnaf5bw9YrIBzBl5S0pVCB8s/LB6Yw
# aMqDQtr8fwkklKSCGtpqutg7yl3eGRiF+0XqDWFsnf5xXsQGmjzwxS55DxtmUuPI
# 1j5f2kPThPXQx/ZILV5FdZZ1/t0QoRuDwbjmUpW1R9d4KTlr4HhZl+NEK0rVlc7v
# CBfqgmRN/yPjyobutKQhZHDr1eWg2mOzLukF7qr2JPUdvJscsrdf3/Dudn0xmWVH
# VZ1KJC+sK5e+n+T9e3M+Mu5SNPvUu+vUoCw0m+PebmQZBzcBkQ8ctVHNqkxmg4ho
# Yru8QRt4GW3k2Q/gWEH72LEs4VGvtK0VBhTqYggT02kefGRNnQ/fztFejKqrUBXJ
# s8q818Q7aESjpTtC/XN97t0K/3k0EH6mXApYTAA+hWl1x4Nk1nXNjxJ2VqUk+tfE
# ayG66B80mC866msBsPf7Kobse1I4qZgJoXGybHGvPrhvltXhEBP+YUcKjP7wtsfV
# x95sJPC/QoLKoHE9nJKTBLRpcCcNT7e1NtHJXwikcKPsCvERLmTgyyIryvEoEyFJ
# UX4GZtM7vvrrkTjYUQfKlLfiUKHzOtOKg8tAewIDAQABo4IBizCCAYcwDgYDVR0P
# AQH/BAQDAgeAMAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgw
# IAYDVR0gBBkwFzAIBgZngQwBBAIwCwYJYIZIAYb9bAcBMB8GA1UdIwQYMBaAFLoW
# 2W1NhS9zKXaaL3WMaiCPnshvMB0GA1UdDgQWBBSltu8T5+/N0GSh1VapZTGj3tXj
# STBaBgNVHR8EUzBRME+gTaBLhklodHRwOi8vY3JsMy5kaWdpY2VydC5jb20vRGln
# aUNlcnRUcnVzdGVkRzRSU0E0MDk2U0hBMjU2VGltZVN0YW1waW5nQ0EuY3JsMIGQ
# BggrBgEFBQcBAQSBgzCBgDAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNl
# cnQuY29tMFgGCCsGAQUFBzAChkxodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20v
# RGlnaUNlcnRUcnVzdGVkRzRSU0E0MDk2U0hBMjU2VGltZVN0YW1waW5nQ0EuY3J0
# MA0GCSqGSIb3DQEBCwUAA4ICAQCBGtbeoKm1mBe8cI1PijxonNgl/8ss5M3qXSKS
# 7IwiAqm4z4Co2efjxe0mgopxLxjdTrbebNfhYJwr7e09SI64a7p8Xb3CYTdoSXej
# 65CqEtcnhfOOHpLawkA4n13IoC4leCWdKgV6hCmYtld5j9smViuw86e9NwzYmHZP
# VrlSwradOKmB521BXIxp0bkrxMZ7z5z6eOKTGnaiaXXTUOREEr4gDZ6pRND45Ul3
# CFohxbTPmJUaVLq5vMFpGbrPFvKDNzRusEEm3d5al08zjdSNd311RaGlWCZqA0Xe
# 2VC1UIyvVr1MxeFGxSjTredDAHDezJieGYkD6tSRN+9NUvPJYCHEVkft2hFLjDLD
# iOZY4rbbPvlfsELWj+MXkdGqwFXjhr+sJyxB0JozSqg21Llyln6XeThIX8rC3D0y
# 33XWNmdaifj2p8flTzU8AL2+nCpseQHc2kTmOt44OwdeOVj0fHMxVaCAEcsUDH6u
# vP6k63llqmjWIso765qCNVcoFstp8jKastLYOrixRoZruhf9xHdsFWyuq69zOuhJ
# RrfVf8y2OMDY7Bz1tqG4QyzfTkx9HmhwwHcK1ALgXGC7KP845VJa1qwXIiNO9OzT
# F/tQa/8Hdx9xl0RBybhG02wyfFgvZ0dl5Rtztpn5aywGRu9BHvDwX+Db2a2QgESv
# gBBBijCCBq4wggSWoAMCAQICEAc2N7ckVHzYR6z9KGYqXlswDQYJKoZIhvcNAQEL
# BQAwYjELMAkGA1UEBhMCVVMxFTATBgNVBAoTDERpZ2lDZXJ0IEluYzEZMBcGA1UE
# CxMQd3d3LmRpZ2ljZXJ0LmNvbTEhMB8GA1UEAxMYRGlnaUNlcnQgVHJ1c3RlZCBS
# b290IEc0MB4XDTIyMDMyMzAwMDAwMFoXDTM3MDMyMjIzNTk1OVowYzELMAkGA1UE
# BhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0LCBJbmMuMTswOQYDVQQDEzJEaWdpQ2Vy
# dCBUcnVzdGVkIEc0IFJTQTQwOTYgU0hBMjU2IFRpbWVTdGFtcGluZyBDQTCCAiIw
# DQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMaGNQZJs8E9cklRVcclA8TykTep
# l1Gh1tKD0Z5Mom2gsMyD+Vr2EaFEFUJfpIjzaPp985yJC3+dH54PMx9QEwsmc5Zt
# +FeoAn39Q7SE2hHxc7Gz7iuAhIoiGN/r2j3EF3+rGSs+QtxnjupRPfDWVtTnKC3r
# 07G1decfBmWNlCnT2exp39mQh0YAe9tEQYncfGpXevA3eZ9drMvohGS0UvJ2R/dh
# gxndX7RUCyFobjchu0CsX7LeSn3O9TkSZ+8OpWNs5KbFHc02DVzV5huowWR0QKfA
# csW6Th+xtVhNef7Xj3OTrCw54qVI1vCwMROpVymWJy71h6aPTnYVVSZwmCZ/oBpH
# IEPjQ2OAe3VuJyWQmDo4EbP29p7mO1vsgd4iFNmCKseSv6De4z6ic/rnH1pslPJS
# lRErWHRAKKtzQ87fSqEcazjFKfPKqpZzQmiftkaznTqj1QPgv/CiPMpC3BhIfxQ0
# z9JMq++bPf4OuGQq+nUoJEHtQr8FnGZJUlD0UfM2SU2LINIsVzV5K6jzRWC8I41Y
# 99xh3pP+OcD5sjClTNfpmEpYPtMDiP6zj9NeS3YSUZPJjAw7W4oiqMEmCPkUEBID
# fV8ju2TjY+Cm4T72wnSyPx4JduyrXUZ14mCjWAkBKAAOhFTuzuldyF4wEr1GnrXT
# drnSDmuZDNIztM2xAgMBAAGjggFdMIIBWTASBgNVHRMBAf8ECDAGAQH/AgEAMB0G
# A1UdDgQWBBS6FtltTYUvcyl2mi91jGogj57IbzAfBgNVHSMEGDAWgBTs1+OC0nFd
# ZEzfLmc/57qYrhwPTzAOBgNVHQ8BAf8EBAMCAYYwEwYDVR0lBAwwCgYIKwYBBQUH
# AwgwdwYIKwYBBQUHAQEEazBpMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5kaWdp
# Y2VydC5jb20wQQYIKwYBBQUHMAKGNWh0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNv
# bS9EaWdpQ2VydFRydXN0ZWRSb290RzQuY3J0MEMGA1UdHwQ8MDowOKA2oDSGMmh0
# dHA6Ly9jcmwzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydFRydXN0ZWRSb290RzQuY3Js
# MCAGA1UdIAQZMBcwCAYGZ4EMAQQCMAsGCWCGSAGG/WwHATANBgkqhkiG9w0BAQsF
# AAOCAgEAfVmOwJO2b5ipRCIBfmbW2CFC4bAYLhBNE88wU86/GPvHUF3iSyn7cIoN
# qilp/GnBzx0H6T5gyNgL5Vxb122H+oQgJTQxZ822EpZvxFBMYh0MCIKoFr2pVs8V
# c40BIiXOlWk/R3f7cnQU1/+rT4osequFzUNf7WC2qk+RZp4snuCKrOX9jLxkJods
# kr2dfNBwCnzvqLx1T7pa96kQsl3p/yhUifDVinF2ZdrM8HKjI/rAJ4JErpknG6sk
# HibBt94q6/aesXmZgaNWhqsKRcnfxI2g55j7+6adcq/Ex8HBanHZxhOACcS2n82H
# hyS7T6NJuXdmkfFynOlLAlKnN36TU6w7HQhJD5TNOXrd/yVjmScsPT9rp/Fmw0HN
# T7ZAmyEhQNC3EyTN3B14OuSereU0cZLXJmvkOHOrpgFPvT87eK1MrfvElXvtCl8z
# OYdBeHo46Zzh3SP9HSjTx/no8Zhf+yvYfvJGnXUsHicsJttvFXseGYs2uJPU5vIX
# mVnKcPA3v5gA3yAWTyf7YGcWoWa63VXAOimGsJigK+2VQbc61RWYMbRiCQ8KvYHZ
# E/6/pNHzV9m8BPqC3jLfBInwAM1dwvnQI38AC+R2AibZ8GV2QqYphwlHK+Z/GqSF
# D/yYlvZVVCsfgPrA8g4r5db7qS9EFUrnEw4d2zc4GqEr9u3WfPwwggWNMIIEdaAD
# AgECAhAOmxiO+dAt5+/bUOIIQBhaMA0GCSqGSIb3DQEBDAUAMGUxCzAJBgNVBAYT
# AlVTMRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2Vy
# dC5jb20xJDAiBgNVBAMTG0RpZ2lDZXJ0IEFzc3VyZWQgSUQgUm9vdCBDQTAeFw0y
# MjA4MDEwMDAwMDBaFw0zMTExMDkyMzU5NTlaMGIxCzAJBgNVBAYTAlVTMRUwEwYD
# VQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5jb20xITAf
# BgNVBAMTGERpZ2lDZXJ0IFRydXN0ZWQgUm9vdCBHNDCCAiIwDQYJKoZIhvcNAQEB
# BQADggIPADCCAgoCggIBAL/mkHNo3rvkXUo8MCIwaTPswqclLskhPfKK2FnC4Smn
# PVirdprNrnsbhA3EMB/zG6Q4FutWxpdtHauyefLKEdLkX9YFPFIPUh/GnhWlfr6f
# qVcWWVVyr2iTcMKyunWZanMylNEQRBAu34LzB4TmdDttceItDBvuINXJIB1jKS3O
# 7F5OyJP4IWGbNOsFxl7sWxq868nPzaw0QF+xembud8hIqGZXV59UWI4MK7dPpzDZ
# Vu7Ke13jrclPXuU15zHL2pNe3I6PgNq2kZhAkHnDeMe2scS1ahg4AxCN2NQ3pC4F
# fYj1gj4QkXCrVYJBMtfbBHMqbpEBfCFM1LyuGwN1XXhm2ToxRJozQL8I11pJpMLm
# qaBn3aQnvKFPObURWBf3JFxGj2T3wWmIdph2PVldQnaHiZdpekjw4KISG2aadMre
# Sx7nDmOu5tTvkpI6nj3cAORFJYm2mkQZK37AlLTSYW3rM9nF30sEAMx9HJXDj/ch
# srIRt7t/8tWMcCxBYKqxYxhElRp2Yn72gLD76GSmM9GJB+G9t+ZDpBi4pncB4Q+U
# DCEdslQpJYls5Q5SUUd0viastkF13nqsX40/ybzTQRESW+UQUOsxxcpyFiIJ33xM
# dT9j7CFfxCBRa2+xq4aLT8LWRV+dIPyhHsXAj6KxfgommfXkaS+YHS312amyHeUb
# AgMBAAGjggE6MIIBNjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBTs1+OC0nFd
# ZEzfLmc/57qYrhwPTzAfBgNVHSMEGDAWgBRF66Kv9JLLgjEtUYunpyGd823IDzAO
# BgNVHQ8BAf8EBAMCAYYweQYIKwYBBQUHAQEEbTBrMCQGCCsGAQUFBzABhhhodHRw
# Oi8vb2NzcC5kaWdpY2VydC5jb20wQwYIKwYBBQUHMAKGN2h0dHA6Ly9jYWNlcnRz
# LmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEFzc3VyZWRJRFJvb3RDQS5jcnQwRQYDVR0f
# BD4wPDA6oDigNoY0aHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0RpZ2lDZXJ0QXNz
# dXJlZElEUm9vdENBLmNybDARBgNVHSAECjAIMAYGBFUdIAAwDQYJKoZIhvcNAQEM
# BQADggEBAHCgv0NcVec4X6CjdBs9thbX979XB72arKGHLOyFXqkauyL4hxppVCLt
# pIh3bb0aFPQTSnovLbc47/T/gLn4offyct4kvFIDyE7QKt76LVbP+fT3rDB6mouy
# XtTP0UNEm0Mh65ZyoUi0mcudT6cGAxN3J0TU53/oWajwvy8LpunyNDzs9wPHh6jS
# TEAZNUZqaVSwuKFWjuyk1T3osdz9HNj0d1pcVIxv76FQPfx2CWiEn2/K2yCNNWAc
# AgPLILCsWKAOQGPFmCLBsln1VWvPJ6tsds5vIy30fnFqI2si/xK4VC0nftg62fC2
# h5b9W9FcrBjDTZ9ztwGpn1eqXijiuZQxggN2MIIDcgIBATB3MGMxCzAJBgNVBAYT
# AlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjE7MDkGA1UEAxMyRGlnaUNlcnQg
# VHJ1c3RlZCBHNCBSU0E0MDk2IFNIQTI1NiBUaW1lU3RhbXBpbmcgQ0ECEAVEr/OU
# nQg5pr/bP1/lYRYwDQYJYIZIAWUDBAIBBQCggdEwGgYJKoZIhvcNAQkDMQ0GCyqG
# SIb3DQEJEAEEMBwGCSqGSIb3DQEJBTEPFw0yNDA1MjQyMTU0MDVaMCsGCyqGSIb3
# DQEJEAIMMRwwGjAYMBYEFGbwKzLCwskPgl3OqorJxk8ZnM9AMC8GCSqGSIb3DQEJ
# BDEiBCC59vhvTAn6Kx1U8eVxWu+/WQWjtx4Ulqyk/0nrZJSa+zA3BgsqhkiG9w0B
# CRACLzEoMCYwJDAiBCDS9uRt7XQizNHUQFdoQTZvgoraVZquMxavTRqa1Ax4KDAN
# BgkqhkiG9w0BAQEFAASCAgBSDg609CCO1URrsRfsE3Cv53kjMlJy7u8anj1R53Os
# KDf3wEbY47+qcAEJxXV4SbKQqA1WrUSjfIhKhfoU1G8U3fmMMYViLa4vs9MT+luV
# wpqlzziVeduF0eSYNlYgSJrrdKmKiW8ovc7VL/tA1xdD6ZZmQj7euehzEP2opy0W
# +rm6FbtRMIAZUZyajRkPbYFnsXv+RMf3iV3YukUwGxXQnH70hS87rzq3zRw13fZ9
# 0Va3bvBhARSpbd8kyew6DyRJrDedhoPw0Ij6dGhU8drpxaGckl9dCgC11K4N472l
# joRaTVmhNiCBruIcIO3Dm0Oonq7OZGOoVuD+imaVuSmpuO0Gm9rN4FOAVtA0vDkk
# ylbIqzTygNIg9DOk0yaGnUB9ZGr2OB02YjC4Ul8Wxsrx0LH8P1lnqu5QVhqzjM46
# E/njD9gfEkjkwD1OlqXmZU4xxbSnxSJ7KiibN/Ey1ACS6OlSLu+bl8NyQ5byMgb3
# v0d/TIWgYOaJoU8h0bPr/38lA+wSW/P+0wkxs7a6tBzh5TO0sQt2idFLtiWU37Dn
# TKl9Y0XPJJZuSYHw7pB4opr2friVwL2FZQVcVaDFWRhhlZOy1+DZ4XFPQ7CwFdO3
# s6OtiVWA5wEs9Ah0STjWkZ5+tY2UWp9XHPH71wiWv4JxxrNLj5Locz0Q5Kj7fzxI
# sQ==
# SIG # End signature block
