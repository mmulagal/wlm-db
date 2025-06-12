import { AccordionCard, AccordionCardContent, ToggleSelector, Typography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './CloudWatch.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { setCloudWatch } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { DBType, WIZARD_TYPE } from '../../../../utils/consts';

type CloudWatchProps = {
    wizardType?: string;
};

const CloudWatch = ({ wizardType }: CloudWatchProps) => {
    const dispatch = useDispatch();

    const toggle = useAppSelector(state => state.mssqlForm.cloudWatch);
    const databaseType = useAppSelector(state => state.postgreForm.selectedDatabaseType);
    const { isDemoMode } = useAppSelector(state => state.auth);
    // Set the Header text here
    const setHeader = () => <Typography variant="Regular_14">{toggle ? 'Enabled' : 'Disabled'}</Typography>;

    const handleChange = () => {
        dispatch(setCloudWatch(!toggle));
        dispatch(setIsWizardTouched(true));
    };

    return (
        <div className={styles.cloud}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="22"
                title={<div className={CommonStyles.title}>{GENERAL.CLOUD_WATCH_MONITORING}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <ToggleSelector value={toggle} className="" onChange={handleChange} isDisabled={false}>
                            {GENERAL.CLOUD_WATCH_MONITORING}
                        </ToggleSelector>
                        <Typography variant="Regular_14" className={styles.subText}>
                            {databaseType === DBType.MSSQL ? GENERAL.CLOUD_WATCH_TEXT : GENERAL.CLOUD_WATCH_TEXT_PGSQL}
                        </Typography>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default CloudWatch;
