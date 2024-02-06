import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import store from "./store/store";
import App from "./App";

jest.mock("@netapp/design-system", () => {
  return {
    Notification: jest.fn(),
    NotificationPanel: jest.fn(),
    Typography: jest.fn(),
useBlueXP: jest.fn(),
    Spinner: jest.fn(),
    ThemeProvider: jest.fn()
  };
});

test("renders the App component", () => {
  render(
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  );

  // Assert that the component renders without errors
  expect(App).toBeDefined();
});
