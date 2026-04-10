import React, { useState, createContext, useContext } from "react";

export interface PraimfayaContextType {
  localeDate: string;
  logUser: string[];
  logKey: string;
  userLog: (loginUser: string, loginKey: string) => void;
  isAuthenticated: boolean;
}

const PraimfayaContext = createContext<PraimfayaContextType>({} as PraimfayaContextType);

interface PraimfayaProviderProps {
  children: React.ReactNode;
}

const PraimfayaProvider = ({ children }: PraimfayaProviderProps) => {
  const [localeDate] = useState<string>(getLocalTime);
  const [logUser, setLogUser] = useState<string[]>([]); 
  const [logKey, setLogKey] = useState<string>("");

  const logUserLogin = (loginUser: string, loginKey: string): void => {
    setLogUser((prevState) => [...prevState, loginUser]);
    setLogKey(loginKey);
  };

  const isAuthentiacated = logUser.length > 0 && logKey !== '';

  return (
    <PraimfayaContext.Provider
      value={{
        localeDate: localeDate,
        logUser: logUser,
        logKey: logKey,
        userLog: logUserLogin,
        isAuthenticated: isAuthentiacated,
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