import { DsTypography } from '@netapp/design-system';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import styles from './WindowFileServer.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { FSX_DEPLOYMENT_MODE } from '../../../../utils/consts';

const WindowFileServer = () => {
    const { selectedHostDetails } = useAppSelector(state => state.exploreSavings);
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        console.log(selectedHostDetails);
        const deploymentType = selectedHostDetails?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
        const deploymentTypeText =
            deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                ? GENERAL.SINGLE_AZ
                : deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                ? GENERAL.MULTI_AZ
                : GENERAL.NOT_AVAILABLE;
        const dataValue = [
            {
                label: 'Deployment type',
                value: deploymentTypeText
            },
            {
                label: 'Total storage amount',
                value: selectedHostDetails?.allocatedCapacityText || GENERAL.NOT_AVAILABLE
            },
            {
                label: 'Total provisioned IOPS',
                value: '60,000' // ToDo - get from storage savings
            },
            {
                label: 'Total throughput MB/s',
                value: '3,000' // ToDo - get from storage savings
            }
        ];
        setTableData(dataValue);
    }, [selectedHostDetails]);

    const ComparisonTableLayout = ({ data, calculatedResponse }: any) => {
        return (
            <div className={styles['comparison-table-column']} style={{ backgroundColor: 'var(--main-background)' }}>
                <Grid>
                    <GridItem lg="4">
                        <Text
                            color={!calculatedResponse && 'text-disabled'}
                            level={'13'}
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {data?.label}
                        </Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>{data?.value}</Text>
                    </GridItem>
                </Grid>
            </div>
        );
    };
    return (
        <div className={styles.winServer}>
            <DsTypography variant="Regular_14" className={styles.head}>
                {GENERAL.WINDOW_FILE_SERVER_DETAILS}
            </DsTypography>

            {tableData.map((data: any, index: number) => (
                <ComparisonTableLayout key={index} data={data} calculatedResponse={true} />
            ))}
        </div>
    );
};

export default WindowFileServer;
