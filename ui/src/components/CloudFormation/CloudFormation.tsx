import { Button } from "@netapp/design-system";
import { useAppSelector } from "../../store/storeHooks";
import { GENERAL } from "../../utils/appConstants";
import styles from "./CloudFormation.module.scss";
import { createMssqlPayload } from "../MSSqlServer/MSSqlFooter/createSqlServer";
import { useCreateSqlTemplateMutation } from "../../utils/apiService";
import { useDispatch } from "react-redux";
import { setIsLoading } from "../../store/mssql/msSqlActionSlice";

const CloudFormation = () => {
  const dispatch = useDispatch();
  const state = useAppSelector(state => state);

  const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
  const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;

  const [createSqlTemplate] = useCreateSqlTemplateMutation();

  const handleTemplateView = () => {
    const payload = createMssqlPayload(state);
    if(payload){
        dispatch(setIsLoading(true));
        createSqlTemplate({credentialId: selectedCredId, region: selectedRegionCode, payload: payload})
        .then((data:any) => {
            console.log(data);
            const url = data?.data?.cloudFormationUrl;
            if(url){
              window.open(url, '_blank', 'noopener');
            } else{
              console.log(data?.warningMessage);
            }
            dispatch(setIsLoading(false));
        })
        .catch((error:any) => {
            console.log(error);
            dispatch(setIsLoading(false));
        })
    }
};

  return (
    <div className={styles["cloud-formation"]}>
      <div className={styles.inner}>
        <Button Component="button" variant="link" onClick={handleTemplateView}>
          {GENERAL.SAVE_FORM_AS_CLOUD}
        </Button>
      </div>
    </div>
  );
};

export default CloudFormation;
