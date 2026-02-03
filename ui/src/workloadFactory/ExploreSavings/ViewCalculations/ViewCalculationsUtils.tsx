import { Grid, GridItem } from '../../../ui-components/Layout/Grid';
import { Text } from '../../../ui-components/Typography';

export const TableLayout = ({ data }: any) => {
    const styleHandler = (data: any) => {
        if (
            data.label === 'EC2 machine total cost' ||
            data.label === 'EC2 machines total cost' ||
            data.label === 'Single availability zone total monthly cost' ||
            data.label === 'Multi availability zone total monthly cost' ||
            data.label === 'Total clones monthly cost' ||
            data.label === 'Total EC2 machines cost' ||
            data.label === 'EBS total cost' ||
            data.label === 'Total snapshots cost' ||
            data.label === 'Shadow copies total monthly cost'
        ) {
            return {
                backgroundColor: 'var(--table-header-background)',
                height: 64,
                fontWeight: 490,
                marginBottom: 3,
                marginTop: 14
            };
        }
        if (
            data.label === 'Single Availability Zone total monthly cost' ||
            data.label === 'Multi Availability Zone total monthly cost'
        ) {
            return {
                backgroundColor: 'var(--table-header-background)',
                height: 130,
                fontWeight: 490,
                marginBottom: 3,
                marginTop: 14,
                paddingTop: 20
            };
        }
        if (
            data.label === 'Total snapshot monthly cost' ||
            data.label === 'Clones total monthly cost' ||
            data.label === 'Total monthly cost'
        ) {
            return {
                backgroundColor: 'var(--table-header-background)',
                height: 92,
                fontWeight: 490,
                marginBottom: 3,
                marginTop: 10,
                paddingTop: 15
            };
        }
        return { backgroundColor: 'var(--main-background)', minHeight: 'auto', height: 'auto', marginBottom: 2 };
    };
    return (
        <Grid style={styleHandler(data)}>
            <GridItem lg="4">
                <Text bold={!data.value && true} style={data.mainHeading ? { fontSize: 16 } : { fontSize: 14 }}>
                    {data.label}
                </Text>
            </GridItem>
            <GridItem lg="3">
                <Text>{data.value}</Text>
            </GridItem>
            <GridItem lg="5">
                {data?.label === 'Total monthly cost' ||
                data?.label === 'Total snapshot monthly cost' ||
                data?.label === 'Clones total monthly cost' ? (
                    <Text style={{ margin: '0', padding: '0' }}>{data.text}</Text>
                ) : (
                    <Text>{data.text}</Text>
                )}
            </GridItem>
        </Grid>
    );
};
