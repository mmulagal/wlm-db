import { AccordionCard, AccordionCardContent, ToggleSelector, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';

import styles from './SnapshotPolicy.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSnapshotPolicyToggle } from '../../../../store/mssql/mssqlFormSlice';

import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const SnapshotPolicy = () => {
    const dispatch = useDispatch();

    //Getting the Data from state

    const snapshotPolicyToggle = useAppSelector(state => state.mssqlForm.snapshotPolicyToggle);

    const handleChange = () => {
        dispatch(setSnapshotPolicyToggle(!snapshotPolicyToggle));
        dispatch(setIsWizardTouched(true));
    };

    //Set the Header text here
    const setHeader = () => {
        if (snapshotPolicyToggle) {
            return (
                <Typography variant="Regular_14" className={`${CommonStyles.setHeaderStyle} `}>
                    <div>{GENERAL.DAILY_SNAPSHOT}</div>
                    <div className={CommonStyles.separator} />
                    <div>{GENERAL.RETENTION_SEVEN_DAYS}</div>
                </Typography>
            );
        } else {
            return (
                <Typography variant="Regular_14" className={`${CommonStyles.setHeaderStyle} `}>
                    {GENERAL.NONE}
                </Typography>
            );
        }
    };
    return (
        <div className={styles['snapshotPolicy']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="27"
                title={<div className={CommonStyles.title}>{GENERAL.SNAPSHOT_POLICY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleToggle}>
                            <ToggleSelector
                                value={snapshotPolicyToggle}
                                className=""
                                onChange={handleChange}
                                isDisabled={false}
                            >
                                {GENERAL.SNAPSHOT_POLICY}
                            </ToggleSelector>
                        </div>
                        <Typography
                            variant="Regular_14"
                            className={`${CommonStyles.setHeaderStyle} ${styles.textArea}`}
                        >
                            <div>{GENERAL.DAILY_SNAPSHOT}</div>
                            <div className={CommonStyles.separator} />
                            <div>{GENERAL.RETENTION_SEVEN_DAYS}</div>
                        </Typography>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SnapshotPolicy;
