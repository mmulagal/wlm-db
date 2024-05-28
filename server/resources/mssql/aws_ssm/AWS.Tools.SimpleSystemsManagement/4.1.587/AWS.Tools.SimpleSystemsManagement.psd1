#
# Module manifest for module 'AWS.Tools.SimpleSystemsManagement'
#

@{
    # Script module or binary module file associated with this manifest
    RootModule = 'AWS.Tools.SimpleSystemsManagement.dll'

    # Supported PSEditions
    CompatiblePSEditions = @('Core', 'Desktop')

    # Version number of this module.
    ModuleVersion = '4.1.587'

    # ID used to uniquely identify this module
    GUID = 'edb5d1c1-b090-47b3-a133-a36321592456'

    # Author of this module
    Author = 'Amazon.com, Inc'

    # Company or vendor of this module
    CompanyName = 'Amazon.com, Inc'

    # Copyright statement for this module
    Copyright = 'Copyright 2012-2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.'

    # Description of the functionality provided by this module
    Description = 'The SimpleSystemsManagement module of AWS Tools for PowerShell lets developers and administrators manage AWS Systems Manager from the PowerShell scripting environment. In order to manage each AWS service, install the corresponding module (e.g. AWS.Tools.EC2, AWS.Tools.S3...).
The module AWS.Tools.Installer (https://www.powershellgallery.com/packages/AWS.Tools.Installer/) makes it easier to install, update and uninstall the AWS.Tools modules.
This version of AWS Tools for PowerShell is compatible with Windows PowerShell 5.1+ and PowerShell Core 6+ on Windows, Linux and macOS. When running on Windows PowerShell, .NET Framework 4.7.2 or newer is required. Alternative modules AWSPowerShell.NetCore and AWSPowerShell, provide support for all AWS services from a single module and also support older versions of Windows PowerShell and .NET Framework.'

    # Minimum version of the PowerShell engine required by this module
    PowerShellVersion = '5.1'

    # Name of the PowerShell host required by this module
    PowerShellHostName = ''

    # Minimum version of the PowerShell host required by this module
    PowerShellHostVersion = ''

    # Minimum version of the .NET Framework required by this module
    DotNetFrameworkVersion = '4.7.2'

    # Minimum version of the common language runtime (CLR) required by this module
    CLRVersion = ''

    # Processor architecture (None, X86, Amd64, IA64) required by this module
    ProcessorArchitecture = ''

    # Modules that must be imported into the global environment prior to importing this module
    RequiredModules = @(
        @{
            ModuleName = 'AWS.Tools.Common';
            RequiredVersion = '4.1.587';
            Guid = 'e5b05bf3-9eee-47b2-81f2-41ddc0501b86' }
    )

    # Assemblies that must be loaded prior to importing this module.
    RequiredAssemblies = @(
        'AWSSDK.SimpleSystemsManagement.dll'
    )

    # Script files (.ps1) that are run in the caller's environment prior to importing this module
    ScriptsToProcess = @(

    )

    # Type files (.ps1xml) to be loaded when importing this module
    TypesToProcess = @(

    )

    # Format files (.ps1xml) to be loaded when importing this module
    FormatsToProcess = @(
        'AWS.Tools.SimpleSystemsManagement.Format.ps1xml'
    )

    # Modules to import as nested modules of the module specified in ModuleToProcess
    NestedModules = @(
        'AWS.Tools.SimpleSystemsManagement.Completers.psm1',
        'AWS.Tools.SimpleSystemsManagement.Aliases.psm1'
    )

    # Functions to export from this module
    FunctionsToExport = ''

    # Cmdlets to export from this module
    CmdletsToExport = @(
        'Add-SSMResourceTag', 
        'Edit-SSMDocumentPermission', 
        'Get-SSMActivation', 
        'Get-SSMAssociation', 
        'Get-SSMAssociationExecution', 
        'Get-SSMAssociationExecutionTarget', 
        'Get-SSMAssociationList', 
        'Get-SSMAssociationVersionList', 
        'Get-SSMAutomationExecution', 
        'Get-SSMAutomationExecutionList', 
        'Get-SSMAutomationStepExecution', 
        'Get-SSMAvailablePatch', 
        'Get-SSMCalendarState', 
        'Get-SSMCommand', 
        'Get-SSMCommandInvocation', 
        'Get-SSMCommandInvocationDetail', 
        'Get-SSMComplianceItemList', 
        'Get-SSMComplianceSummaryList', 
        'Get-SSMConnectionStatus', 
        'Get-SSMDefaultPatchBaseline', 
        'Get-SSMDeployablePatchSnapshotForInstance', 
        'Get-SSMDocument', 
        'Get-SSMDocumentDescription', 
        'Get-SSMDocumentList', 
        'Get-SSMDocumentMetadataHistory', 
        'Get-SSMDocumentPermission', 
        'Get-SSMDocumentVersionList', 
        'Get-SSMEffectiveInstanceAssociationList', 
        'Get-SSMEffectivePatchesForPatchBaseline', 
        'Get-SSMInstanceAssociationsStatus', 
        'Get-SSMInstanceInformation', 
        'Get-SSMInstancePatch', 
        'Get-SSMInstancePatchState', 
        'Get-SSMInstancePatchStatesForPatchGroup', 
        'Get-SSMInstanceProperty', 
        'Get-SSMInventory', 
        'Get-SSMInventoryDeletionList', 
        'Get-SSMInventoryEntryList', 
        'Get-SSMInventorySchema', 
        'Get-SSMLatestEC2Image', 
        'Get-SSMMaintenanceWindow', 
        'Get-SSMMaintenanceWindowExecution', 
        'Get-SSMMaintenanceWindowExecutionList', 
        'Get-SSMMaintenanceWindowExecutionTask', 
        'Get-SSMMaintenanceWindowExecutionTaskInvocation', 
        'Get-SSMMaintenanceWindowExecutionTaskInvocationList', 
        'Get-SSMMaintenanceWindowExecutionTaskList', 
        'Get-SSMMaintenanceWindowList', 
        'Get-SSMMaintenanceWindowSchedule', 
        'Get-SSMMaintenanceWindowsForTarget', 
        'Get-SSMMaintenanceWindowTarget', 
        'Get-SSMMaintenanceWindowTask', 
        'Get-SSMMaintenanceWindowTaskList', 
        'Get-SSMOpsItem', 
        'Get-SSMOpsItemEvent', 
        'Get-SSMOpsItemRelatedItem', 
        'Get-SSMOpsItemSummary', 
        'Get-SSMOpsMetadata', 
        'Get-SSMOpsMetadataList', 
        'Get-SSMOpsSummary', 
        'Get-SSMParameter', 
        'Get-SSMParameterHistory', 
        'Get-SSMParameterList', 
        'Get-SSMParametersByPath', 
        'Get-SSMParameterValue', 
        'Get-SSMPatchBaseline', 
        'Get-SSMPatchBaselineDetail', 
        'Get-SSMPatchBaselineForPatchGroup', 
        'Get-SSMPatchGroup', 
        'Get-SSMPatchGroupState', 
        'Get-SSMPatchProperty', 
        'Get-SSMResourceComplianceSummaryList', 
        'Get-SSMResourceDataSync', 
        'Get-SSMResourcePolicy', 
        'Get-SSMResourceTag', 
        'Get-SSMServiceSetting', 
        'Get-SSMSession', 
        'New-SSMActivation', 
        'New-SSMAssociation', 
        'New-SSMAssociationFromBatch', 
        'New-SSMDocument', 
        'New-SSMMaintenanceWindow', 
        'New-SSMOpsItem', 
        'New-SSMOpsMetadata', 
        'New-SSMPatchBaseline', 
        'New-SSMResourceDataSync', 
        'Register-SSMDefaultPatchBaseline', 
        'Register-SSMOpsItemRelatedItem', 
        'Register-SSMPatchBaselineForPatchGroup', 
        'Register-SSMTargetWithMaintenanceWindow', 
        'Register-SSMTaskWithMaintenanceWindow', 
        'Remove-SSMActivation', 
        'Remove-SSMAssociation', 
        'Remove-SSMDocument', 
        'Remove-SSMInventory', 
        'Remove-SSMMaintenanceWindow', 
        'Remove-SSMOpsItem', 
        'Remove-SSMOpsMetadata', 
        'Remove-SSMParameter', 
        'Remove-SSMParameterCollection', 
        'Remove-SSMPatchBaseline', 
        'Remove-SSMResourceDataSync', 
        'Remove-SSMResourcePolicy', 
        'Remove-SSMResourceTag', 
        'Reset-SSMParameterVersionLabel', 
        'Reset-SSMServiceSetting', 
        'Resume-SSMSession', 
        'Send-SSMAutomationSignal', 
        'Send-SSMCommand', 
        'Set-SSMParameterVersionLabel', 
        'Start-SSMAssociationsOnce', 
        'Start-SSMAutomationExecution', 
        'Start-SSMChangeRequestExecution', 
        'Start-SSMSession', 
        'Stop-SSMAutomationExecution', 
        'Stop-SSMCommand', 
        'Stop-SSMMaintenanceWindowExecution', 
        'Stop-SSMSession', 
        'Unregister-SSMManagedInstance', 
        'Unregister-SSMOpsItemRelatedItem', 
        'Unregister-SSMPatchBaselineForPatchGroup', 
        'Unregister-SSMTargetFromMaintenanceWindow', 
        'Unregister-SSMTaskFromMaintenanceWindow', 
        'Update-SSMAssociation', 
        'Update-SSMAssociationStatus', 
        'Update-SSMDocument', 
        'Update-SSMDocumentDefaultVersion', 
        'Update-SSMDocumentMetadata', 
        'Update-SSMMaintenanceWindow', 
        'Update-SSMMaintenanceWindowTarget', 
        'Update-SSMMaintenanceWindowTask', 
        'Update-SSMManagedInstanceRole', 
        'Update-SSMOpsItem', 
        'Update-SSMOpsMetadata', 
        'Update-SSMPatchBaseline', 
        'Update-SSMResourceDataSync', 
        'Update-SSMServiceSetting', 
        'Write-SSMComplianceItem', 
        'Write-SSMInventory', 
        'Write-SSMParameter', 
        'Write-SSMResourcePolicy')

    # Variables to export from this module
    VariablesToExport = '*'

    # Aliases to export from this module
    AliasesToExport = @(
        'Get-SSMMaintenanceWindowTargets', 
        'Get-SSMParameterNameList', 
        'Get-SSMComplianceItemsList', 
        'Get-SSMComplianceSummariesList', 
        'Get-SSMInventoryEntriesList', 
        'Get-SSMResourceComplianceSummariesList')

    # List of all modules packaged with this module
    ModuleList = @()

    # List of all files packaged with this module
    FileList = @(
        'AWS.Tools.SimpleSystemsManagement.dll-Help.xml'
    )

    # Private data to pass to the module specified in ModuleToProcess
    PrivateData = @{

        PSData = @{
            Tags = @('AWS', 'cloud', 'Windows', 'PSEdition_Desktop', 'PSEdition_Core', 'Linux', 'MacOS', 'Mac')
            LicenseUri = 'https://aws.amazon.com/apache-2-0/'
            ProjectUri = 'https://github.com/aws/aws-tools-for-powershell'
            IconUri = 'https://sdk-for-net.amazonwebservices.com/images/AWSLogo128x128.png'
            ReleaseNotes = 'https://github.com/aws/aws-tools-for-powershell/blob/master/CHANGELOG.md'
        }
    }
}

# SIG # Begin signature block
# MIIufQYJKoZIhvcNAQcCoIIubjCCLmoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCC+bQ1XDRDuqPmt
# ogFJnDCsEBCBfxcGGOjQLKlYBhaVwqCCE+owggXAMIIEqKADAgECAhAP0bvKeWvX
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
# KwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIJ+VZx8J
# HjBskph91wlpIHkRZd/8UY51xsGdIL7h3OeVMA0GCSqGSIb3DQEBAQUABIIBgAll
# LlpvYRDVjsIQWxqZcSY6RI2DZslOzrcrLCfmT3mQMrjsdiSTiVdDhTYsdgvJoDKw
# p/AbBRRsKNVXrjfAM8cgl0y+VWeEVYsbcHIycEseH/hoh0sCwCImS3sRTf/uW43Q
# I+ibaIr73li6pdbvSXtaNN/hhQNbnJSl2u4oIoCENMIHVc5pl5mO6gxjp0ReCXqs
# EZX+GbAKFcerbUZN8COQzhiO0zMWTPKaAsvRg50+mNqs4qEQ9hrypOAj84RCVqFe
# L1IGukrp6SIAOy64fxhz1X53dplfeCk3zaM2lBhLeZV6AsPskecS2CRlxXs7FJ+p
# h/hbEYYMkABxR0fvq7bpQRGStmFCni5PCYQ/wFVfVASSrsUkPzs827OlYptqH9rH
# X6yqerQqSI+t5mJSvCwqjvNklOSMoi7R4yn5Nwh8tgMbX9C6nk1dv6lxYwX0wTqS
# P6EgcsMLhHpRaSpqcSRuk2bkgBs5FuQDnvelMdoLP2OoUIlp6UyWX7ODk2Ot9KGC
# Fz8wghc7BgorBgEEAYI3AwMBMYIXKzCCFycGCSqGSIb3DQEHAqCCFxgwghcUAgED
# MQ8wDQYJYIZIAWUDBAIBBQAwdwYLKoZIhvcNAQkQAQSgaARmMGQCAQEGCWCGSAGG
# /WwHATAxMA0GCWCGSAFlAwQCAQUABCASP3WNPJ+fD5IZoEi+5FckYr9XFb7JnqtO
# uzXytmrUNAIQF109WYrlfrbJZW4yESunnxgPMjAyNDA1MjQyMTU0MTBaoIITCTCC
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
# SIb3DQEJEAEEMBwGCSqGSIb3DQEJBTEPFw0yNDA1MjQyMTU0MTBaMCsGCyqGSIb3
# DQEJEAIMMRwwGjAYMBYEFGbwKzLCwskPgl3OqorJxk8ZnM9AMC8GCSqGSIb3DQEJ
# BDEiBCD5/rLkevMwtBWoROZeAL8BQMaeFvXBCYa6pp2XcBNJkjA3BgsqhkiG9w0B
# CRACLzEoMCYwJDAiBCDS9uRt7XQizNHUQFdoQTZvgoraVZquMxavTRqa1Ax4KDAN
# BgkqhkiG9w0BAQEFAASCAgCHIsmYPriKgmd3UEE1ylMR+kHFAWTV8pvQMolhtVda
# EG/pgE2dgTpHXVLVGKlztFq/fPPWMl8zDlw1PVk+woYVuYpcJExsZCICob3+KCFw
# QJiBY9xdx/hjOm8LvWYs8Yl5W4qnuQRjhpvhUebhIcp/uk0zkqpwDTzrNWoTb6Zp
# Wcn1sVXD1KboFVXuHdlQ+YJX6DPYAd6vqC5IWqc9u59foT3TnQbraVKA2khOreTy
# OqjBRO2RjFxWSwHLn1x8RRhbrIIIDMy1BoVXr74QaTCcv12AcCSq41liG02Wqltt
# Z6b57E6aZQwMooh8NjwuGMicI596EsEKhYXEddhnz8DqPYR3eg8Wb8TT5oKp8XZ2
# Le94otN+1/zRDpCESS+AQk8yk1fxDej8EXs7ZTZV5YHC3kHUtNuvHnWGEoTlswWI
# /+LpfJpZARMO2Qbjv0j4QwOLCHbJB4JtQWYcEY4NviLlrFQDqnWeomh77t8aB8Nr
# 77SRkq1gC3BxvrcgZbk9XPfEjFUMNtY2Twphfzs2qJQIyEoG3o8P24MsIv7vOaR1
# a/xW/pAkSM63/CYZjWTkHpNJCcwxBm/4rVwjt7rPeJyeat91hLe0EuzibMXvP2BY
# GxF/6nMM8cyABL3WqzWq/DWmWJ2051bUjcNBkbdjvixaMliPB53OI2BvywjdDbsk
# Cw==
# SIG # End signature block
