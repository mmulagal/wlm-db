import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const ThroughputCapacity = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["128 MB/s"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="18"
        title={
          <div className={CommonStyles.title}>
            {GENERAL.THROUGHPUT_CAPACITY}
          </div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default ThroughputCapacity;
