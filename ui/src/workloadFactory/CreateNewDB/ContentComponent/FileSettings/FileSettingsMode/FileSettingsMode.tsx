import { AccordionCard, AccordionCardContent, DsTypography, RadioButton } from '@netapp/design-system';

import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedNewUserConfig } from '../../../../../store/workloadFactory/createNewDBSlice';
import styles from './FileSettingsMode.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

const FileSettingsMode = () => {
    const dispatch = useDispatch();
    const selectedConfigNewUser = useAppSelector(state => state.createNewUser.selectedNewUserConfig);

    //Set the Header text here
    const setHeader = () => {
        return <DsTypography variant="Regular_14">{selectedConfigNewUser}</DsTypography>;
    };

    return (
        <div className={styles.fileSettingsMode}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{GENERAL.DB_CREATE_FILE_SETTINGS_MODE}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={selectedConfigNewUser === GENERAL.DB_QUICK_CREATE}
                                onChange={() => {
                                    dispatch(setSelectedNewUserConfig(GENERAL.DB_QUICK_CREATE));
                                }}
                                children={<DsTypography variant="Semibold_14">{GENERAL.DB_QUICK_CREATE}</DsTypography>}
                                className={styles.radio}
                            />
                            <DsTypography variant="Regular_14" className={styles.failoverText}>
                                {GENERAL.QUICK_DB_CREATE_CONTENT}
                            </DsTypography>
                        </div>
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={selectedConfigNewUser === GENERAL.DB_ADVANCED_CREATE}
                                onChange={() => {
                                    dispatch(setSelectedNewUserConfig(GENERAL.DB_ADVANCED_CREATE));
                                }}
                                children={
                                    <DsTypography variant="Semibold_14">{GENERAL.DB_ADVANCED_CREATE}</DsTypography>
                                }
                                className={styles.radio}
                            />
                            <DsTypography variant="Regular_14" className={styles.failoverText}>
                                {GENERAL.ADVANCED_DB_CREATE_CONTENT}
                            </DsTypography>
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FileSettingsMode;
