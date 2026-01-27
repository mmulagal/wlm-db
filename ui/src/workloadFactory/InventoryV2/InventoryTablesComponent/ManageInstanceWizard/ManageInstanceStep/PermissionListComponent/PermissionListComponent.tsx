import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { AccordionItem, ManageInstanceAccordion } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import styles from './PermissionListComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { PermissionListComponentItems } from './PermissionListComponentItems';
import { MANAGE_STATES, ACTION_TYPE, DBType } from '../../../../../../utils/consts';

const PermissionListComponent = ({ manageChecks, policiesList, engineType }: any) => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll] = useState(false);
    const { wizardOperationType, bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);
    const { loading } = useAppSelector(state => state.agenticAI.agenticRegisterFlowChecks);

    // Calculate readiness counts for bulk MSSQL/Oracle mode
    const readinessCounts = useMemo(() => {
        if (
            wizardOperationType === ACTION_TYPE.BULK &&
            (engineType === DBType.MSSQL || engineType === DBType.ORACLE) &&
            Array.isArray(bulkDetectedInstanceList)
        ) {
            // Oracle has only 3 capabilities: assessment, dbcreation, errorInvestigation
            // MSSQL has 5 capabilities: assessment, remediation, dbcreation, sandbox, errorInvestigation
            const capabilities =
                engineType === DBType.ORACLE
                    ? ['assessment', 'remediation', 'errorInvestigation']
                    : ['assessment', 'remediation', 'dbcreation', 'sandbox', 'errorInvestigation'];
            const counts: Record<string, { ready: number; total: number; missingInstances: string[] }> = {};

            capabilities.forEach(cap => {
                // Get instances that are NOT ready for this specific capability
                const missingInstances: string[] = [];
                let readyCount = 0;

                bulkDetectedInstanceList.forEach((instance: any) => {
                    // Get the status for this capability directly from manageStates
                    const status = instance?.manageStates?.[cap];
                    if (status === MANAGE_STATES.READY) {
                        readyCount++;
                    } else {
                        // Get instance name for tooltip
                        const instanceName = instance?.instanceName || instance?.data?.databaseInstanceName;
                        missingInstances.push(instanceName);
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
        engineType
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
                    errorInvestigationLoading={loading}
                    readinessCounts={readinessCounts}
                    engineType={engineType}
                />
            </div>
        </div>
    );
};

export default PermissionListComponent;
