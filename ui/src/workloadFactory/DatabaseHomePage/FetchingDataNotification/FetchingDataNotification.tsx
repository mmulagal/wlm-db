import ProgressLoader from '../../../common/ProgressLoader/ProgressLoader';
import { Text, Heading } from '../../../ui-components/Typography';
import { Grid, GridItem } from '../../../ui-components/Layout/Grid';
import { padEnd } from 'lodash';

const FetchingDataNotification = ({
    pendingQueriesCounter,
    pendingQueriesLength,
    queriesLength,
    regions,
    credentials
}: {
    pendingQueriesCounter: number;
    pendingQueriesLength: number;
    queriesLength: number;
    regions?: { value: string; label: string }[];
    credentials?: { value: string; label: string }[];
}) => {
    const pendingDiff = pendingQueriesCounter - pendingQueriesLength;
    const pendingIndex = queriesLength - pendingQueriesLength;
    return (
        <div
            style={{
                width: '42%',
                position: 'absolute',
                bottom: 100,
                left: '25%',
                backgroundColor: 'var(--hover-background)',
                zIndex: 10001
            }}
        >
            <Grid style={{ padding: '16px 40px', boxShadow: '2px 2px 6px 0px var(--drop-shadow)', margin: 0 }}>
                <GridItem lg={8}>
                    {/* @ts-ignore */}
                    <Heading level={4}>Scanning database hosts and instances.</Heading>
                    {/* <Text>{credentials[Math.floor(pendingIndex/regions.length)]?.name} / {regions[Math.floor(pendingIndex/credentials.length)]?.label}</Text> */}
                    <Text style={{ padding: '0', margin: '0' }}>Credentails / US East (N. Virginia) | us-east-1</Text>
                </GridItem>
                <GridItem lg={4}>
                    <ProgressLoader style={{ marginTop: 16 }} percent={(pendingDiff / pendingQueriesCounter) * 100} />
                </GridItem>
            </Grid>
        </div>
    );
};

export default FetchingDataNotification;
