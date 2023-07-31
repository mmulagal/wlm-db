import { AccordionCard, AccordionCardContent, ToggleSelector, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import styles from './SimpleNotificationService.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useMemo, useState } from 'react';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSNSARN, setSNSState } from '../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../store/storeHooks';

const SimpleNotificationService = () => {
    const [toggle, setToggle] = useState(false);
    const dispatch = useDispatch();
    const selectedARNValue = useAppSelector((state: any) => state.mssqlForm.simpleNotification.snsARN);
    //Set the Header text here
    const setHeader = () => {
        if (!toggle) {
            return <Typography variant="Regular_14">Disabled</Typography>;
        } else {
            return (
                <div className={CommonStyles.setHeaderStyle}>
                    <div>Enabled</div>
                    <div className={CommonStyles.separator} />
                    <div>{selectedARNValue?.label}</div>
                </div>
            );
        }
    };

    const handleChange = () => {
        setToggle(prev => !prev);
        dispatch(setSNSState(!toggle));
    };

    const versions = ['val1', 'val2'];

    //Function to generate the options for Select Field
    const generateArn = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    return (
        <div className={styles.simple}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="21"
                title={<div className={CommonStyles.title}>{GENERAL.SIMPLE_NOTIFICATION_SERVICE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <ToggleSelector value={toggle} className="" onChange={handleChange} isDisabled={false}>
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
                                }}
                                isSearchable={generateArn.length > 5}
                                options={generateArn}
                                isDisabled={!toggle}
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
