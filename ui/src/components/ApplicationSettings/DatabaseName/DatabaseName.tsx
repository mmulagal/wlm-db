import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const DatabaseName = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["sqldatabase-1"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="10"
        title={
          <div className={CommonStyles.title}>{GENERAL.DATABASE_NAME}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default DatabaseName;
