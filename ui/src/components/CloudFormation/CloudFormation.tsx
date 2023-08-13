import { Button } from "@netapp/design-system";
import { useAppSelector } from "../../store/storeHooks";
import { GENERAL } from "../../utils/appConstants";
import styles from "./CloudFormation.module.scss";
import { handleCreateSQLServer } from "../MSSqlServer/MSSqlFooter/createSqlServer";
import { useCreateSqlTemplateMutation } from "../../utils/apiService";
import { useDispatch } from "react-redux";
import { setIsLoading } from "../../store/mssql/msSqlActionSlice";
import { addNotification, NOTIFICATION_TYPES } from "../../store/notificationSlice";

const CloudFormation = () => {
  const dispatch = useDispatch();
  const state = useAppSelector(state => state);

  const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
  const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;

  const [createSqlTemplate] = useCreateSqlTemplateMutation();

  const handleTemplateView = () => {
    const payload = handleCreateSQLServer(state, dispatch);
    if(payload){
        dispatch(setIsLoading(true));
        createSqlTemplate({credentialId: selectedCredId, region: selectedRegionCode, payload: payload})
        .then((data:any) => {
            console.log(data);
            const url = data?.data?.cloudFormationUrl;
            const warning = data?.data?.warningMessage;
            if(warning && !url){
              dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, message: warning }));
            } else if(warning && url){
              dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, message: 
              <>
                {warning}. {GENERAL.CLOUD_FORMATION_URL_TEXT} <Button Component="button" variant="text" 
                onClick={() => window.open(url, '_blank', 'noopener')}>URL</Button>
              </> 
              }));
            } else if(url){
              window.open(url, '_blank', 'noopener');
            }
            dispatch(setIsLoading(false));
        })
        .catch((error:any) => {
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
