import { useEffect } from "react";
import TitleRibbon from "../components/titleribbon";

const AmazonBedrockUI = ({ darkMode }: { darkMode: boolean }) => {
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  return (
    <>
    <TitleRibbon title="Amazon Bedrock" darkMode={darkMode} typewriterFX textAlignment="right"/>      
    </>
  );
};

export default AmazonBedrockUI;