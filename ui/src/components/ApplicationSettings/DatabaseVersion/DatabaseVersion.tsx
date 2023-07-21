import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const DatabaseVersion = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["SQL Server 2019"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="8"
        title={
          <div className={CommonStyles.title}>{GENERAL.DATABASE_VERSION}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default DatabaseVersion;
