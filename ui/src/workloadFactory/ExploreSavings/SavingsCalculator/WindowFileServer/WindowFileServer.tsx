import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import styles from './WindowFileServer.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { getAzType } from '../../../../utils/utilityFunctions';

const WindowFileServer = () => {
    const { selectedHostDetails, viewCalculationsResponse, viewCalculationsLoading } = useAppSelector(
        state => state.exploreSavings
    );
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        let deploymentType = '';
        for (const instance of selectedHostDetails?.sqlServerInstances || []) {
            for (const deployment of instance?.deploymentTypes || []) {
                if (deployment?.type) {
                    deploymentType = deployment?.type;
                    break;
                }
            }
            if (deploymentType) {
                break;
            }
        }
        const deploymentTypeText = getAzType(deploymentType) || GENERAL.NOT_AVAILABLE;
        const dataValue = [
            {
                label: 'Deployment type',
                value: deploymentTypeText
            },
            {
                label: 'Total storage amount',
                value: viewCalculationsResponse?.fsxwCalculation?.desiredStorageCapacity || GENERAL.NOT_AVAILABLE,
                loading: viewCalculationsLoading
            },
            {
                label: 'Total provisioned IOPS',
                value: viewCalculationsResponse?.fsxwCalculation?.sumOfDefaultAndAdditionalProvisionedIops
                    ? `${viewCalculationsResponse?.fsxwCalculation?.sumOfDefaultAndAdditionalProvisionedIops} IOPS`
                    : GENERAL.NOT_AVAILABLE,
                loading: viewCalculationsLoading
            },
            {
                label: 'Total throughput',
                value: viewCalculationsResponse?.fsxwCalculation?.provisionedThroughputCapacity
                    ? `${viewCalculationsResponse?.fsxwCalculation?.provisionedThroughputCapacity} MB/s`
                    : GENERAL.NOT_AVAILABLE,
                loading: viewCalculationsLoading
            }
        ];
        setTableData(dataValue);
    }, [selectedHostDetails, viewCalculationsLoading, viewCalculationsResponse]);

    const ComparisonTableLayout = ({ data, calculatedResponse }: any) => (
        <div className={styles['comparison-table-column']} style={{ backgroundColor: 'var(--main-background)' }}>
            <Grid>
                <GridItem lg="4">
                    <Text
                        color={!calculatedResponse && 'text-disabled'}
                        level="13"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {data?.label}
                    </Text>
                </GridItem>
                <GridItem lg="4">
                    {data?.loading && (
                        <div className={styles.loading}>
                            <DsFlashingDotsLoader />
                        </div>
                    )}
                    {!data?.loading && <Text style={{ paddingLeft: 10 }}>{data?.value}</Text>}
                </GridItem>
            </Grid>
        </div>
    );
    return (
        <div className={styles.winServer}>
            <DsTypography variant="Regular_14" className={styles.head}>
                {GENERAL.WINDOW_FILE_SERVER_DETAILS}
            </DsTypography>

            {tableData.map((data: any, index: number) => (
                <ComparisonTableLayout key={index} data={data} calculatedResponse />
            ))}
        </div>
    );
};

export default WindowFileServer;
