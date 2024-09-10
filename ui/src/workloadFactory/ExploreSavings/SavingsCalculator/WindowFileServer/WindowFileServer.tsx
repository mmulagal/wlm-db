import { DsTypography } from '@netapp/design-system';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import styles from './WindowFileServer.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const WindowFileServer = () => {
    const dataValue = [
        {
            label: 'Deployment type',
            value: 'Single AZ'
        },
        {
            label: 'Total storage amount',
            value: '250.5 TiB'
        },
        {
            label: 'Total provisioned IOPS',
            value: '60,000'
        },
        {
            label: 'Total throughput MB/s',
            value: '3,000'
        }
    ];
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

            {dataValue.map((data: any, index: number) => (
                <ComparisonTableLayout key={index} data={data} calculatedResponse={true} />
            ))}
        </div>
    );
};

export default WindowFileServer;
