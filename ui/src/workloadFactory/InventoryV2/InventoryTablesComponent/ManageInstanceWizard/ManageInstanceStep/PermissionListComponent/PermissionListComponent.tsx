import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { AccordionItem, ManageInstanceAccordion } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import styles from './PermissionListComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { PermissionListComponentItems } from './PermissionListComponentItems';

const PermissionListComponent = ({ manageChecks, policiesList, engineType }: any) => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll] = useState(false);
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

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
                />
            </div>
        </div>
    );
};

export default PermissionListComponent;
