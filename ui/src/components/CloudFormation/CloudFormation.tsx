import { Button } from "@netapp/design-system";
import { GENERAL } from "../../utils/appConstants";
import styles from "./CloudFormation.module.scss";

const CloudFormation = () => {
  return (
    <div className={styles["cloud-formation"]}>
      <div className={styles.inner}>
        <Button Component="button" variant="link">
          {GENERAL.SAVE_FORM_AS_CLOUD}
        </Button>
      </div>
    </div>
  );
};

export default CloudFormation;
