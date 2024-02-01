import { AccordionCard, AccordionCardContent, ToggleSelector, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './SimpleNotificationService.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useMemo, useEffect } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSNSARN, setSNSState } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const SimpleNotificationService = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const { snsData, snsLoading } = useAppSelector(state => state.mssql.getSnsList);
    const selectedState = useAppSelector(state => state.mssqlForm.simpleNotification.snsState);
    const selectedARNValue = useAppSelector(state => state.mssqlForm.simpleNotification.snsARN);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    //Set the Header text here
    const setHeader = () => {
        if (!selectedState) {
            return <Typography variant="Regular_14">Disabled</Typography>;
        } else {
            return (
                <div className={CommonStyles.setHeaderStyle}>
                    <div>Enabled</div>
                    <div className={CommonStyles.separator} />
                    <div className={styles.headingValue} title={selectedARNValue?.label}>
                        {selectedARNValue?.label}
                    </div>
                </div>
            );
        }
    };

    const handleChange = () => {
        dispatch(setSNSState(!selectedState));
        dispatch(setIsWizardTouched(true));
    };

    //Function to generate the options for Select Field
    const generateArn = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        snsData?.topics?.map((val, idx: number) => {
            const arnVal = val?.topicArn;
            const option = generateOptionType(arnVal, arnVal, '', false, '');
            options.push(option);
        });
        return options;
    }, [snsData]);

    //Update selected SNS Topic in form data store
    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSNSARN(null));
        }
    }, [dispatch, generateArn]);

    return (
        <div className={styles.simple}>
            <AccordionCard
                isLoading={snsLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="21"
                title={<div className={CommonStyles.title}>{GENERAL.SIMPLE_NOTIFICATION_SERVICE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <ToggleSelector value={selectedState} className="" onChange={handleChange} isDisabled={false}>
                            {GENERAL.SNS}
                        </ToggleSelector>
                        <Typography variant="Regular_14" className={styles.subText}>
                            {GENERAL.SNS_TEXT}
                        </Typography>

                        <div className={styles.selectField}>
                            <SelectField
                                label={GENERAL.ARN}
                                isClearable={false}
                                placeholder="Select an ARN"
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSNSARN(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateArn.length > 5}
                                options={generateArn}
                                isDisabled={!selectedState}
                                value={selectedARNValue ? selectedARNValue : undefined}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SimpleNotificationService;
