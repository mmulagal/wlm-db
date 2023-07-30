import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './SecurityGroup.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedExistingSecurityGroup, setSelectedSecurityGroup } from '../../../store/mssql/mssqlFormSlice';

const SecurityGroup = () => {
    const dispatch = useDispatch();
    const selectedExistingSecurityGroup = useSelector(
        (state: any) => state.mssqlForm.securityGroup.selectedExistingSecurityGroup
    );
    const [securityGroup, setSecurityGroup] = useState(GENERAL.USE_AN_EXISTING_SECURITY);
    const [optionSelected, setOptionSelected] = useState<string | any>({
        label: ''
    });

    //Mock data to be removed later
    const security = [
        { label1: 'sec-group1', value: 'sec-group1', label2: 'sg-123456' },
        { label1: 'sg1', value: 'sec-group2', label2: 'sg-123456' }
    ];

    //Function to generate the options for Select Field
    const generateExistingSecurity = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        security?.map((val, idx: number) => {
            const option = generateOptionType(val.value, val.label1, val.label2, false, '');
            options.push(option);
        });
        //To set the header value for first load
        setOptionSelected(options[0]);
        dispatch(setSelectedExistingSecurityGroup(options[0]));
        return options;
    }, []);

    //Set the Header text here
    const setHeader = () => {
        if (securityGroup === GENERAL.USE_AN_EXISTING_SECURITY) {
            return (
                <div className={styles.setHeaderStyle}>
                    <div>{GENERAL.USE_AN_EXISTING_SECURITY}</div>
                    <div className={styles.separator} />
                    <div>{optionSelected?.label}</div>
                </div>
            );
        }
        if (securityGroup === GENERAL.GENERATED_SECURITY_GROUP) {
            return <div className={styles.setHeaderStyle}>{GENERAL.GENERATED_SECURITY_GROUP}</div>;
        }
    };
    return (
        <div className={styles['security-group']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="4"
                title={<div className={CommonStyles.title}>{SELECT_CONFIG.SECURITY_GROUP}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={securityGroup === GENERAL.USE_AN_EXISTING_SECURITY}
                                onChange={() => {
                                    setSecurityGroup(GENERAL.USE_AN_EXISTING_SECURITY);
                                    dispatch(setSelectedSecurityGroup(GENERAL.USE_AN_EXISTING_SECURITY));
                                }}
                                children={GENERAL.USE_AN_EXISTING_SECURITY}
                                className=""
                            />
                            <RadioButton
                                isChecked={securityGroup === GENERAL.GENERATED_SECURITY_GROUP}
                                onChange={() => {
                                    setSecurityGroup(GENERAL.GENERATED_SECURITY_GROUP);
                                    dispatch(setSelectedSecurityGroup(GENERAL.GENERATED_SECURITY_GROUP));
                                }}
                                children={GENERAL.GENERATED_SECURITY_GROUP}
                                className=""
                            />
                        </div>
                        {securityGroup === GENERAL.USE_AN_EXISTING_SECURITY && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    label={GENERAL.EXISTING_SECURITY_GROUP}
                                    isClearable={false}
                                    defaultValue={
                                        selectedExistingSecurityGroup
                                            ? [selectedExistingSecurityGroup]
                                            : [generateExistingSecurity[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        setOptionSelected(selectedOptions);
                                        dispatch(setSelectedExistingSecurityGroup(selectedOptions));
                                    }}
                                    isSearchable={generateExistingSecurity.length > 5}
                                    options={generateExistingSecurity}
                                    variant="two-lines"
                                    className={styles.changeColor}
                                />
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};
export default SecurityGroup;
