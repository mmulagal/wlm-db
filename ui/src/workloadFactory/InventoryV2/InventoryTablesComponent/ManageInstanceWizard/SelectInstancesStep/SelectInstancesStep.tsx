import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import styles from './SelectInstancesStep.module.scss';

import ManageWizardFooter from '../ManageWizardFooter';

import { ReactComponent as MultipleInstances } from '../../../../../assets/Multiple instances credentials 3.svg';
import SelectInstances from '../DetectInstanceStep/DetectContent/SelectInstances';
import { UseWizardReturn } from '../../../../../utils/types/registerTypes';
import { useAppSelector } from '../../../../../store/storeHooks';
import { getSelectInstancesPageContentKeys } from './SelectInstancesStepHelper';

export const Content = () => {
    const { t } = useTranslation();
    const { selectedHostType } = useAppSelector(state => state.inventoryV2);
    const pageContentKeys = getSelectInstancesPageContentKeys(selectedHostType);

    return (
        <div className={styles['select-instances']}>
            <div className={styles.container}>
                <div className={styles.image}>
                    <MultipleInstances />
                </div>
                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_16">{t(pageContentKeys.content1)}</DsTypography>
                    <DsTypography variant="Regular_14" className={styles.description}>
                        {t(pageContentKeys.content2)}
                    </DsTypography>
                </div>

                <div className={styles.selectInstances}>
                    <SelectInstances engineType={selectedHostType} />
                </div>
            </div>
        </div>
    );
};

export const Footer = () => {
    const { state }: UseWizardReturn = useWizard();
    return (
        <ManageWizardFooter
            nextButtonProps={{
                onClick: async () => {
                    if (state.submit) {
                        state.submit();
                    }
                }
            }}
        />
    );
};
