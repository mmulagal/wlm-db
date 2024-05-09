import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './OperatingSystem.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedOperatingSystem } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { FORM_OPTIONS } from '../../../../utils/consts';

const OperatingSystem = () => {
    const dispatch = useDispatch();

    // To get selected OS
    const osVersion = useAppSelector(state => state.mssqlForm.operatingSystem);
    const customAMISelected = useAppSelector(state => state.mssqlForm.license.selectedLicenseType);

    //Set the Header text here
    const setHeader = () => {
        if (customAMISelected === FORM_OPTIONS.CUSTOM_AMI) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.CUSTOM_AMI_DISABLE_MSG}
                </Typography>
            );
        }
        return <Typography variant="Regular_14">{osVersion?.label}</Typography>;
    };
    return (
        <div className={styles['operating-system']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="5"
                title={<div className={CommonStyles.title}>{GENERAL.OPERATING_SYSTEM}</div>}
                isDisabled={customAMISelected === FORM_OPTIONS.CUSTOM_AMI}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.text}>{GENERAL.OP_SYS_TEXT}</div>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={osVersion?.label === GENERAL.WIN_SERVER_2016}
                                onChange={() => {
                                    dispatch(setIsWizardTouched(true));
                                    dispatch(
                                        setSelectedOperatingSystem({
                                            label: GENERAL.WIN_SERVER_2016,
                                            value: GENERAL.WIN_SERVER_2016_VERSION
                                        })
                                    );
                                }}
                                children={GENERAL.WIN_SERVER_2016}
                                className=""
                            />
                            <RadioButton
                                isChecked={osVersion?.label === GENERAL.WIN_SERVER_2019}
                                onChange={() => {
                                    dispatch(
                                        setSelectedOperatingSystem({
                                            label: GENERAL.WIN_SERVER_2019,
                                            value: GENERAL.WIN_SERVER_2019_VERSION
                                        })
                                    );
                                }}
                                children={GENERAL.WIN_SERVER_2019}
                                className=""
                            />
                            <RadioButton
                                isChecked={osVersion?.label === GENERAL.WIN_SERVER_2022}
                                onChange={() => {
                                    dispatch(
                                        setSelectedOperatingSystem({
                                            label: GENERAL.WIN_SERVER_2022,
                                            value: GENERAL.WIN_SERVER_2022_VERSION
                                        })
                                    );
                                }}
                                children={GENERAL.WIN_SERVER_2022}
                                className=""
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default OperatingSystem;
