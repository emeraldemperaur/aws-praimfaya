import { useEffect } from "react";
import Authenticator from "../components/authenticator";
import '../styles/authenticator.scss';

const AuthenticationUI = ({darkMode}: {darkMode: boolean}) =>{

    useEffect(() => {
        document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
      }, 
      [darkMode]);

   
   
    return(
    <>
        <Authenticator darkMode={darkMode} />
    </>
    )
}

export default AuthenticationUI;