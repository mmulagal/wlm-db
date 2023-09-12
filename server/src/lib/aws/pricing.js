/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing'; // ES Modules import
// import { ImagebuilderClient, GetImageCommand } from '@aws-sdk/client-imagebuilder'; // ES Modules import
// import { DescribeFileSystemsCommand, FSxClient } from '@aws-sdk/client-fsx';

// const credentials = {
//     accessKeyId: 'ASIAWYGBM3V5VO3Q5X6M',
//     secretAccessKey: 'zoc/kWJbwoN6mMN4jJw68DT0jZ2wuf4H3oWuQ/C8',
//     sessionToken: 'IQoJb3JpZ2luX2VjEK7//////////wEaCXVzLWVhc3QtMSJIMEYCIQCzUp76aB1VlDN5Za+ACkfol/Gybl4MibN7IlekOGww1QIhAJ4B0B6GBb4YdFnj1XsXo2w78XqqKO6oDS/ua5JDzx4/Ko4DCIf//////////wEQABoMNDY0MjYyMDYxNDM1IgxN51kdoxT8LibadTIq4gL/lC3HVk089U7RQsxQCWhH0rSoNBJrWXyi3OwvQoutZv7mZrEh02ZQ05tPRm+5zzLrEStzfm4Fp4FaCFYF/Aq6h595BoCPr6kuxW6RAC/QGny0+Qg/i5IBA4FcprZ56mqwcsOMP34v/rHnwZUGpenVtlgER87zcc016DGyKlxADQssM9brLmmwrS4H7jhUu/vVFmWZh1NiMOKQHHntFxgzQ1HhyAPVYqbbfGl7vxEvHQAaM1XjCqtXzEgmXat1UDX+I60MnnihrXvoJN2cZ8ifh3OvDm8XeX3uJ4cCZ9jn6Hv8vipDKtxkmv5tfXtQ5abQM8wtbXs8fM1MUiD/1L2qWa4vcFQWkg+jFO6MSh7r1CHr15tqg/cP8ErmqN6pdJFNWggvi8JCmnkpCeIt3GVAcTQodQXrp+CbVxRg/GrR2VqHSPzIbjM9lfpKILOhT+JU+kek5sp5ELg3zbeRXAYGdNQw38TlpwY6pQEpRDZ6YOYvnGcVCGFcmIx4TuSnArRhgQcbujePxqq42VAqODT95pPWmT+qx2tMcK1qzycfxbYtnkrai/2lOu4pW/XipNiSDC3HB2mDegqnq2r/j9OzShee5Mce0Lj5XjjVZ3uXilCNdoRpgS6lzgxyfgr+t9KIas34cW7ECntddW1SokO7MKuCOGvA2ebdFxAtUwAgppHm6u35AIguDDfhimCAHwU='
// };

function calculatePrice(unit, rate, quantity, instanceCount = 1) {
    // logger.info('Calculating price');
    switch(unit) {
        case 'Hrs':
            return HOURS_IN_MONTH * Number(rate) * instanceCount;
        case 'GB-Mo':
        case 'IOPS-Mo':
            return Number(quantity) * Number(rate) * instanceCount;
        default:
            // logger.warn('Unknown unit');
    }
}

const client = new PricingClient();
const HOURS_IN_MONTH = 730;

// const ec2input = {
//     ServiceCode: 'AmazonEC2',
//     Filters: [
//         {
//             Type: 'TERM_MATCH',
//             Field: 'instanceType',
//             Value: 'm4.xlarge', // get as parameter
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'operatingSystem',
//             Value: 'windows',
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'preInstalledSw',
//             Value: 'SQL std', // get as parameter [std, ent, or web]
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'regionCode',
//             Value: 'us-east-1', // get it as parameter
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'tenancy',
//             Value: 'Shared', // default Shared for now
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'CapacityStatus',
//             Value: 'Used', // On-demand
//         }
//     ],
//     FormatVersion: 'aws_v1'
// };

// const ebsinput = {
//     ServiceCode: 'AmazonEC2',
//     Filters: [
//         {
//             Type: 'TERM_MATCH',
//             Field: 'productFamily',
//             Value: 'Storage'
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'regionCode',
//             Value: 'us-east-1'
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'volumeType',
//             Value: 'General Purpose'
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'volumeApiName',
//             Value: 'gp2'
//         },
//     ],
//     FormatVersion: 'aws_v1'
// };
// const fsxInput = {
//     ServiceCode: 'AmazonFSx',
//     Filters: [
//         {
//             Type: 'TERM_MATCH',
//             Field: 'productFamily',
//             Value: 'storage',
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'regionCode',
//             Value: 'us-east-1',
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'fileSystemType',
//             Value: 'ONTAP',
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'StorageType',
//             Value: 'SSD',
//         },
//         {
//             Type: 'TERM_MATCH',
//             Field: 'deploymentOption',
//             Value: 'Multi-AZ',
//         }
//     ]
// };
const fsxInput = {
    ServiceCode: 'AmazonFSx',
    Filters: [
        {
            Type: 'TERM_MATCH',
            Field: 'productFamily',
            Value: 'Provisioned Throughput',
        },
        {
            Type: 'TERM_MATCH',
            Field: 'regionCode',
            Value: 'us-east-1',
        },
        {
            Type: 'TERM_MATCH',
            Field: 'fileSystemType',
            Value: 'ONTAP',
        },
        {
            Type: 'TERM_MATCH',
            Field: 'deploymentOption',
            Value: 'Single-AZ_2N',
        }
    ]
};
const command = new GetProductsCommand(fsxInput);
const response = await client.send(command);
const serialzedResponses = response.PriceList?.map(k => k?.deserializeJSON()) || [];

console.log(JSON.stringify(serialzedResponses, null, 2));
const [serialzedResponse] = response.PriceList?.map(k => k?.deserializeJSON()) || [];

const { OnDemand } = serialzedResponse?.terms || {};
const [{ priceDimensions } = {}] = Object.values(OnDemand) || [];
const [{ unit, pricePerUnit: { USD: rate } } = {}] = Object.values(priceDimensions) || [];

const price = calculatePrice(unit, rate);

console.log(unit, rate, price);

// const { ImagebuilderClient, GetImageCommand } = require("@aws-sdk/client-imagebuilder"); // CommonJS import
// const client = new ImagebuilderClient({ credentials });
// const input = { // GetImageRequest
//     imageBuildVersionArn: 'ami-0776c29a278d08106',
// };
// const command = new GetImageCommand(input);
// const response = await client.send(command);
// console.log(response);

// const fsxClient = new FSxClient({ credentials });
// const input = { // DescribeFileSystemsRequest
//     FileSystemIds: [ // FileSystemIds
//         'fs-0d673008aaca12bc3',
//     ],
//     // MaxResults: Number('int'),
//     // NextToken: 'STRING_VALUE',
// };
// const fsxcommand = new DescribeFileSystemsCommand(input);
// const fsxresponse = await fsxClient.send(fsxcommand);

// console.log(JSON.stringify(fsxresponse, null, 2));