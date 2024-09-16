import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import styles from './WindowFileServer.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { getAzType } from '../../../../utils/utilityFunctions';

const WindowFileServer = () => {
    const { selectedHostDetails, viewCalculationsResponse, viewCalculationsLoading } = useAppSelector(
        state => state.exploreSavings
    );
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        const deploymentType = selectedHostDetails?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
        const deploymentTypeText = getAzType(deploymentType) || GENERAL.NOT_AVAILABLE;
        const dataValue = [
            {
                label: 'Deployment type',
                value: deploymentTypeText
            },
            {
                label: 'Total storage amount',
                value: selectedHostDetails?.allocatedCapacityText || GENERAL.NOT_AVAILABLE,
                loading: selectedHostDetails?.loading
            },
            {
                label: 'Total provisioned IOPS',
                value:
                    viewCalculationsResponse?.fsxwCalculation?.sumOfDefaultAndAdditionalProvisionedIops ||
                    GENERAL.NOT_AVAILABLE,
                loading: viewCalculationsLoading
            },
            {
                label: 'Total throughput MB/s',
                value:
                    viewCalculationsResponse?.fsxwCalculation?.provisionedThroughputCapacity || GENERAL.NOT_AVAILABLE,
                loading: viewCalculationsLoading
            }
        ];
        setTableData(dataValue);
    }, [selectedHostDetails, viewCalculationsLoading, viewCalculationsResponse]);

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
