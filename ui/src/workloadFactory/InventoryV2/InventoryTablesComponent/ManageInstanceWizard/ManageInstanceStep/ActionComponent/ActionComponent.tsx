import { DsCheckbox, DsTypography, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import styles from './ActionComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setInstallType } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { ManageStates, UseWizardReturn } from '../../../../../../utils/types/registerTypes';
import { CHECK_LABELS, ENGINE_TYPE_CHECKS } from '../ManageInstanceStepHelper';

type ActionComponentProps = {
    manageChecks: Partial<ManageStates>;
    engineType: string;
};

const ActionComponent = ({ manageChecks, engineType }: ActionComponentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: UseWizardReturn = useWizard();
    const installActionState = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    useEffect(() => {
        // Set all install types found in manageChecks for this engine type
        const installTypes: Record<string, any> = {};
        (ENGINE_TYPE_CHECKS[engineType] || []).forEach(key => {
            installTypes[key] = manageChecks?.[key as keyof ManageStates];
        });
        dispatch(setInstallType(installTypes));
    }, [wizardOperationType, manageChecks, engineType]);

    const checksToRender = ENGINE_TYPE_CHECKS[engineType] || [];

    return (
        <div className={styles.actionComponent}>
            <DsTypography variant="Semibold_16">{t('databases.general.action-required')}</DsTypography>
            <div className={styles.selectContainer}>
                {checksToRender.map(key =>
                    manageChecks?.[key as keyof ManageStates] ? (
                        <DsCheckbox
                            key={key}
                            id={`wlm-db-${key}`}
                            title={t(CHECK_LABELS[key]?.[engineType] || key)}
                            onSelect={() => {
                                dispatch(setInstallType({ [key]: !installActionState[key] }));
                                setState({ [key]: !installActionState[key] });
                            }}
                            isSelected={!!installActionState[key]}
                            isDisabled={!manageChecks?.[key as keyof ManageStates]}
                            className={styles.checkboxContainer}
                        />
                    ) : null
                )}
            </div>
        </div>
    );
};

export default ActionComponent;
