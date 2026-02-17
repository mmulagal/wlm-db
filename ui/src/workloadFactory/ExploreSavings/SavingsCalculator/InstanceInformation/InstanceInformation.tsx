import { Table, useTable, DsTypography, TextField } from '@netapp/design-system';
import classNames from 'classnames';
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './InstanceInformation.module.scss';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import { FINDINGS, SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';
import { setOnPremStorageAndComputeInfo } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import { getOracleColDefs, getInstanceColDefs, getInstanceClassName } from './InstanceInformationUtils';

const InstanceInformation = ({ host }: { host?: any }) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const {
        savingsCalculatorFrom,
        storageSavingsResponse,
        storageSavingsLoading,
        snapshotLoading,
        selectedExploreSavingsTab,
        selectedOnPremHostDetails,
        onPremStorageAndComputeInfo
    }: any = useAppSelector(state => state.exploreSavings);

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [noOfInstances, setNoOfInstances] = useState(0);
    // Local state for Monthly Oracle cost input
    const [oracleCostLocal, setOracleCostLocal] = useState<string>('');
    // Debounced value - dispatches to store after 1s of inactivity
    const [oracleCostDebounced, setOracleCostDebounced] = useSearchDebounce(1000);

    // Check if Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;

    // Derive the store key for the current host's first database entry
    const oracleStoreKey = useMemo(() => {
        if (!isOracleOnPrem || !onPremStorageAndComputeInfo) return null;
        const currentHost = host || selectedOnPremHostDetails;
        if (!currentHost?.resourceId) return null;
        const matchingKey = Object.keys(onPremStorageAndComputeInfo).find(key =>
            key.startsWith(`${currentHost.resourceId}_`)
        );
        return matchingKey || null;
    }, [isOracleOnPrem, host, selectedOnPremHostDetails, onPremStorageAndComputeInfo]);

    // Initialize local state from store data when host changes
    useEffect(() => {
        if (oracleStoreKey && onPremStorageAndComputeInfo?.[oracleStoreKey]?.monthlyOracleCost !== undefined) {
            setOracleCostLocal(onPremStorageAndComputeInfo[oracleStoreKey].monthlyOracleCost ?? '');
        }
    }, [oracleStoreKey]);

    // Feed local state into debounce
    useEffect(() => {
        setOracleCostDebounced(oracleCostLocal);
    }, [oracleCostLocal]);

    // After debounce, dispatch to Redux store only if value actually changed
    useEffect(() => {
        if (oracleCostDebounced !== null && oracleCostDebounced !== undefined && oracleStoreKey) {
            const currentStoreValue = onPremStorageAndComputeInfo?.[oracleStoreKey]?.monthlyOracleCost ?? '';
            if (oracleCostDebounced !== currentStoreValue) {
                dispatch(
                    setOnPremStorageAndComputeInfo({
                        type: oracleStoreKey,
                        mode: 'monthlyOracleCost',
                        value: oracleCostDebounced
                    })
                );
            }
        }
    }, [oracleCostDebounced, oracleStoreKey]);

    useEffect(() => {
        if (selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES) {
            let currentHost = host || selectedHostDetails;

            // If host prop exists and matches selectedHostDetails, prefer selectedHostDetails for latest data
            if (
                host &&
                selectedHostDetails &&
                host.ec2InstanceId === selectedHostDetails.ec2InstanceId &&
                host.credentialId === selectedHostDetails.credentialId &&
                host.regionId === selectedHostDetails.regionId
            ) {
                currentHost = selectedHostDetails;
            }

            setLoading(currentHost?.loading);
            const hostName = currentHost?.name;

            const findingsComputeData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                    // Handle AUTO_EBS array format
                    const computeArray = Array.isArray(storageSavingsResponse?.compute)
                        ? storageSavingsResponse.compute
                        : [storageSavingsResponse?.compute].filter(Boolean);

                    // Find compute data by matching hostname
                    const hostCompute = computeArray.find((item: any) => item.hostname === hostName);
                    return hostCompute?.existing?.finding || '-';
                }
                // Handle single object format for other modes
                return storageSavingsResponse && (storageSavingsResponse?.compute?.existing?.finding || '-');
            })();
            const findingsLicenseData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                    // Handle AUTO_EBS array format
                    const licenseArray = Array.isArray(storageSavingsResponse?.license)
                        ? storageSavingsResponse.license
                        : [storageSavingsResponse?.license].filter(Boolean);

                    // Find license data by matching hostname
                    const hostLicense = licenseArray.find((item: any) => item.hostname === hostName);
                    return hostLicense?.existing?.finding || '-';
                }
                // Handle single object format for other modes
                return storageSavingsResponse && (storageSavingsResponse?.license?.existing?.finding || '-');
            })();
            const findingsDbModel =
                currentHost?.serverInstallationMode?.length &&
                currentHost?.serverInstallationMode.includes(t('databases.general.always-on-availability-group'))
                    ? FINDINGS.NOT_OPTIMIZED
                    : FINDINGS.OPTIMIZED;

            setNoOfInstances(currentHost?.totalInstance || 0);

            let instanceTypelist = [];
            if (currentHost?.clusterNodeDetails && currentHost?.clusterNodeDetails?.length === 2) {
                instanceTypelist = currentHost?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
            } else {
                instanceTypelist = currentHost?.ec2Details?.map((inst: any) => inst?.instanceType);
            }
            const serverEdition: any = [];

            currentHost?.sqlServerInstances?.map((perRow: any) => {
                // Check both nested and direct paths for serverEdition
                const edition = perRow?.databaseServer?.serverEdition || perRow?.serverEdition;

                if (edition && !serverEdition.includes(edition)) {
                    serverEdition.push(edition);
                }
            });
            const data: any = [
                {
                    details: 'Instance type',
                    value: instanceTypelist?.length > 0 ? instanceTypelist.join(', ') : t('databases.general.not-available'),
                    id: '1',
                    findings: savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ? findingsComputeData : ''
                },
                {
                    details: 'SQL Edition',
                    value: serverEdition?.length > 0 ? serverEdition.join(', ') : t('databases.general.not-available'),
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: currentHost?.serverAllInstallationMode
                        ? currentHost?.serverAllInstallationMode.join(', ')
                        : currentHost?.serverInstallationMode || t('databases.general.not-available'),
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedHostDetails, storageSavingsResponse, host]);

    useEffect(() => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            // For on-prem bulk mode, use the host prop if available
            const currentHost = host || selectedOnPremHostDetails;
            const hostName = currentHost?.resourceName;

            const findingsLicenseData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && storageSavingsResponse) {
                    // Handle ONPREM array format for bulk
                    const licenseArray = Array.isArray(storageSavingsResponse?.license)
                        ? storageSavingsResponse.license
                        : [storageSavingsResponse?.license].filter(Boolean);

                    // Find license data by matching resourceName (ONPREM API returns resourceName)
                    const hostLicense = licenseArray.find((item: any) => item.resourceName === hostName);
                    return hostLicense?.finding || '-';
                }
                // Handle single object format for non-bulk mode
                return storageSavingsResponse && (storageSavingsResponse?.license?.finding || '-');
            })();

            const findingsDbModel = currentHost?.deploymentModel?.includes(t('databases.general.always-on-availability-group'))
                ? FINDINGS.NOT_OPTIMIZED
                : FINDINGS.OPTIMIZED;

            setNoOfInstances(currentHost?.totalInstance || 0);

            const serverEdition: any = [];
            currentHost?.sqlServerInstances?.map((perRow: any) => {
                if (perRow?.sqlEdition && !serverEdition.includes(perRow?.sqlEdition)) {
                    serverEdition.push(perRow?.sqlEdition);
                }
            });
            const data: any = [
                {
                    details: 'SQL Edition',
                    value: serverEdition?.length > 0 ? serverEdition.join(', ') : t('databases.general.not-available'),
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: currentHost?.deploymentModel || t('databases.general.not-available'),
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedOnPremHostDetails, storageSavingsResponse, host]);

    // Oracle on-prem mode - Database Information
    useEffect(() => {
        if (isOracleOnPrem) {
            const currentHost = host || selectedOnPremHostDetails;

            const findingsLicenseData = (() => {
                if (storageSavingsResponse) {
                    const licenseArray = Array.isArray(storageSavingsResponse?.license)
                        ? storageSavingsResponse.license
                        : [storageSavingsResponse?.license].filter(Boolean);
                    const hostLicense = licenseArray.find(
                        (item: any) => item.resourceName === currentHost?.resourceName
                    );
                    return hostLicense?.finding || '-';
                }
                return '-';
            })();

            // For Oracle, deployment model is typically standalone or RAC
            const findingsDbModel = FINDINGS.OPTIMIZED;

            setNoOfInstances(currentHost?.totalInstance || currentHost?.databaseNameList?.length || 0);

            const data: any = [
                {
                    details: 'Database edition',
                    value: currentHost?.oracleEdition || t('databases.general.not-available'),
                    id: '1',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: currentHost?.deploymentModel || t('databases.general.not-available'),
                    id: '2',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [isOracleOnPrem, selectedOnPremHostDetails, storageSavingsResponse, host]);

    // Determine column width based on mode
    const isOnPremMode = selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES || isOracleOnPrem;

    const columns = isOracleOnPrem
        ? getOracleColDefs({ loading, noOfInstances, styles, t })
        : getInstanceColDefs({
              loading,
              noOfInstances,
              storageSavingsLoading,
              snapshotLoading,
              savingsCalculatorFrom,
              isOnPremMode,
              styles,
              t
          });

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        columns,
        rows: tableData,
        pageSize: 10
    });

    // Get the section title based on mode
    const getSectionTitle = () => {
        if (isOracleOnPrem) {
            return t('databases.explore-savings.database-information');
        }
        return t('databases.explore-savings.instance-information');
    };

    return (
        <div className={getInstanceClassName({ savingsCalculatorFrom, selectedExploreSavingsTab, isOracleOnPrem, styles })}>
            <DsTypography variant="Regular_14">{getSectionTitle()}</DsTypography>
            <div className={classNames(styles.instanceTable, { [styles.oracleTable]: isOracleOnPrem })}>
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
            {isOracleOnPrem && (
                <div className={styles.monthlyOracleCost}>
                    <TextField
                        label={t('databases.explore-savings.monthly-oracle-cost')}
                        placeholder=""
                        value={oracleCostLocal}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setOracleCostLocal(value);
                        }}
                        className={styles.oracleCostInput}
                    />
                </div>
            )}
        </div>
    );
};

export default InstanceInformation;
