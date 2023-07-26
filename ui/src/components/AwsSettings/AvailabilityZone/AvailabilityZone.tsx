import { useMemo, useState } from 'react';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './AvailabilityZone.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const AvailabilityZone = () => {
    const [zone1, setZone1] = useState('');
    const [subNet1, setSubnet1] = useState<string | any>('');
    const [zone2, setZone2] = useState('');
    const [subNet2, setSubnet2] = useState<string | any>('');

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
        if (!zone1 || !zone2 || !subNet1 || !subNet2) {
            return <ActionRequired />;
        } else {
            return (
                <div className={CommonStyles.setHeaderStyle}>
                    <div className={CommonStyles.regular}>
                        Node 1:{zone1} ({subNet1.label})
                    </div>
                    <div className={CommonStyles.separator} />
                    <div className={CommonStyles.regular}>
                        Node 2:{zone2} ({subNet2.label})
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
                                value={zone1 ? generateOptionType(zone1, zone1, '', false, '') : undefined}
                                onChange={(selectedOptions: any): void => {
                                    setZone1(selectedOptions.label);
                                }}
                                isSearchable={generateZones.length > 5}
                                options={generateZones}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                isClearable={false}
                                value={
                                    subNet1
                                        ? generateOptionType(subNet1.value, subNet1.label, subNet1.label2, false, '')
                                        : undefined
                                }
                                onChange={(selectedOptions: any): void => {
                                    setSubnet1(selectedOptions);
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
                                value={zone2 ? generateOptionType(zone2, zone2, '', false, '') : undefined}
                                onChange={(selectedOptions: any): void => {
                                    setZone2(selectedOptions.label);
                                }}
                                isSearchable={generateZones.length > 5}
                                options={generateZones}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                isClearable={false}
                                value={
                                    subNet2
                                        ? generateOptionType(subNet2.value, subNet2.label, subNet2.label2, false, '')
                                        : undefined
                                }
                                onChange={(selectedOptions: any): void => {
                                    setSubnet2(selectedOptions);
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
