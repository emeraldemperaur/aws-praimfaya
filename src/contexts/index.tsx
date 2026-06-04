import React, { useState, createContext, useContext } from "react";

export interface PraimfayaContextType {
  localeDate: string;
  logUser: string;          // Cognito Email
  logKey: string;           // Cognito 'verified' status
  logUUID: string;          // Cognito UUID
  lastSignInTime: string;   // Last SignIn Timestamp
  userGroups: string[];     // Cognito User Pool Groups (Roles)
  userLog: (loginUser: string, loginKey: string, loginUUID: string, signInTime?: string, groups?: string[]) => void;
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
  const [lastSignInTime, setLastSignInTime] = useState<string>("");
  const [userGroups, setUserGroups] = useState<string[]>([]);

  const logUserLogin = (
    loginUser: string, 
    loginKey: string, 
    loginUUID: string, 
    signInTime?: string, 
    groups?: string[]
  ): void => {
    setLogUser(loginUser);
    setLogKey(loginKey);
    setLogUUID(loginUUID);
    setLastSignInTime(signInTime || new Date().toISOString());
    setUserGroups(groups || []);
  };

  const logUserLogout = (): void => {
    setLogUser("");
    setLogKey("");
    setLogUUID("");
    setLastSignInTime("");
    setUserGroups([]);
  };

  const isAuthenticated = logUser !== "" && logKey !== "";

  return (
    <PraimfayaContext.Provider
      value={{
        localeDate,
        logUser,
        logKey,
        logUUID,
        lastSignInTime,
        userGroups,
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