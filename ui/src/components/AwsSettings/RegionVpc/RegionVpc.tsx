import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import ActionRequired from "../../../common/ActionRequired/ActionRequired";
import styles from "./RegionVpc.module.scss";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const RegionVpc = () => {
  //Set the Header text here
  const setHeader = () => {
    return <ActionRequired />;
  };
  return (
    <div className={styles["region-vpc"]}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="2"
        title={<div className={CommonStyles.title}>Region & VPC</div>}
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default RegionVpc;
