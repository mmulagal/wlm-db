import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { AccordionItem, ManageInstanceAccordion } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import styles from './PermissionListComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { PermissionListComponentItems } from './PermissionListComponentItems';
import { MANAGE_STATES, ACTION_TYPE, DBType } from '../../../../../../utils/consts';
import { getPermissionState } from '../../ManageInstanceUtils';

const PermissionListComponent = ({ manageChecks, policiesList, engineType }: any) => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll] = useState(false);
    const { wizardOperationType, bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);
    const { loading } = useAppSelector(state => state.agenticAI.agenticRegisterFlowChecks);
    const { aiAnalysisEnabled } = useAppSelector(state => state.auth);

    // Calculate readiness counts for bulk MSSQL/Oracle mode
    // Uses getPermissionState to read from manageReadiness data which gets updated when API responses arrive
    const readinessCounts = useMemo(() => {
        if (
            wizardOperationType === ACTION_TYPE.BULK &&
            (engineType === DBType.MSSQL || engineType === DBType.ORACLE) &&
            Array.isArray(bulkDetectedInstanceList)
        ) {
            // Oracle has only 2 capabilities: remediation, errorInvestigation
            // MSSQL has 4 capabilities: remediation, dbcreation, sandbox, errorInvestigation
            const capabilities =
                engineType === DBType.ORACLE
                    ? ['remediation', 'errorInvestigation']
                    : ['remediation', 'dbcreation', 'sandbox', 'errorInvestigation'];
            const counts: Record<
                string,
                { ready: number; total: number; missingInstances: { name: string; hostName: string }[] }
            > = {};

            capabilities.forEach(cap => {
                const missingInstances: { name: string; hostName: string }[] = [];
                let readyCount = 0;

                bulkDetectedInstanceList.forEach((instance: any) => {
                    const manageReadinessData = instance?.manageReadiness || instance?.data?.manageReadiness || {};
                    // Use getPermissionState to compute status from manageReadiness
                    const status = getPermissionState(cap, manageReadinessData);
                    if (status === MANAGE_STATES.READY) {
                        readyCount++;
                    } else {
                        const hostName = instance?.hostName || instance?.data?.name || instance?.hostRow?.name || '';
                        const instanceName = instance?.instanceName || instance?.data?.databaseInstanceName || '-';
                        missingInstances.push({ name: instanceName, hostName });
                    }
                });

                counts[cap] = {
                    ready: readyCount,
                    total: bulkDetectedInstanceList.length,
                    missingInstances
                };
            });

            return counts;
        }
        return null;
    }, [wizardOperationType, engineType, bulkDetectedInstanceList]);

    const items: AccordionItem[] = PermissionListComponentItems(
        t,
        manageChecks,
        policiesList,
        wizardOperationType,
        engineType,
        aiAnalysisEnabled
    );

    return (
        <div className={styles.permissionList}>
            <DsTypography variant="Semibold_16">{t('databases.register-flow.prerequisite-check')}</DsTypography>

            <div className={styles.accordionSection}>
                <ManageInstanceAccordion
                    items={items}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    disableAll={disableAll}
                    errorInvestigationLoading={loading && aiAnalysisEnabled}
                    readinessCounts={readinessCounts}
                    engineType={engineType}
                    aiAnalysisEnabled={aiAnalysisEnabled}
                />
            </div>
        </div>
    );
};

export default PermissionListComponent;
