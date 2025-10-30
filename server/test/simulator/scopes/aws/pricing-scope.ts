import { PricingClient, GetProductsCommand, GetProductsCommandInput, FilterType } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { mockClient } from 'aws-sdk-client-mock';

const pricingMock = mockClient(PricingClient);

const ec2InstancePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Compute Instance", "attributes": {"servicecode": "AmazonEC2","instanceType": "m5.xlarge","location": "US East (N. Virginia)","memory": "1 GiB","vcpu": "2"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.192"}}}}}}}'
);

const ec2StoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.08"}}}}}}}'
);
const vpcStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"attributes": {"servicecode": "AmazonVPC","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.08"}}}}}}}'
);

const ebsStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);

const ebsIopsPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "System Operation", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);

const ebsThroughputPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned Throughput", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);
const fsxnStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.25"}}}}}}}'
);

const fsxnIopsPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned IOPS", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.034"}}}}}}}'
);

const fsxnReadPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Request", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ","fileSystemType": "ONTAP", "requestType": "Read"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.0000004"}}}}}}}'
);

const fsxnWritePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Request", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP", "requestType": "Write"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.000005"}}}}}}}'
);

const fsxnThroughputPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned Throughput", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP", "requestType": "Write"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "1.20"}}}}}}}'
);

