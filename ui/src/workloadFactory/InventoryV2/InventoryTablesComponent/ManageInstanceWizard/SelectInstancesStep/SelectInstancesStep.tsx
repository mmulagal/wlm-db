import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useTranslation } from 'react-i18next';
import styles from './SelectInstancesStep.module.scss';

import ManageWizardFooter from '../ManageWizardFooter';

import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MultipleInstances } from '../../../../../assets/Multiple instances credentials 3.svg';
import SelectInstances from '../DetectInstanceStep/DetectContent/SelectInstances';
import { UseWizardReturn } from '../../../../../utils/types/registerTypes';

export const Content = () => {
    const { t } = useTranslation();
    return (
        <div className={styles['select-instances']}>
            <div className={styles.container}>
                <div className={styles.image}>
                    <MultipleInstances />
                </div>
                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_16">
                        {t('databases.register-flow.select-instance-page-content1')}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.description}>
                        {t('databases.register-flow.select-instance-page-content2')}
                    </DsTypography>
                </div>

                <div className={styles.selectInstances}>
                    <SelectInstances />
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
