import { useMemo } from 'react';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './AvailabilityZone.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setSelectedAzNode1,
    setSelectedAzNode2,
    setSelectedSubnetNode1,
    setSelectedSubnetNode2
} from '../../../store/mssql/mssqlFormSlice';

const AvailabilityZone = () => {
    const dispatch = useDispatch();
    const selectedZone1 = useAppSelector((state: any) => state.mssqlForm.availabilityZones.selectedAzNode1);
    const selectedZone2 = useAppSelector((state: any) => state.mssqlForm.availabilityZones.selectedAzNode2);
    const selectedSubnet1 = useAppSelector((state: any) => state.mssqlForm.availabilityZones.selectedSubnetNode1);
    const selectedSubnet2 = useAppSelector((state: any) => state.mssqlForm.availabilityZones.selectedSubnetNode2);
    const isAZNotFilled = useAppSelector(state => state.msSqlAction.availabilityZoneSelected);

    //Function to generate the options for Select Field for Zones
    const zones = ['us-east-1a', 'us-east-1b'];
    const generateZones = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        zones?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //Subnet related code
    const subnets = [
        { label1: '10.0.1.0/24', value: '10.0.1.0/24', label2: 'subnet-demo-a' },
        { label1: '10.0.1.1/24', value: '10.0.1.1/24', label2: 'subnet-demo-b' }
    ];

    //Function to generate the options for Select Field
    const generateSubnetOptions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        subnets?.map((val, idx: number) => {
            const option = generateOptionType(val.value, val.label1, val.label2, false, '');
            options.push(option);
        });

        return options;
    }, []);

    //Set the Header text here
    const setHeader = () => {
        if (!selectedZone1?.label || !selectedZone2?.label || !selectedSubnet1?.label || !selectedSubnet2?.label) {
            return <ActionRequired error={!isAZNotFilled ? true : false} />;
        } else {
            return (
                <div className={CommonStyles.setHeaderStyle}>
                    <div className={CommonStyles.regular}>
                        Node 1:{selectedZone1?.label} ({selectedSubnet1?.label})
                    </div>
                    <div className={CommonStyles.separator} />
                    <div className={CommonStyles.regular}>
                        Node 2:{selectedZone2?.label} ({selectedSubnet2?.label})
                    </div>
                </div>
            );
        }
    };
    return (
        <div className={styles['availability-zone']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="3"
                title={<div className={CommonStyles.title}>Availability zones</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14" className={styles.subText}>
                            {GENERAL.AZ_TEXT}
                        </Typography>

                        <div className={styles.firstContainer}>
                            <Typography variant="Regular_14">{GENERAL.CLUSTER_CONFIG_NODE_1}</Typography>
                            <SelectField
                                label={GENERAL.AZ_Zone}
                                placeholder="Select an availability zone"
                                isClearable={false}
                                value={selectedZone1 ? selectedZone1 : undefined}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedAzNode1(selectedOptions));
                                }}
                                error={!isAZNotFilled && !selectedZone1 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                isSearchable={generateZones.length > 5}
                                options={generateZones}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                isClearable={false}
                                error={!isAZNotFilled && !selectedSubnet1 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                value={selectedSubnet1 ? selectedSubnet1 : undefined}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedSubnetNode1(selectedOptions));
                                }}
                                isSearchable={generateSubnetOptions.length > 5}
                                options={generateSubnetOptions}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>

                        <div className={styles.firstContainer}>
                            <Typography variant="Regular_14">{GENERAL.CLUSTER_CONFIG_NODE_2}</Typography>
                            <SelectField
                                label={GENERAL.AZ_Zone}
                                placeholder="Select an availability zone"
                                isClearable={false}
                                value={selectedZone2 ? selectedZone2 : undefined}
                                error={!isAZNotFilled && !selectedZone2 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedAzNode2(selectedOptions));
                                }}
                                isSearchable={generateZones.length > 5}
                                options={generateZones}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                isClearable={false}
                                value={selectedSubnet2 ? selectedSubnet2 : undefined}
                                error={!isAZNotFilled && !selectedSubnet2 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedSubnetNode2(selectedOptions));
                                }}
                                isSearchable={generateSubnetOptions.length > 5}
                                options={generateSubnetOptions}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};
export default AvailabilityZone;