const sqlInstancePrice1: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"enhancedNetworkingSupported":"Yes","intelTurboAvailable":"Yes","memory":"8 GiB","dedicatedEbsThroughput":"Up to 10000 Mbps","vcpu":"2","classicnetworkingsupport":"false","capacitystatus":"Used","locationType":"AWS Region","storage":"EBS only","instanceFamily":"General purpose","operatingSystem":"Windows","intelAvx2Available":"Yes","regionCode":"us - east - 1","physicalProcessor":"Intel Xeon Scalable(Sapphire Rapids)","clockSpeed":"3.5 GHz","ecu":"NA","networkPerformance":"Up to 12500 Megabit","servicename":"Amazon Elastic Compute Cloud","gpuMemory":"NA","vpcnetworkingsupport":"true","instanceType":"m7i-flex.large","tenancy":"Shared","usagetype":"BoxUsage: m7i- flex.large","normalizationSizeFactor":"4","intelAvxAvailable":"Yes","processorFeatures":"Intel AVX; Intel AVX2; Intel AVX512; Intel Turbo; Intel AMX","servicecode":"AmazonEC2","licenseModel":"Bring your own license","currentGeneration":"Yes","preInstalledSw":"NA","location":"US East(N.Virginia)","processorArchitecture":"64 - bit","marketoption":"OnDemand","operation":"RunInstances: 0800","availabilityzone":"NA"},"sku":"85GJDFZQJ9EFABJT"},"serviceCode":"AmazonEC2","terms":{"OnDemand":{"85GJDFZQJ9EFABJT.JRTCKXETXF":{"priceDimensions":{"85GJDFZQJ9EFABJT.JRTCKXETXF.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"$0.09576 per On Demand Windows BYOL m7i - flex.large Instance Hour","appliesTo":[],"rateCode":"85GJDFZQJ9EFABJT.JRTCKXETXF.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0957600000"}}},"sku":"85GJDFZQJ9EFABJT","effectiveDate":"2024-07-01T00: 00: 00Z","offerTermCode":"JRTCKXETXF","termAttributes":{}}}},"version":"20240719162807","publicationDate":"2024-07 - 19T16: 28: 07Z"}'
);
const sqlInstancePrice2: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"enhancedNetworkingSupported":"Yes","intelTurboAvailable":"Yes","memory":"8 GiB","dedicatedEbsThroughput":"Up to 10000 Mbps","vcpu":"2","classicnetworkingsupport":"false","capacitystatus":"Used","locationType":"AWS Region","storage":"EBS only","instanceFamily":"General purpose","operatingSystem":"Windows","intelAvx2Available":"Yes","regionCode":"us - east - 1","physicalProcessor":"Intel Xeon Scalable(Sapphire Rapids)","clockSpeed":"3.5 GHz","ecu":"NA","networkPerformance":"Up to 12500 Megabit","servicename":"Amazon Elastic Compute Cloud","gpuMemory":"NA","vpcnetworkingsupport":"true","instanceType":"m7i-flex.large","tenancy":"Shared","usagetype":"BoxUsage: m7i - flex.large","normalizationSizeFactor":"4","intelAvxAvailable":"Yes","processorFeatures":"Intel AVX; Intel AVX2; Intel AVX512; Intel Turbo; Intel AMX","servicecode":"AmazonEC2","licenseModel":"No License required","currentGeneration":"Yes","preInstalledSw":"SQL Std","location":"US East(N.Virginia)","processorArchitecture":"64 - bit","marketoption":"OnDemand","operation":"RunInstances: 0006","availabilityzone":"NA"},"sku":"BD53G6QBBTFEMUR5"},"serviceCode":"AmazonEC2","terms":{"OnDemand":{"BD53G6QBBTFEMUR5.JRTCKXETXF":{"priceDimensions":{"BD53G6QBBTFEMUR5.JRTCKXETXF.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"$0.66316 per On Demand Windows with SQL Std m7i - flex.large Instance Hour","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.JRTCKXETXF.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.6631600000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-07-01T00: 00: 00Z","offerTermCode":"JRTCKXETXF","termAttributes":{}}},"Reserved":{"BD53G6QBBTFEMUR5.HU7G6KETJZ":{"priceDimensions":{"BD53G6QBBTFEMUR5.HU7G6KETJZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.HU7G6KETJZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.3138600000"}},"BD53G6QBBTFEMUR5.HU7G6KETJZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.HU7G6KETJZ.2TG2D8R56U","pricePerUnit":{"USD":"2749"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"HU7G6KETJZ","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"BD53G6QBBTFEMUR5.6QCMYABX3D":{"priceDimensions":{"BD53G6QBBTFEMUR5.6QCMYABX3D.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.6QCMYABX3D.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"BD53G6QBBTFEMUR5.6QCMYABX3D.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.6QCMYABX3D.2TG2D8R56U","pricePerUnit":{"USD":"5488"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"6QCMYABX3D","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"BD53G6QBBTFEMUR5.VJWZNREJX2":{"priceDimensions":{"BD53G6QBBTFEMUR5.VJWZNREJX2.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.VJWZNREJX2.2TG2D8R56U","pricePerUnit":{"USD":"5546"}},"BD53G6QBBTFEMUR5.VJWZNREJX2.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.VJWZNREJX2.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"VJWZNREJX2","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"BD53G6QBBTFEMUR5.4NA7Y494T4":{"priceDimensions":{"BD53G6QBBTFEMUR5.4NA7Y494T4.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.4NA7Y494T4.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.6307400000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"4NA7Y494T4","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"BD53G6QBBTFEMUR5.Z2E3P23VKM":{"priceDimensions":{"BD53G6QBBTFEMUR5.Z2E3P23VKM.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.Z2E3P23VKM.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.6159600000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"Z2E3P23VKM","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"BD53G6QBBTFEMUR5.38NPMPTW36":{"priceDimensions":{"BD53G6QBBTFEMUR5.38NPMPTW36.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.38NPMPTW36.2TG2D8R56U","pricePerUnit":{"USD":"7984"}},"BD53G6QBBTFEMUR5.38NPMPTW36.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.38NPMPTW36.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.3038100000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"38NPMPTW36","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"BD53G6QBBTFEMUR5.BPH4J8HBKS":{"priceDimensions":{"BD53G6QBBTFEMUR5.BPH4J8HBKS.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.BPH4J8HBKS.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.6108400000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"BPH4J8HBKS","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"BD53G6QBBTFEMUR5.NQ3QZPMQV9":{"priceDimensions":{"BD53G6QBBTFEMUR5.NQ3QZPMQV9.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.NQ3QZPMQV9.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"BD53G6QBBTFEMUR5.NQ3QZPMQV9.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.NQ3QZPMQV9.2TG2D8R56U","pricePerUnit":{"USD":"15905"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"NQ3QZPMQV9","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"BD53G6QBBTFEMUR5.R5XV2EPZQZ":{"priceDimensions":{"BD53G6QBBTFEMUR5.R5XV2EPZQZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.R5XV2EPZQZ.2TG2D8R56U","pricePerUnit":{"USD":"8046"}},"BD53G6QBBTFEMUR5.R5XV2EPZQZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.R5XV2EPZQZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.3061800000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"R5XV2EPZQZ","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"BD53G6QBBTFEMUR5.MZU6U2429S":{"priceDimensions":{"BD53G6QBBTFEMUR5.MZU6U2429S.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.MZU6U2429S.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"BD53G6QBBTFEMUR5.MZU6U2429S.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.MZU6U2429S.2TG2D8R56U","pricePerUnit":{"USD":"16069"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"MZU6U2429S","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"BD53G6QBBTFEMUR5.7NE97W5U4E":{"priceDimensions":{"BD53G6QBBTFEMUR5.7NE97W5U4E.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.7NE97W5U4E.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.6377500000"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"7NE97W5U4E","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"BD53G6QBBTFEMUR5.CUZHX8X6JH":{"priceDimensions":{"BD53G6QBBTFEMUR5.CUZHX8X6JH.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Standard(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.CUZHX8X6JH.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.3172000000"}},"BD53G6QBBTFEMUR5.CUZHX8X6JH.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"BD53G6QBBTFEMUR5.CUZHX8X6JH.2TG2D8R56U","pricePerUnit":{"USD":"2779"}}},"sku":"BD53G6QBBTFEMUR5","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"CUZHX8X6JH","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}}}},"version":"20240719162807","publicationDate":"2024-07 - 19T16: 28: 07Z"}'
);
const sqlInstancePrice3: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"enhancedNetworkingSupported":"Yes","intelTurboAvailable":"Yes","memory":"8 GiB","dedicatedEbsThroughput":"Up to 10000 Mbps","vcpu":"2","classicnetworkingsupport":"false","capacitystatus":"Used","locationType":"AWS Region","storage":"EBS only","instanceFamily":"General purpose","operatingSystem":"Windows","intelAvx2Available":"Yes","regionCode":"us - east - 1","physicalProcessor":"Intel Xeon Scalable(Sapphire Rapids)","clockSpeed":"3.5 GHz","ecu":"NA","networkPerformance":"Up to 12500 Megabit","servicename":"Amazon Elastic Compute Cloud","gpuMemory":"NA","vpcnetworkingsupport":"true","instanceType":"m7i-flex.large","tenancy":"Shared","usagetype":"BoxUsage: m7i - flex.large","normalizationSizeFactor":"4","intelAvxAvailable":"Yes","processorFeatures":"Intel AVX; Intel AVX2; Intel AVX512; Intel Turbo; Intel AMX","servicecode":"AmazonEC2","licenseModel":"No License required","currentGeneration":"Yes","preInstalledSw":"NA","location":"US East(N.Virginia)","processorArchitecture":"64 - bit","marketoption":"OnDemand","operation":"RunInstances: 0002","availabilityzone":"NA"},"sku":"N2WYW2MVGBAJY3DY"},"serviceCode":"AmazonEC2","terms":{"OnDemand":{"N2WYW2MVGBAJY3DY.JRTCKXETXF":{"priceDimensions":{"N2WYW2MVGBAJY3DY.JRTCKXETXF.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"$0.18316 per On Demand Windows m7i - flex.large Instance Hour","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.JRTCKXETXF.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1831600000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-07-01T00: 00: 00Z","offerTermCode":"JRTCKXETXF","termAttributes":{}}},"Reserved":{"N2WYW2MVGBAJY3DY.7NE97W5U4E":{"priceDimensions":{"N2WYW2MVGBAJY3DY.7NE97W5U4E.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.7NE97W5U4E.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1577500000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"7NE97W5U4E","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"N2WYW2MVGBAJY3DY.38NPMPTW36":{"priceDimensions":{"N2WYW2MVGBAJY3DY.38NPMPTW36.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.38NPMPTW36.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0638100000"}},"N2WYW2MVGBAJY3DY.38NPMPTW36.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.38NPMPTW36.2TG2D8R56U","pricePerUnit":{"USD":"1677"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"38NPMPTW36","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"N2WYW2MVGBAJY3DY.6QCMYABX3D":{"priceDimensions":{"N2WYW2MVGBAJY3DY.6QCMYABX3D.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.6QCMYABX3D.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"N2WYW2MVGBAJY3DY.6QCMYABX3D.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.6QCMYABX3D.2TG2D8R56U","pricePerUnit":{"USD":"1284"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"6QCMYABX3D","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"N2WYW2MVGBAJY3DY.R5XV2EPZQZ":{"priceDimensions":{"N2WYW2MVGBAJY3DY.R5XV2EPZQZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.R5XV2EPZQZ.2TG2D8R56U","pricePerUnit":{"USD":"1739"}},"N2WYW2MVGBAJY3DY.R5XV2EPZQZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.R5XV2EPZQZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0661800000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"R5XV2EPZQZ","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"N2WYW2MVGBAJY3DY.BPH4J8HBKS":{"priceDimensions":{"N2WYW2MVGBAJY3DY.BPH4J8HBKS.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.BPH4J8HBKS.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1308400000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"BPH4J8HBKS","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"N2WYW2MVGBAJY3DY.NQ3QZPMQV9":{"priceDimensions":{"N2WYW2MVGBAJY3DY.NQ3QZPMQV9.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.NQ3QZPMQV9.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"N2WYW2MVGBAJY3DY.NQ3QZPMQV9.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.NQ3QZPMQV9.2TG2D8R56U","pricePerUnit":{"USD":"3291"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"NQ3QZPMQV9","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"N2WYW2MVGBAJY3DY.Z2E3P23VKM":{"priceDimensions":{"N2WYW2MVGBAJY3DY.Z2E3P23VKM.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.Z2E3P23VKM.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1359600000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"Z2E3P23VKM","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"N2WYW2MVGBAJY3DY.HU7G6KETJZ":{"priceDimensions":{"N2WYW2MVGBAJY3DY.HU7G6KETJZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.HU7G6KETJZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0738600000"}},"N2WYW2MVGBAJY3DY.HU7G6KETJZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.HU7G6KETJZ.2TG2D8R56U","pricePerUnit":{"USD":"647"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"HU7G6KETJZ","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"N2WYW2MVGBAJY3DY.4NA7Y494T4":{"priceDimensions":{"N2WYW2MVGBAJY3DY.4NA7Y494T4.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.4NA7Y494T4.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1507400000"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"4NA7Y494T4","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"N2WYW2MVGBAJY3DY.CUZHX8X6JH":{"priceDimensions":{"N2WYW2MVGBAJY3DY.CUZHX8X6JH.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.CUZHX8X6JH.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0772000000"}},"N2WYW2MVGBAJY3DY.CUZHX8X6JH.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.CUZHX8X6JH.2TG2D8R56U","pricePerUnit":{"USD":"676"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"CUZHX8X6JH","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"N2WYW2MVGBAJY3DY.VJWZNREJX2":{"priceDimensions":{"N2WYW2MVGBAJY3DY.VJWZNREJX2.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.VJWZNREJX2.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"N2WYW2MVGBAJY3DY.VJWZNREJX2.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.VJWZNREJX2.2TG2D8R56U","pricePerUnit":{"USD":"1341"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"VJWZNREJX2","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"N2WYW2MVGBAJY3DY.MZU6U2429S":{"priceDimensions":{"N2WYW2MVGBAJY3DY.MZU6U2429S.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.MZU6U2429S.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"N2WYW2MVGBAJY3DY.MZU6U2429S.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"N2WYW2MVGBAJY3DY.MZU6U2429S.2TG2D8R56U","pricePerUnit":{"USD":"3455"}}},"sku":"N2WYW2MVGBAJY3DY","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"MZU6U2429S","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}}}},"version":"20240719162807","publicationDate":"2024-07 - 19T16: 28: 07Z"}'
);
const sqlInstancePrice4: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"enhancedNetworkingSupported":"Yes","intelTurboAvailable":"Yes","memory":"8 GiB","dedicatedEbsThroughput":"Up to 10000 Mbps","vcpu":"2","classicnetworkingsupport":"false","capacitystatus":"Used","locationType":"AWS Region","storage":"EBS only","instanceFamily":"General purpose","operatingSystem":"Windows","intelAvx2Available":"Yes","regionCode":"us - east - 1","physicalProcessor":"Intel Xeon Scalable(Sapphire Rapids)","clockSpeed":"3.5 GHz","ecu":"NA","networkPerformance":"Up to 12500 Megabit","servicename":"Amazon Elastic Compute Cloud","gpuMemory":"NA","vpcnetworkingsupport":"true","instanceType":"m7i-flex.large","tenancy":"Shared","usagetype":"BoxUsage: m7i - flex.large","normalizationSizeFactor":"4","intelAvxAvailable":"Yes","processorFeatures":"Intel AVX; Intel AVX2; Intel AVX512; Intel Turbo; Intel AMX","servicecode":"AmazonEC2","licenseModel":"No License required","currentGeneration":"Yes","preInstalledSw":"SQL Web","location":"US East(N.Virginia)","processorArchitecture":"64 - bit","marketoption":"OnDemand","operation":"RunInstances: 0202","availabilityzone":"NA"},"sku":"WZEHDV2N2ZEZUGGS"},"serviceCode":"AmazonEC2","terms":{"OnDemand":{"WZEHDV2N2ZEZUGGS.JRTCKXETXF":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.JRTCKXETXF.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"$0.25076 per On Demand Windows with SQL Web m7i - flex.large Instance Hour","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.JRTCKXETXF.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2507600000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-07-01T00: 00: 00Z","offerTermCode":"JRTCKXETXF","termAttributes":{}}},"Reserved":{"WZEHDV2N2ZEZUGGS.7NE97W5U4E":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.7NE97W5U4E.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.7NE97W5U4E.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2253500000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"7NE97W5U4E","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.4NA7Y494T4":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.4NA7Y494T4.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.4NA7Y494T4.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2183400000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"4NA7Y494T4","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.MZU6U2429S":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.MZU6U2429S.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.MZU6U2429S.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.MZU6U2429S.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.MZU6U2429S.2TG2D8R56U","pricePerUnit":{"USD":"5231"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"MZU6U2429S","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.BPH4J8HBKS":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.BPH4J8HBKS.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.BPH4J8HBKS.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1984400000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"BPH4J8HBKS","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.CUZHX8X6JH":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1110000000"}},"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.2TG2D8R56U","pricePerUnit":{"USD":"972"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"CUZHX8X6JH","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.VJWZNREJX2":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.VJWZNREJX2.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.VJWZNREJX2.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.VJWZNREJX2.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.VJWZNREJX2.2TG2D8R56U","pricePerUnit":{"USD":"1933"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"VJWZNREJX2","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.2TG2D8R56U","pricePerUnit":{"USD":"2628"}},"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0999800000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"R5XV2EPZQZ","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.HU7G6KETJZ":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1076600000"}},"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.2TG2D8R56U","pricePerUnit":{"USD":"943"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"HU7G6KETJZ","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.38NPMPTW36":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.38NPMPTW36.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.38NPMPTW36.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0976100000"}},"WZEHDV2N2ZEZUGGS.38NPMPTW36.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.38NPMPTW36.2TG2D8R56U","pricePerUnit":{"USD":"2565"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"38NPMPTW36","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.6QCMYABX3D":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.6QCMYABX3D.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.6QCMYABX3D.2TG2D8R56U","pricePerUnit":{"USD":"1876"}},"WZEHDV2N2ZEZUGGS.6QCMYABX3D.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.6QCMYABX3D.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"6QCMYABX3D","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.2TG2D8R56U","pricePerUnit":{"USD":"5067"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"NQ3QZPMQV9","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.Z2E3P23VKM":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.Z2E3P23VKM.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.Z2E3P23VKM.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2035600000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"Z2E3P23VKM","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}}}},"version":"20240719162807","publicationDate":"2024-07 - 19T16: 28: 07Z"}'
);
const sqlInstancePrice5: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"enhancedNetworkingSupported":"Yes","intelTurboAvailable":"Yes","memory":"8 GiB","dedicatedEbsThroughput":"Up to 10000 Mbps","vcpu":"2","classicnetworkingsupport":"false","capacitystatus":"Used","locationType":"AWS Region","storage":"EBS only","instanceFamily":"General purpose","operatingSystem":"Windows","intelAvx2Available":"Yes","regionCode":"us - east - 1","physicalProcessor":"Intel Xeon Scalable(Sapphire Rapids)","clockSpeed":"3.5 GHz","ecu":"NA","networkPerformance":"Up to 12500 Megabit","servicename":"Amazon Elastic Compute Cloud","gpuMemory":"NA","vpcnetworkingsupport":"true","instanceType":"m7i-flex.large","tenancy":"Shared","usagetype":"BoxUsage: m7i - flex.large","normalizationSizeFactor":"4","intelAvxAvailable":"Yes","processorFeatures":"Intel AVX; Intel AVX2; Intel AVX512; Intel Turbo; Intel AMX","servicecode":"AmazonEC2","licenseModel":"No License required","currentGeneration":"Yes","preInstalledSw":"SQL Ent","location":"US East(N.Virginia)","processorArchitecture":"64 - bit","marketoption":"OnDemand","operation":"RunInstances: 0102","availabilityzone":"NA"},"sku":"WZEHDV2N2ZEZUGGS"},"serviceCode":"AmazonEC2","terms":{"OnDemand":{"WZEHDV2N2ZEZUGGS.JRTCKXETXF":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.JRTCKXETXF.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"$1.98485 per On Demand Windows with SQL Ent m7i - flex.large Instance Hour","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.JRTCKXETXF.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"1.98485"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-07-01T00: 00: 00Z","offerTermCode":"JRTCKXETXF","termAttributes":{}}},"Reserved":{"WZEHDV2N2ZEZUGGS.7NE97W5U4E":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.7NE97W5U4E.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.7NE97W5U4E.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2253500000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"7NE97W5U4E","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.4NA7Y494T4":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.4NA7Y494T4.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.4NA7Y494T4.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2183400000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"4NA7Y494T4","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.MZU6U2429S":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.MZU6U2429S.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.MZU6U2429S.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.MZU6U2429S.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.MZU6U2429S.2TG2D8R56U","pricePerUnit":{"USD":"5231"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"MZU6U2429S","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.BPH4J8HBKS":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.BPH4J8HBKS.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.BPH4J8HBKS.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1984400000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"BPH4J8HBKS","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"No Upfront"}},"WZEHDV2N2ZEZUGGS.CUZHX8X6JH":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1110000000"}},"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.CUZHX8X6JH.2TG2D8R56U","pricePerUnit":{"USD":"972"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"CUZHX8X6JH","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.VJWZNREJX2":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.VJWZNREJX2.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.VJWZNREJX2.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.VJWZNREJX2.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.VJWZNREJX2.2TG2D8R56U","pricePerUnit":{"USD":"1933"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"VJWZNREJX2","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"convertible","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.2TG2D8R56U","pricePerUnit":{"USD":"2628"}},"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.R5XV2EPZQZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0999800000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"R5XV2EPZQZ","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.HU7G6KETJZ":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.1076600000"}},"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.HU7G6KETJZ.2TG2D8R56U","pricePerUnit":{"USD":"943"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"HU7G6KETJZ","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.38NPMPTW36":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.38NPMPTW36.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.38NPMPTW36.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0976100000"}},"WZEHDV2N2ZEZUGGS.38NPMPTW36.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.38NPMPTW36.2TG2D8R56U","pricePerUnit":{"USD":"2565"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"38NPMPTW36","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"Partial Upfront"}},"WZEHDV2N2ZEZUGGS.6QCMYABX3D":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.6QCMYABX3D.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.6QCMYABX3D.2TG2D8R56U","pricePerUnit":{"USD":"1876"}},"WZEHDV2N2ZEZUGGS.6QCMYABX3D.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.6QCMYABX3D.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"6QCMYABX3D","termAttributes":{"LeaseContractLength":"1yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"USD 0.0 per Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.0000000000"}},"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.2TG2D8R56U":{"unit":"Quantity","description":"Upfront Fee","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.NQ3QZPMQV9.2TG2D8R56U","pricePerUnit":{"USD":"5067"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"NQ3QZPMQV9","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"standard","PurchaseOption":"All Upfront"}},"WZEHDV2N2ZEZUGGS.Z2E3P23VKM":{"priceDimensions":{"WZEHDV2N2ZEZUGGS.Z2E3P23VKM.6YS6EN2CT7":{"unit":"Hrs","endRange":"Inf","description":"Windows with SQL Server Web(Amazon VPC), m7i - flex.large reserved instance applied","appliesTo":[],"rateCode":"WZEHDV2N2ZEZUGGS.Z2E3P23VKM.6YS6EN2CT7","beginRange":"0","pricePerUnit":{"USD":"0.2035600000"}}},"sku":"WZEHDV2N2ZEZUGGS","effectiveDate":"2024-01-01T00: 00: 00Z","offerTermCode":"Z2E3P23VKM","termAttributes":{"LeaseContractLength":"3yr","OfferingClass":"convertible","PurchaseOption":"No Upfront"}}}},"version":"20240719162807","publicationDate":"2024-07 - 19T16: 28: 07Z"}'
);

const mockec2InstancePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ec2InstancePrice]
};

const mockec2StoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ec2StoragePrice]
};

const mockebsStoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ebsStoragePrice, ebsIopsPrice, ebsThroughputPrice]
};
const mockfsxnStoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [fsxnStoragePrice]
};

const mockSqlInstancePriceResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: '59a1d431-b744-4b14-b740-363ae72e535c',
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [sqlInstancePrice1, sqlInstancePrice2, sqlInstancePrice3, sqlInstancePrice4, sqlInstancePrice5]
};

const mockfsxnOperationalPriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [fsxnThroughputPrice, fsxnIopsPrice, fsxnReadPrice, fsxnWritePrice]
};
const mockVPCPriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [vpcStoragePrice]
};

const EC2STORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeType',
            Value: 'General Purpose'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeApiName',
            Value: 'gp3'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

const EBSSTORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeApiName',
            Value: 'gp2'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

const FSXNOPERATIONALFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'deploymentOption',
            Value: 'Multi-AZ'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'fileSystemType',
            Value: 'ONTAP'
        }
    ],
    ServiceCode: 'AmazonFSx',
    FormatVersion: 'aws_v1'
};

const FSXNSTORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'deploymentOption',
            Value: 'Multi-AZ'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'fileSystemType',
            Value: 'ONTAP'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'StorageType',
            Value: 'SSD'
        }
    ],
    ServiceCode: 'AmazonFSx',
    FormatVersion: 'aws_v1'
};

const EC2INSTANCERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'preInstalledSw',
            Value: 'SQL std'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Compute Instance'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'instanceType',
            Value: 'm5.xlarge'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'operatingSystem',
            Value: 'windows'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'tenancy',
            Value: 'Shared'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'CapacityStatus',
            Value: 'Used'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

const mockGetProductsResponse = mockfsxnStoragePriceGetProductsResponse;
const VPCFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'group',
            Value: 'AWSClientVPN'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'operation',
            Value: 'ClientVPNConnections'
        }
    ],
    ServiceCode: 'AmazonVPC',
    FormatVersion: 'aws_v1'
};

pricingMock.on(GetProductsCommand, FSXNSTORAGERATEFILTER).resolves(mockfsxnStoragePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, FSXNOPERATIONALFILTER).resolves(mockfsxnOperationalPriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EC2INSTANCERATEFILTER).resolves(mockec2InstancePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EC2STORAGERATEFILTER).resolves(mockec2StoragePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EBSSTORAGERATEFILTER).resolves(mockebsStoragePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, VPCFILTER).resolves(mockVPCPriceGetProductsResponse);
pricingMock.on(GetProductsCommand).callsFake(async command => {
    if (
        command?.Filters?.some(
            (filter: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                filter.Field === 'productFamily' && filter.Value === 'Compute Instance'
        )
    ) {
        const { Value: instanceType } =
            command?.Filters?.find(
                (filter: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter.Field === 'instanceType' && filter.Value !== undefined
            ) || {};
        if (instanceType) {
            const { PriceList: priceList } = mockSqlInstancePriceResponse;
            const updatedPriceList = priceList.map(price => updateInstanceType(instanceType, price));
            mockSqlInstancePriceResponse.PriceList = updatedPriceList;
            return mockSqlInstancePriceResponse;
        }
        return mockSqlInstancePriceResponse;
    }

    if (
        FSXNSTORAGERATEFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockfsxnStoragePriceGetProductsResponse;
    }

    if (
        FSXNOPERATIONALFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockfsxnOperationalPriceGetProductsResponse;
    }

    if (
        EC2INSTANCERATEFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockec2InstancePriceGetProductsResponse;
    }

    if (
        EC2STORAGERATEFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockec2StoragePriceGetProductsResponse;
    }

    if (
        EBSSTORAGERATEFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockebsStoragePriceGetProductsResponse;
    }

    if (
        VPCFILTER?.Filters?.every(filter1 =>
            command?.Filters?.some(
                (filter2: { Type: string | undefined; Field: string | undefined; Value: string | undefined }) =>
                    filter1.Type === filter2.Type && filter1.Field === filter2.Field
            )
        )
    ) {
        return mockVPCPriceGetProductsResponse;
    }
});
export default mockGetProductsResponse;

function updateInstanceType(instanceType: string, price: LazyJsonString): LazyJsonString {
    const sqlInstancePriceObject = JSON.parse(price.toString());
    sqlInstancePriceObject.product.attributes.instanceType = instanceType;
    return LazyJsonString.fromObject(JSON.stringify(sqlInstancePriceObject));
}
