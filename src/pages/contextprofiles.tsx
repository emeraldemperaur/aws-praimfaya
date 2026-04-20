import { useEffect, useState } from "react";
import FAButton from "../components/floatingactionbutton";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/api";

type ContextProfileType = Schema['ContextProfile']['type'];

const ContextProfilesUI = ({darkMode}: {darkMode: boolean}) =>{

  const contextProfilesClient = generateClient<Schema>().models.ContextProfile;
  const [contextProfiles, setContextProfiles] = useState<ContextProfileType[]>([]);
    useEffect(() => {
        document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
      }, [darkMode]);

    useEffect(() => {
       const contextProfilesSubscription = contextProfilesClient.observeQuery().subscribe({
          next: (data) => setContextProfiles([...data.items])
        });
        return () => contextProfilesSubscription.unsubscribe();
    }, []);

  const createNewContextProfile = () => {
    contextProfilesClient.create({
      name: `New Context Profile ${contextProfiles.length + 1}`,
      systemPrompt: "You are a helpful assistant.",
      llmModelId: "gpt-3.5-turbo",
    });
  }

    return(
    <>
      Context Profiles UI
      <FAButton darkMode={darkMode} onClick={() => createNewContextProfile()} icon={
        <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox={"0 0 24 24"}>
          <path d="M21.57 2.18a.98.98 0 0 0-.92-.11C7.29 7.2 4.15 20.71 4.02 21.28l1.95.43s.36-1.55 
          1.31-3.72H11c6.07 0 11-4.93 11-11V3c0-.33-.16-.64-.43-.82M20 7c0 4.96-4.04 9-9 9H8.24C10.26 
          12.16 13.87 7.31 20 4.5zM5 10h2V7h3V5H7V2H5v3H2v2h3z"></path>
        </svg>} />
    </>
    )
}

export default ContextProfilesUI;