import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const SimpleNotificationService = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["Disabled"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="21"
        title={
          <div className={CommonStyles.title}>
            {GENERAL.SIMPLE_NOTIFICATION_SERVICE}
          </div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default SimpleNotificationService;
