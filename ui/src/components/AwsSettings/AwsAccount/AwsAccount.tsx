import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import styles from "./AwsAccount.module.scss";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const AwsAccount = () => {
  //Set the Header text here
  const setHeader = () => {
    return "No account";
  };
  return (
    <div className={styles["aws-account"]}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="1"
        title={<div className={CommonStyles.title}>AWS account</div>}
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default AwsAccount;
