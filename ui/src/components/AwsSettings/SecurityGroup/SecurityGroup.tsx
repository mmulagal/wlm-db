import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { SELECT_CONFIG } from "../../../utils/appConstants";
import styles from "./SecurityGroup.module.scss";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const SecurityGroup = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["Use an existing security group"];
  };
  return (
    <div className={styles["security-group"]}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="4"
        title={
          <div className={CommonStyles.title}>
            {SELECT_CONFIG.SECURITY_GROUP}
          </div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};
export default SecurityGroup;
