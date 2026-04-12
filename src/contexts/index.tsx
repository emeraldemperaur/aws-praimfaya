import React, { useState, createContext, useContext } from "react";

export interface PraimfayaContextType {
  localeDate: string;
  logUser: string;
  logKey: string;
  logUUID: string;
  userLog: (loginUser: string, loginKey: string, loginUUID: string) => void;
  userLogout: () => void;
  isAuthenticated: boolean;
}

const PraimfayaContext = createContext<PraimfayaContextType>({} as PraimfayaContextType);

interface PraimfayaProviderProps {
  children: React.ReactNode;
}

const PraimfayaProvider = ({ children }: PraimfayaProviderProps) => {
  const [localeDate] = useState<string>(getLocalTime);
  const [logUser, setLogUser] = useState<string>(""); 
  const [logKey, setLogKey] = useState<string>("");
  const [logUUID, setLogUUID] = useState<string>("");

  const logUserLogin = (loginUser: string, loginKey: string, loginUUID: string): void => {
    setLogUser(loginUser);
    setLogKey(loginKey);
    setLogUUID(loginUUID);
  };

  const logUserLogout = (): void => {
    setLogUser("");
    setLogKey("");
  };

  const isAuthenticated = logUser !== "" && logKey !== "";

  return (
    <PraimfayaContext.Provider
      value={{
        localeDate,
        logUser,
        logKey,
        logUUID,
        userLog: logUserLogin,
        userLogout: logUserLogout,
        isAuthenticated,
      }}
    >
      {children}
    </PraimfayaContext.Provider>
  );
};

const getLocalTime = (): string => {
  const newDate = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const formattedDate = newDate.toLocaleDateString("en-us", options);
  console.log(formattedDate);
  return formattedDate;
};

export { PraimfayaContext, PraimfayaProvider };

export const usePraimfaya = () => useContext(PraimfayaContext);