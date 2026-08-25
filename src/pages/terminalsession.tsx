import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { getInitials, getModelIcon } from '../utils/voltaire';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EphemeralSecrets } from '../data/consoleterminal';

const TerminalSessionUI = ({ darkMode = false }: { darkMode?: boolean }) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const client = generateClient() as any;

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ephemeralSecrets, setEphemeralSecrets] = useState<EphemeralSecrets>({});
  const [activeAuthPrompt, setActiveAuthPrompt] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/console-terminal');
      return;
    }

    const hydrateTerminalSession = async () => {
      try {
        const { data: currentTerminal } = await client.models.ConsoleTerminal.get({ id: sessionId }, {
          selectionSet: [
            'id', 'title', 'totalTokensUsed', 'status', 'contextProfileId', 'userId',
            'contextProfile.name', 'contextProfile.systemPrompt', 'contextProfile.temperature',
            'contextProfile.foundationModel.apiIdentifier', 'contextProfile.foundationModel.name',
            'contextProfile.foundationModel.provider', 'contextProfile.foundationModel.modality'
          ]
        });

        if (!currentTerminal) {
          console.error("Session target signature not found in infrastructure database.");
          navigate('/console-terminal');
          return;
        }

        setSession(currentTerminal);

        const { data: historicMessages } = await client.models.TerminalMessage.list({
          filter: { terminalId: { eq: sessionId } }
        });

        const chronologyLog = historicMessages.sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(chronologyLog);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to safely hydrate live terminal environment layer:", err);
        setIsLoading(false);
      }
    };

    hydrateTerminalSession();
  }, [sessionId, navigate]);

  const handleExecutePrompt = async (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    
    const queryText = (overridePrompt || inputMessage).trim();
    if (!queryText || isAiTyping || session?.status === 'ARCHIVED') return;

    if (!overridePrompt) setInputMessage('');
    setIsAiTyping(true);

    try {
      // Save new user message to DynamoDB
      const { data: committedUserMsg } = await client.models.TerminalMessage.create({
        role: 'USER',
        content: queryText,
        terminalId: session.id
      });
      setMessages(prev => [...prev, committedUserMsg]);

      const activeProfile = session.contextProfile;
      const targetModelIdentifier = activeProfile?.foundationModel?.apiIdentifier || "us.amazon.nova-pro-v1:0";

      // Format historic messages from DynamoDB for Bedrock Agent Context
      const bedrockHistory = messages.map((m: any) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: [{ text: m.content }]
      }));

      // Invoke Bedrock Agent via Backend with request schema arguments
      const response = await client.queries.askAssistant({
        prompt: queryText,
        systemPrompt: activeProfile?.systemPrompt || "Act as a factual system console.",
        modelId: targetModelIdentifier,
        profileId: session.contextProfileId,
        cognitoUserId: session.userId,
        chatHistory: JSON.stringify(bedrockHistory),
        ephemeralSecretsJson: JSON.stringify(ephemeralSecrets)
      });

      const transactionPayload = JSON.parse(response.data);

      // Determine if Backend LLM requested external credentials
      if (transactionPayload.requestedCredentials && transactionPayload.requestedCredentials.length > 0) {
        setActiveAuthPrompt(transactionPayload.requestedCredentials[0]);
      } else {
        setActiveAuthPrompt(null);
      }

      // Save AI response to DynamoDB
      const outputText = transactionPayload.answer || transactionPayload.error || "No response generated.";
      
      const generatedChips = transactionPayload.citations?.map((source: any) => {
        if (source.type === 'media') return `📸 Media Reference: ${source.uri.split('/').pop()}`;
        if (source.type === 'asset') return `🎥 Asset Generated: ${source.uri}`;
        return `📄 Text Vector Document`;
      }) || [];

      const { data: committedAiMsg } = await client.models.TerminalMessage.create({
        role: 'ASSISTANT',
        content: outputText,
        contextSources: generatedChips,
        terminalId: session.id
      });
      setMessages(prev => [...prev, committedAiMsg]);

      // Calculate token billing
      const inboundTokens = transactionPayload.tokenUsage?.inputTokens || 0;
      const outboundTokens = transactionPayload.tokenUsage?.outputTokens || 0;
      const aggregatedCost = inboundTokens + outboundTokens;

      if (aggregatedCost > 0) {
        const incrementedSessionTotal = (session.totalTokensUsed || 0) + aggregatedCost;
        await client.models.ConsoleTerminal.update({
          id: session.id,
          totalTokensUsed: incrementedSessionTotal
        });
        setSession((prev: any) => ({ ...prev, totalTokensUsed: incrementedSessionTotal }));
      }

    } catch (err) {
      console.error("Relay framework dropped socket connection during model invocation:", err);
      setMessages(prev => [...prev, {
        id: 'runtime-err-' + Date.now(),
        role: 'ASSISTANT',
        content: "RAG Pipeline Routing Interface Timeout or Configuration Error.",
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveAuthPrompt(null);
    // Auto-resume workflow
    handleExecutePrompt(undefined, "Credentials securely injected into ephemeral memory. Please resume and complete the requested operation.");
  };

  const handleDownloadTranscript = () => {
    if (!session || messages.length === 0) return;

    let markdown = `# Transcript: ${session.title}\n\n`;
    markdown += `- **Export Date:** ${new Date().toLocaleString()}\n`;
    markdown += `- **Session ID:** \`${session.id}\`\n`;
    markdown += `- **RAG Engine:** ${session.contextProfile?.foundationModel?.provider} • ${session.contextProfile?.foundationModel?.name}\n`;
    markdown += `- **Context Profile:** ${session.contextProfile?.name}\n`;
    markdown += `- **Tokens Consumed:** ${session.totalTokensUsed?.toLocaleString() || 0}\n\n`;
    markdown += `---\n\n`;

    const sortedMessages = [...messages].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    
    sortedMessages.forEach((msg) => {
      const isUser = msg.role === 'USER';
      const avatarName = isUser ? (session.userId?.split('@')[0] || 'Anonymous') : (session.contextProfile?.name || 'Vanguard AI');
      const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      markdown += `### ${avatarName} _(${time})_\n\n`;
      markdown += `${msg.content}\n\n`;

      if (msg.contextSources && msg.contextSources.length > 0) {
        markdown += `> **Retrieved Artifacts:**\n`;
        msg.contextSources.forEach((source: string) => {
          const cleanSource = source.replace(/[📸🎥📄]/g, '').trim();
          markdown += `> - \`${cleanSource}\`\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: darkMode ? '#fff' : '#000', fontFamily: 'Google Sans Code, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>INITIALIZING RAG SESSION...</h3>
          <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Mapping Context Profiles and allocating parallel tensor buffers.</p>
        </div>
      </div>
    );
  }

  const modelApiId = session?.contextProfile?.foundationModel?.apiIdentifier;
  const modelProvider = session?.contextProfile?.foundationModel?.provider;
  const modalityType = session?.contextProfile?.foundationModel?.modality;

  const visibleMessages = messages.slice(-visibleCount);
  const hasMoreMessages = messages.length > visibleCount;

  // Reusable inline style for modal inputs
  const inputStyle = {
    width: '100%',
    backgroundColor: darkMode ? '#1f2937' : '#f3f4f6',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    borderRadius: '4px',
    padding: '0.65rem',
    fontSize: '0.85rem',
    color: darkMode ? '#f9fafb' : '#111827',
    marginBottom: '0.75rem',
    boxSizing: 'border-box' as const,
    fontFamily: 'Google Sans Code, monospace'
  };

  return (
    <>
      <style>
        {`
          @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .terminal-viewport {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            padding: 1.5rem;
            margin-top: 7.3rem;
            height: calc(100vh - 7.3rem - 2rem);
          }

          @media (max-width: 768px) {
            .terminal-viewport {
              padding: 1rem;
              margin-top: 4.5rem;
              height: calc(100vh - 4.5rem - 1rem);
            }
          }
        `}
      </style>

      <div className="terminal-viewport">
        
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          paddingBottom: '1rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, marginBottom: '1rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src={getModelIcon(modelApiId)} alt="Processor Meta" style={{ width: '42px', height: '40px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable' }}>{session?.title}</h2>
              <span style={{ fontSize: '0.8rem', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'Bodoni Moda Variable' }}>
                Engine: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{modelProvider} • {session?.contextProfile?.foundationModel?.name}</span>
                &nbsp;| Personality: <strong>{session?.contextProfile?.name}</strong>
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                onClick={handleDownloadTranscript}
                disabled={messages.length === 0}
                style={{
                  background: 'none', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                  borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
                  color: darkMode ? '#d1d5db' : '#4b5563', cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s ease', fontFamily: 'Bodoni Moda Variable',
                  opacity: messages.length === 0 ? 0.5 : 1
                }}
                onMouseOver={(e) => { if (messages.length > 0) e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'; }}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Download transcript as Markdown"
              >
                <i className="fa-solid fa-download"></i> Export
              </button>

              <span style={{ 
                fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em',
                backgroundColor: session?.status === 'ACTIVE' ? '#10b9811c' : '#f59e0b1c', fontFamily: 'Bodoni Moda Variable',
                color: session?.status === 'ACTIVE' ? '#10b981' : '#f59e0b'
              }}>
                {session?.status} RAG SESSION
              </span>
            </div>

            <span style={{ fontSize: '0.8rem', marginTop: '0.35rem', color: darkMode ? '#9ca3af' : '#4b5563', fontFamily: 'Google Sans Code, monospace' }}>
              Billed Metrics: <strong style={{ color: darkMode ? '#f9fafb' : '#111827' }}>{session?.totalTokensUsed?.toLocaleString() || 0}</strong> computational tokens
            </span>
          </div>
        </div>

        <div style={{ 
          flex: 1, overflowY: 'auto', backgroundColor: darkMode ? '#111827' : '#f9fafb',
          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem',
          padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'
        }}>
          
          {hasMoreMessages && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <button
                onClick={() => setVisibleCount(prev => prev + 20)}
                style={{
                  background: 'none', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                  borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.75rem', 
                  color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <i className="fa-solid fa-arrow-up"></i> Load Previous Messages
              </button>
            </div>
          )}

          {visibleMessages.map((msg, index) => {
            const isUser = msg.role === 'USER';
            const avatarName = isUser ? (session?.userId?.split('@')[0] || 'Anonymous') : (session?.contextProfile?.name || 'Vanguard AI');
            const initials = getInitials(avatarName);

            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', gap: '1rem', alignItems: 'flex-end',
                  alignSelf: isUser ? 'flex-end' : 'flex-start', 
                  maxWidth: '85%', opacity: 0,
                  animation: 'bubbleFadeIn 0.4s ease-out forwards',
                  animationDelay: `${index * 0.05}s`
                }}
              >
                {!isUser && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#f9fafb' : '#111827',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`
                  }}>
                    {initials}
                  </div>
                )}

                <div style={{
                  backgroundColor: isUser ? '#800020' : (darkMode ? '#1f2937' : '#ffffff'),
                  color: isUser ? '#ffffff' : (darkMode ? '#f9fafb' : '#111827'),
                  border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                  padding: '1rem 1.25rem', borderRadius: '1rem',
                  borderBottomRightRadius: isUser ? '0.25rem' : '1rem',
                  borderBottomLeftRadius: !isUser ? '0.25rem' : '1rem',
                  boxShadow: isUser ? '0 4px 6px -1px rgba(128, 0, 32, 0.2)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ fontSize: '0.675rem', opacity: isUser ? 0.8 : 0.5, marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'Google Sans Code, monospace' }}>
                    {avatarName} • {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  
                  <div style={{ fontSize: '0.925rem', lineHeight: 1.6, fontFamily: 'inherit' }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, ...props }) => <p style={{ margin: '0 0 1rem 0' }} {...props} />,
                        a: ({ node, ...props }) => <a style={{ color: isUser ? '#bfdbfe' : '#3b82f6', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" {...props} />,
                        ul: ({ node, ...props }) => <ul style={{ margin: '0 0 1rem 1.5rem', padding: 0 }} {...props} />,
                        ol: ({ node, ...props }) => <ol style={{ margin: '0 0 1rem 1.5rem', padding: 0 }} {...props} />,
                        li: ({ node, ...props }) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                        pre: ({ node, ...props }) => (
                          <pre style={{ 
                            backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#111827' : '#f3f4f6'), 
                            padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto', 
                            border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
                            margin: '0.5rem 0 1rem 0' 
                          }} {...props} />
                        ),
                        code: ({ node, className, children, ...props }: any) => {
                          const isInline = !className;
                          return isInline ? (
                            <code style={{ 
                              backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#374151' : '#e5e7eb'), 
                              padding: '0.2rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.85em', fontFamily: 'Google Sans Code, monospace' 
                            }} {...props}>
                              {children}
                            </code>
                          ) : (
                            <code style={{ fontFamily: 'Google Sans Code, monospace', fontSize: '0.85em' }} className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                        table: ({ node, ...props }) => (
                          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: isUser ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }} {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th style={{ padding: '0.75rem', borderBottom: isUser ? '2px solid rgba(255,255,255,0.4)' : `2px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#1f2937' : '#f9fafb'), textAlign: 'left', fontWeight: 600 }} {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td style={{ padding: '0.75rem', borderBottom: isUser ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }} {...props} />
                        )
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {msg.contextSources && msg.contextSources.length > 0 && (
                    <div style={{ 
                      marginTop: '1rem', paddingTop: '0.75rem', 
                      borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb')}`, 
                      fontSize: '0.75rem', color: isUser ? '#fecaca' : (darkMode ? '#9ca3af' : '#6b7280') 
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontFamily: 'Bodoni Moda Variable' }}>Retrieved Artifacts:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {msg.contextSources.map((source: string, idx: number) => {
                          const isMedia = source.toLowerCase().includes('media') || source.toLowerCase().includes('asset');
                          return (
                            <span key={idx} style={{ 
                              padding: '0.25rem 0.5rem', backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#111827' : '#f3f4f6'), 
                              borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
                              border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, fontFamily: 'Google Sans Code, monospace'
                            }}>
                              {isMedia ? '📸' : '📄'} {source}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: '#800020', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #5a0016'
                  }}>
                    {initials}
                  </div>
                )}
              </div>
            );
          })}

          {isAiTyping && (
            <div style={{ alignSelf: 'flex-start', marginLeft: '3rem', padding: '0.85rem 1.15rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.85rem', fontFamily: 'Google Sans Code, monospace' }}>
              <span style={{ fontStyle: 'italic' }}>
                {modalityType === 'IMAGE' || modalityType === 'VIDEO' ? 'Generating asset pipeline rendering...' : 'Fusing text matrices and visual multimodal indexes...'}
              </span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={(e) => handleExecutePrompt(e)} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexShrink: 0 }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              session?.status === 'ARCHIVED' 
                ? "This session is archived and read-only." 
                : `Ask ${session?.contextProfile?.name || 'Praimfaya'} a question or query your knowledge base...`
            }
            disabled={isAiTyping || session?.status === 'ARCHIVED'}
            style={{
              flex: 1, padding: '0.85rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.925rem',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              backgroundColor: session?.status === 'ARCHIVED' ? (darkMode ? '#111827' : '#f3f4f6') : (darkMode ? '#1f2937' : '#ffffff'),
              color: darkMode ? '#f9fafb' : '#111827',
              cursor: session?.status === 'ARCHIVED' ? 'not-allowed' : 'text',
              fontFamily: 'Bodoni Moda Variable',
              minWidth: 0 
            }}
          />
          <button
            type="submit"
            disabled={isAiTyping || !inputMessage.trim() || session?.status === 'ARCHIVED'}
            style={{
              padding: '0.85rem 2.25rem', backgroundColor: '#800020', color: 'white', border: 'none', borderRadius: '0.375rem',
              fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'Google Sans Code',
              cursor: (isAiTyping || !inputMessage.trim() || session?.status === 'ARCHIVED') ? 'not-allowed' : 'pointer',
              opacity: (isAiTyping || !inputMessage.trim() || session?.status === 'ARCHIVED') ? 0.5 : 1,
              whiteSpace: 'nowrap'
            }}
          >
            Synthesize <i className="fa-solid fa-comment-nodes"></i>
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* SECURE SIDE-CHANNEL CREDENTIAL MODAL                                      */}
      {/* ========================================================================= */}
      {activeAuthPrompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? '#0891b2' : '#06b6d4'}`,
            borderRadius: '0.75rem', padding: '2rem', maxWidth: '32rem', width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            color: darkMode ? '#f9fafb' : '#111827',
            fontFamily: 'Google Sans Code, monospace'
          }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: darkMode ? '#22d3ee' : '#0891b2' }}>
              <i className="fa-solid fa-lock" style={{ fontSize: '1.25rem' }}></i>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Authentication Required
              </h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Action requires dynamic credentials for <strong style={{ color: darkMode ? '#67e8f9' : '#0891b2', textTransform: 'uppercase' }}>{activeAuthPrompt}</strong>. 
              Credentials are stored securely in ephemeral browser memory and clear upon refresh.
            </p>

            <form onSubmit={handleSecretSubmit}>
              
              {/* AIRTABLE */}
              {activeAuthPrompt === 'airtable' && (
                <input type="password" placeholder="Airtable API Key / PAT" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, airtableApiKey: e.target.value })} required style={inputStyle} />
              )}

              {/* SNOWFLAKE */}
              {activeAuthPrompt === 'snowflake' && (
                <>
                  <input type="text" placeholder="Account Identifier (e.g. xy12345.us-east-1)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakeAccount: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakeUser: e.target.value })} required style={inputStyle} />
                  <textarea placeholder="RSA Private Key (PEM format)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakePrivateKey: e.target.value })} required style={{...inputStyle, height: '100px', resize: 'none'}} />
                </>
              )}

              {/* AIRFLOW */}
              {activeAuthPrompt === 'airflow' && (
                <input type="url" placeholder="Airflow Webserver Base URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, airflowBaseUrl: e.target.value })} required style={inputStyle} />
              )}

              {/* RIPPLING */}
              {activeAuthPrompt === 'rippling' && (
                <input type="password" placeholder="Rippling Platform Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, ripplingApiKey: e.target.value })} required style={inputStyle} />
              )}

              {/* BAMBOOHR */}
              {activeAuthPrompt === 'bamboohr' && (
                <>
                  <input type="text" placeholder="Subdomain (e.g. mycompany)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bambooSubdomain: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bambooApiKey: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* ZENDESK */}
              {activeAuthPrompt === 'zendesk' && (
                <>
                  <input type="text" placeholder="Subdomain" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskSubdomain: e.target.value })} required style={inputStyle} />
                  <input type="email" placeholder="Admin Email" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskEmail: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskToken: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* SERVICENOW */}
              {activeAuthPrompt === 'servicenow' && (
                <>
                  <input type="text" placeholder="Instance Name (e.g. dev12345)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowInstance: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowUser: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="Password" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowPassword: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* PAGERDUTY */}
              {activeAuthPrompt === 'pagerduty' && (
                <>
                  <input type="password" placeholder="API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pagerDutyApiKey: e.target.value })} required style={inputStyle} />
                  <input type="email" placeholder="User Email (Required for incident updates)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pagerDutyUserEmail: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* GITHUB */}
              {activeAuthPrompt === 'github' && (
                <input 
                  type="password" 
                  placeholder="GitHub Personal Access Token (Fine-grained or Classic)" 
                  onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, githubToken: e.target.value })} 
                  required 
                  style={inputStyle} 
                />
              )}

              {/* GITLAB */}
              {activeAuthPrompt === 'gitlab' && (
                <>
                  <input 
                    type="text" 
                    placeholder="GitLab Domain (Optional, defaults to gitlab.com)" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, gitlabDomain: e.target.value })} 
                    style={inputStyle} 
                  />
                  <input 
                    type="password" 
                    placeholder="GitLab Personal Access Token" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, gitlabToken: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                </>
              )}

              {/* GRAFANA */}
              {activeAuthPrompt === 'grafana' && (
                <>
                  <input 
                    type="url" 
                    placeholder="Grafana Instance URL (e.g., https://myorg.grafana.net)" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, grafanaUrl: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                  <input 
                    type="password" 
                    placeholder="Grafana Cloud API Token / Service Account Token" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, grafanaToken: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                </>
              )}

              {/* DATADOG */}
              {activeAuthPrompt === 'datadog' && (
                <>
                  <input 
                    type="text" 
                    placeholder="Datadog Site (Optional, defaults to datadoghq.com)" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogSite: e.target.value })} 
                    style={inputStyle} 
                  />
                  <input 
                    type="password" 
                    placeholder="Datadog API Key" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogApiKey: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                  <input 
                    type="password" 
                    placeholder="Datadog Application Key" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogAppKey: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                </>
              )}

              {/* BUTTERFLYMX */}
              {activeAuthPrompt === 'butterflymx' && (
                <input 
                  type="password" 
                  placeholder="ButterflyMX API Access Token" 
                  onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, butterflyMxToken: e.target.value })} 
                  required 
                  style={inputStyle} 
                />
              )}

              {/* YARDI VIRTUOSO MCP */}
              {activeAuthPrompt === 'yardi' && (
                <>
                  <input 
                    type="password" 
                    placeholder="Yardi Virtuoso MCP Access Token" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, yardiToken: e.target.value })} 
                    required 
                    style={inputStyle} 
                  />
                  <input 
                    type="text" 
                    placeholder="Yardi Property ID (Optional, for property-specific scoping)" 
                    onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, yardiPropertyId: e.target.value })} 
                    style={inputStyle} 
                  />
                </>
              )}

              {/* SALESFORCE */}
              {activeAuthPrompt === 'salesforce' && (
                <>
                  <input type="url" placeholder="Salesforce Instance URL (e.g. https://your-domain.my.salesforce.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, salesforceInstanceUrl: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="Salesforce OAuth / Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, salesforceAccessToken: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* SAP ERP */}
              {activeAuthPrompt === 'sap' && (
                <>
                  <input type="url" placeholder="SAP S/4HANA Base URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapBaseUrl: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="SAP Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapUsername: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="SAP Password" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapPassword: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* DYNAMICS 365 */}
              {activeAuthPrompt === 'dynamics' && (
                <>
                  <input type="url" placeholder="Dynamics 365 Organization URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, dynamicsInstanceUrl: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="Dynamics 365 Web API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, dynamicsAccessToken: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* HUBSPOT */}
              {activeAuthPrompt === 'hubspot' && (
                <input type="password" placeholder="HubSpot Private App Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, hubspotAccessToken: e.target.value })} required style={inputStyle} />
              )}

              {/* LINKEDIN */}
              {activeAuthPrompt === 'linkedin' && (
                <input type="password" placeholder="LinkedIn Sales Navigator Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, linkedInAccessToken: e.target.value })} required style={inputStyle} />
              )}

              {/* UIPATH */}
              {activeAuthPrompt === 'uipath' && (
                <>
                  <input type="url" placeholder="UiPath Cloud URL (e.g. https://cloud.uipath.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathOrchestratorUrl: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="Organization Name" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathOrganizationName: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="Tenant Name" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathTenantName: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="UiPath OAuth / Bearer Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathAccessToken: e.target.value })} required style={inputStyle} />
                  <input type="text" placeholder="Orchestrator Folder ID (Optional, defaults to 1)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathFolderId: e.target.value })} style={inputStyle} />
                </>
              )}

              {/* BOOKING.COM */}
              {activeAuthPrompt === 'booking' && (
                <>
                  <input type="text" placeholder="Booking.com Affiliate ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bookingAffiliateId: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="Booking.com API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bookingToken: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* PRICELINE */}
              {activeAuthPrompt === 'priceline' && (
                <input type="password" placeholder="Priceline Partner API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pricelineApiKey: e.target.value })} required style={inputStyle} />
              )}

              {/* VRBO */}
              {activeAuthPrompt === 'vrbo' && (
                <>
                  <input type="text" placeholder="Expedia Group Partner ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, vrboPartnerId: e.target.value })} required style={inputStyle} />
                  <input type="password" placeholder="Vrbo / Rapid API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, vrboApiKey: e.target.value })} required style={inputStyle} />
                </>
              )}

              {/* MITO MCP */}
              {activeAuthPrompt === 'mito' && (
                <input 
                  type="password" 
                  placeholder="Mito UI MCP API Key" 
                  onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, mitoToken: e.target.value })} 
                  required 
                  style={inputStyle} 
                />
              )}

              {/* APOTHEOSIS MCP */}
              {activeAuthPrompt === 'apotheosis' && (
                <input 
                  type="password" 
                  placeholder="Apotheosis UX MCP API Key" 
                  onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, apotheosisToken: e.target.value })} 
                  required 
                  style={inputStyle} 
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setActiveAuthPrompt(null)}
                  style={{ padding: '0.65rem 1rem', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', backgroundColor: '#0891b2', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Inject Credentials
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TerminalSessionUI;