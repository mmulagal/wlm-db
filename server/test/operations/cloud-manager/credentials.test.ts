import { getAwsCredentials } from  '../../../src/operations/cloud-manager/credentials-operations';
import { faker } from '@faker-js/faker';

const credentialsid_1 = `${faker.string.alphanumeric(20)}`;
const credentialsid_2 = `${faker.string.alphanumeric(20)}`;
const mockapidata = [
  {
    "credentialsId": credentialsid_1,
    "credentialsType": "aws_assume_role",
    "extra": {
      "name": "fsx-role",
      "arn": "arn:aws:iam::464262061435:role/Fsx-role",
      "isGov": false
    },
    "isSimulated": false
  },
  {
    "credentialsId": credentialsid_2,
    "credentialsType": "aws_assume_role",
    "extra": {
      "name": "WLM-FSX",
      "arn": "arn:aws:iam::464262061435:role/FSX-WLM",
      "isGov": false
    },
    "isSimulated": false
  }
]

const mockdata = [
  {
    credentialsId: credentialsid_1,
    name: "fsx-role",
    arn: "arn:aws:iam::464262061435:role/Fsx-role",
    providerAccountId: "464262061435",
  },
  {
    credentialsId: credentialsid_2,
    name: "WLM-FSX",
    arn: "arn:aws:iam::464262061435:role/FSX-WLM",
    providerAccountId: "464262061435",
  },
]

vi.mock('../../../src/lib/cloud-manager/credentials', async() =>{
  return{
    getAllAwsCredentials() {
      return mockapidata
    }
  };
})

describe("getAwsCredentials method",() => {
    it("getAwsCredentials method should return mock data", async () => {
      const resp = await getAwsCredentials();
      expect(resp).toEqual(mockdata);
    })
  })
