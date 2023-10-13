import "./InputComponent.css";
import { useState } from "react";

const InputComponent = ({ heading, selectKey, fieldType, onChange }) => {
  const [value, setValue] = useState("");

  return (
    <div className="select-component">
      <div className="select-component-heading">{heading}</div>
      <div className="select-list-container">
        <input
          className="input-component-box"
          onChange={(e) => {
            onChange(selectKey, e.target.value);
            setValue(e.target.value);
          }}
          value={value}
          // onKeyUp={(e) => {
          //   if (e.key === "Enter") {
          //     onSelect(selectKey, value, value);
          //   }
          // }}
          type={fieldType}
        />
      </div>
    </div>
  );
};

export default InputComponent;
