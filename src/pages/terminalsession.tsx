import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const TerminalSessionUI = ({ darkMode = false }: { darkMode?: boolean }) => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    useEffect(() => {
    if (!sessionId) {
      navigate('/console-terminal');
      return;
    }

    console.log("Fetching data for Session ID:", sessionId);
    // TODO: Call Amplify Data to fetch the selected ConsoleTerminal where id === sessionId
    
  }, [sessionId, navigate]);

   return (
   <>
   <div style={{ padding: '2rem' }}>
      <h1>Live Terminal Session</h1>
      <p>Currently viewing session: <strong>{sessionId}</strong></p>
      
      
    </div>
   </>
   )

    
}

export default TerminalSessionUI;