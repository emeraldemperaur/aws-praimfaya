import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import type { SelectionSet } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource'; 
import { getInitials, getModelIcon } from '../utils/voltaire';
import { NATIVE_TOOLS_TEMPLATES } from '../utils/prometheus';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EphemeralCredentialsModal from '../components/ephemeralcredentialsmodal';
import type { EphemeralSecrets } from '../data/consoleterminal';
import { JotformEmbed } from '../components/jotformportal';
import { HaikusDropdown } from '../components/haikusdropdown';
import { CubeIcon } from '../components/cube';
import { ArtifactsDrawerModal } from '../components/artifactsdrawermodal';
import { VectorDrawerModal } from '../components/vectordrawermodal';
import { WorkflowsDrawerModal } from '../components/workflowsdrawermodal';
import { AgentActivityDrawerModal } from '../components/agentactivitydrawermodal'; 

export const terminalSelectionSet = [
  'id', 'title', 'totalTokensUsed', 'status', 'contextProfileId', 'userId', 'deusExMachina', 'hyperlinks',
  'contextProfile.*', 'contextProfile.foundationModel.*', 'contextProfile.supervisor.*',
  'contextProfile.collaborators.*', 'contextProfile.vectorCollection.*', 'contextProfile.vectorCollection.documents.*', 'contextProfile.workflows.*', 'contextProfile.workflows.contextWorkflow.*'
] as const;

export type DeepTerminalSession = SelectionSet<Schema['ConsoleTerminal']['type'], typeof terminalSelectionSet>;

const client = generateClient<Schema>();

const MAX_URL_COUNT = 20;
const MAX_FILE_SIZE_MB = 25;
const MAX_CHAT_HISTORY_CONTEXT = 33; 

const WebLinksDropdown = ({
  darkMode,
  sessionId,
  hyperlinks = [],
  onUpdateHyperlinks
}: {
  darkMode: boolean;
  sessionId: string;
  hyperlinks: string[];
  onUpdateHyperlinks: (updated: string[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isValidUrl = useCallback((urlString: string) => {
    try {
      const url = new URL(urlString.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  const persistHyperlinks = async (updated: string[]) => {
    setIsSaving(true);
    onUpdateHyperlinks(updated);
    try {
      await client.models.ConsoleTerminal.update({ id: sessionId, hyperlinks: updated });
    } catch (err) {
      console.error('Failed to update hyperlinks in ConsoleTerminal:', err);
      setErrorMsg('Failed to sync links with server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (!isValidUrl(trimmed)) {
      setErrorMsg('Please enter a valid URL (http/https).');
      return;
    }

    if (hyperlinks.length >= MAX_URL_COUNT) {
      setErrorMsg(`Maximum ${MAX_URL_COUNT} URLs limit reached.`);
      return;
    }

    if (hyperlinks.includes(trimmed)) {
      setErrorMsg('URL is already added.');
      return;
    }

    const updated = [...hyperlinks, trimmed];
    setUrlInput('');
    await persistHyperlinks(updated);
  };

  const handleRemoveLink = async (indexToRemove: number) => {
    const updated = hyperlinks.filter((_, idx) => idx !== indexToRemove);
    await persistHyperlinks(updated);
  };

  const handleClearAll = async () => {
    setErrorMsg('');
    await persistHyperlinks([]);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
          setErrorMsg('');
        }}
        title="Add Web Links"
        style={{
          background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${hyperlinks.length > 0 ? '#3b82f6' : (darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)')}`,
          borderRadius: '8px',
          color: hyperlinks.length > 0 ? '#3b82f6' : (darkMode ? '#f9fafb' : '#111827'),
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          width: '32px',
          height: '32px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-link'}`}></i>
        {hyperlinks.length > 0 && !isSaving && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '999px',
            width: '14px',
            height: '14px',
            fontSize: '0.6rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {hyperlinks.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'absolute',
            bottom: '120%',
            left: 0,
            width: '280px',
            maxHeight: '320px',
            background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
            borderRadius: '12px',
            boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.75rem',
            gap: '0.5rem',
            fontFamily: 'Google Sans Code, monospace'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 300, fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.06em',
                 color: darkMode ? '#f9fafb' : '#111827', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <i className="fa-solid fa-globe" style={{ color: '#3b82f6' }}></i> Web Links ({hyperlinks.length}/{MAX_URL_COUNT})
              </span>
              {hyperlinks.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isSaving}
                  title="Clear All Links"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.1rem 0.3rem',
                    borderRadius: '4px'
                  }}
                >
                  <i className="fa-solid fa-broom"></i> Clear
                </button>
              )}
            </div>

            <form onSubmit={handleAddLink} style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={hyperlinks.length >= MAX_URL_COUNT || isSaving}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  fontFamily: 'Google Sans Code',
                  borderRadius: '6px',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'}`,
                  background: darkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
                  color: darkMode ? '#f9fafb' : '#111827',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={hyperlinks.length >= MAX_URL_COUNT || !urlInput.trim() || isSaving}
                title="Add URL"
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: (hyperlinks.length >= MAX_URL_COUNT || !urlInput.trim() || isSaving) ? 'not-allowed' : 'pointer',
                  opacity: (hyperlinks.length >= MAX_URL_COUNT || !urlInput.trim() || isSaving) ? 0.5 : 1,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </form>

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.68rem', lineHeight: 1.2 }}>
                {errorMsg}
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              maxHeight: '160px',
              overflowY: 'auto',
              marginTop: '0.25rem'
            }}>
              {hyperlinks.length === 0 ? (
                <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280', textAlign: 'center', padding: '0.5rem 0' }}>
                  No web links added yet.
                </div>
              ) : (
                hyperlinks.map((link, idx) => (
                  <div
                    key={`${link}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)',
                      border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                      fontSize: '0.7rem',
                      gap: '0.5rem'
                    }}
                  >
                    <span
                      title={link}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: darkMode ? '#93c5fd' : '#1d4ed8',
                        flex: 1
                      }}
                    >
                      {link}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      disabled={isSaving}
                      title="Remove link"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: darkMode ? '#ef4444' : '#dc2626',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        padding: '0 2px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TerminalSessionUI = ({ darkMode = false }: { darkMode?: boolean }) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<DeepTerminalSession | null>(null);
  const [messages, setMessages] = useState<Schema['TerminalMessage']['type'][]>([]);
  const [artifacts, setArtifacts] = useState<Schema['RAGArtifact']['type'][]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ephemeralSecrets, setEphemeralSecrets] = useState<EphemeralSecrets>({});
  const [activeAuthPrompt, setActiveAuthPrompt] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [userProfile, setUserProfile] = useState<Schema['UserProfile']['type'] | null>(null);
  const [isVerifyingCredits, setIsVerifyingCredits] = useState(true);
  const [latestActivity, setLatestActivity] = useState<Schema['AgentActivity']['type'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isArtifactsModalOpen, setIsArtifactsModalOpen] = useState(false);
  const [isVectorModalOpen, setIsVectorModalOpen] = useState(false);
  const [isWorkflowsModalOpen, setIsWorkflowsModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  
  const isOutOfCredits = useMemo(() => {
    return userProfile ? ((userProfile.computeCredits || 0) <= 0 || userProfile.subscriptionStatus !== 'ACTIVE') : false;
  }, [userProfile]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiTyping, latestActivity?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (inputMessage) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
      }
    }
  }, [inputMessage]);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser();
        const { data: profiles } = await client.models.UserProfile.list({ 
          filter: { cognitoUserId: { eq: user.userId } },
          limit: 1
        });
        if (isMounted) {
          if (profiles && profiles.length > 0) setUserProfile(profiles[0]);
          setIsVerifyingCredits(false);
        }
      } catch (err) {
        console.error("Failed to fetch Vanguard user profile:", err);
        if (isMounted) setIsVerifyingCredits(false);
      }
    };
    fetchUser();
    return () => { isMounted = false; };
  }, []);

  // Safe Subscription Lifecycle Management
  useEffect(() => {
    if (!sessionId) {
      navigate('/console-terminal');
      return;
    }

    let isSubscribed = true;
    let messagesSub: { unsubscribe: () => void } | null = null;
    let artifactsSub: { unsubscribe: () => void } | null = null;
    let sessionSub: { unsubscribe: () => void } | null = null;
    let activitySub: { unsubscribe: () => void } | null = null;

    const hydrateTerminalSession = async () => {
      try {
        const { data: currentTerminal } = await client.models.ConsoleTerminal.get(
          { id: sessionId }, 
          { selectionSet: terminalSelectionSet }
        );

        if (!isSubscribed) return;

        if (!currentTerminal) {
          console.error("Session target signature not found in infrastructure database.");
          navigate('/console-terminal');
          return;
        }

        setSession(currentTerminal as DeepTerminalSession);

        sessionSub = client.models.ConsoleTerminal.onUpdate({
          filter: { id: { eq: sessionId } }
        }).subscribe({
          next: (updatedTerminal: any) => {
            if (!isSubscribed) return;
            setSession((prevSession: any) => {
              if (!prevSession) return prevSession;
              return {
                ...prevSession,
                status: updatedTerminal.status ?? prevSession.status,
                deusExMachina: updatedTerminal.deusExMachina !== undefined ? updatedTerminal.deusExMachina : prevSession.deusExMachina,
                totalTokensUsed: updatedTerminal.totalTokensUsed ?? prevSession.totalTokensUsed,
                title: updatedTerminal.title ?? prevSession.title,
                hyperlinks: updatedTerminal.hyperlinks ?? prevSession.hyperlinks,
                contextProfile: prevSession.contextProfile
              };
            });
          },
          error: (err: any) => console.warn('Terminal subscription error:', err)
        });

        messagesSub = client.models.TerminalMessage.observeQuery({
          filter: { terminalId: { eq: sessionId } },
          selectionSet: ['id', 'role', 'content', 'createdAt', 'contextSources'] as any
        }).subscribe({
          next: (data: any) => {
            if (!isSubscribed) return;
            const chronologyLog = [...data.items].sort(
              (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );
            setMessages(chronologyLog);

            if (chronologyLog.length > 0) {
              const lastMsg = chronologyLog[chronologyLog.length - 1];
              if (lastMsg.role === 'USER') {
                setIsAiTyping(true);
              } else {
                setIsAiTyping(false);
                if (lastMsg.role === 'ASSISTANT' && lastMsg.content) {
                  const authMatch = lastMsg.content.match(/<vanguard_auth_request>(.*?)<\/vanguard_auth_request>/);
                  if (authMatch) {
                    const requestedSecret = authMatch[1];
                    if (!requestedSecret.startsWith('approved_')) {
                      setActiveAuthPrompt(requestedSecret);
                    }
                  }
                }
              }
            }
          },
          error: (err: any) => console.error("Error observing messages:", err)
        });

        artifactsSub = client.models.RAGArtifact.observeQuery({
           filter: { terminalId: { eq: sessionId } },
           selectionSet: ['id', 'createdAt', 'fileName', 'fileUrl', 'fileType'] as any
        }).subscribe({
          next: (data: any) => {
            if (!isSubscribed) return;
            const sortedArtifacts = [...data.items].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setArtifacts(sortedArtifacts);
            setIsLoading(false);
          },
          error: (err: any) => {
            console.error("Error observing artifacts:", err);
            if (isSubscribed) setIsLoading(false);
          }
        });

        activitySub = client.models.AgentActivity.observeQuery({
          filter: { terminalId: { eq: sessionId } },
          selectionSet: ['id', 'createdAt', 'lifecycleState', 'toolName', 'thoughtLog', 'modelId'] as any
        }).subscribe({
          next: (data: any) => {
            if (!isSubscribed) return;
            const sorted = [...data.items].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            if (sorted.length > 0) {
              setLatestActivity(sorted[0]);
            }
          }
        });

      } catch (err) {
        console.error("Failed to safely hydrate live terminal environment layer:", err);
        if (isSubscribed) setIsLoading(false);
      }
    };

    hydrateTerminalSession();

    return () => {
      isSubscribed = false;
      messagesSub?.unsubscribe();
      artifactsSub?.unsubscribe();
      sessionSub?.unsubscribe();
      activitySub?.unsubscribe();
    };
  }, [sessionId, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const validFiles: File[] = [];
      for (const file of filesArray) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setErrorMessage(`File "${file.name}" exceeds the max limit of ${MAX_FILE_SIZE_MB}MB.`);
          continue;
        }
        validFiles.push(file);
      }
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleExecutePrompt = async (e?: React.SyntheticEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    if (isOutOfCredits) return;
    
    let queryText = (overridePrompt || inputMessage).trim();
    if (!queryText && selectedFiles.length === 0) return;
    if (isAiTyping || session?.status === 'ARCHIVED' || !session) return;

    if (!overridePrompt) {
      setInputMessage('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    
    setIsAiTyping(true);
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const uploadedFilePaths: string[] = [];
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const timestamp = new Date().getTime();
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          
          const uploadTask = await uploadData({
            path: ({identityId}) => `vector-collections/${identityId}/attachments/${session.id}/${timestamp}-${safeName}`,
            data: file,
          }).result;

          uploadedFilePaths.push(uploadTask.path);
        }
        setSelectedFiles([]);
      }

      setIsUploading(false);

      let bedrockPrompt = queryText;
      const activeHyperlinks = (session.hyperlinks as string[])?.filter(Boolean) || [];

      if (uploadedFilePaths.length > 0 || activeHyperlinks.length > 0) {
        const contextParts: string[] = [];
        if (uploadedFilePaths.length > 0) {
          contextParts.push(`User has attached the following files for analysis:\n${uploadedFilePaths.map(path => `- ${path}`).join('\n')}`);
        }
        if (activeHyperlinks.length > 0) {
          contextParts.push(`User has provided the following web hyperlinks for context and search:\n${activeHyperlinks.map(link => `- ${link}`).join('\n')}`);
        }

        const hiddenContext = `<vanguard_system_context>\n${contextParts.join('\n\n')}\n</vanguard_system_context>\n\n`;
        bedrockPrompt = hiddenContext + queryText;
        if (!queryText) {
          queryText = uploadedFilePaths.length > 0
            ? `Attached ${uploadedFilePaths.length} file(s) for analysis.`
            : `Provided ${activeHyperlinks.length} web link(s) for context.`;
          bedrockPrompt += " Please analyze the provided attachments or web references and address any obvious data points.";
        }
      }

      const activeProfile = session.contextProfile;
      const targetModelIdentifier = activeProfile?.foundationModel?.apiIdentifier || "us.amazon.nova-pro-v1:0";

      // Cap chat history to reduce AppSync query payload overhead
      const recentMessages = messages.slice(-MAX_CHAT_HISTORY_CONTEXT);
      const bedrockHistory = recentMessages.map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: [{ text: m.content || '' }]
      }));

      const response = await client.queries.askAssistant({
        prompt: bedrockPrompt, 
        systemPrompt: activeProfile?.systemPrompt || "Act as a factual system console.",
        modelId: targetModelIdentifier,
        profileId: session.contextProfileId,
        cognitoUserId: session.userId || 'Anonymous',
        chatHistory: JSON.stringify(bedrockHistory),
        ephemeralSecretsJson: JSON.stringify(ephemeralSecrets)
      });

      if (response.errors && response.errors.length > 0) {
        throw new Error(response.errors[0].message);
      }

      let transactionPayload: any = {};
      try {
        transactionPayload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch {
        console.warn("askAssistant returned non-JSON payload string.");
      }

      if (transactionPayload?.error) {
        console.error("Fast-ACK Ingestion returned error:", transactionPayload.error);
        setIsAiTyping(false);
      }

    } catch (err: any) {
      console.error("Relay framework dropped socket connection during model invocation:", err);
      setIsUploading(false);
      setIsAiTyping(false);
      setErrorMessage(err.message || "Execution failed. Please retry.");
      
      setMessages((prev) => [...prev, {
        id: 'runtime-err-' + Date.now(),
        role: 'ASSISTANT',
        content: `RAG Pipeline Routing Error: ${err.message || "Interface Timeout"}`,
        terminalId: session?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Schema['TerminalMessage']['type']]);
    }
  };

  const handleSecretSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setActiveAuthPrompt(null);
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
      const time = new Date(msg.createdAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const cleanContent = (msg.content || '').replace(/<vanguard_auth_request>.*?<\/vanguard_auth_request>/g, '').trim();

      markdown += `### ${avatarName} _(${time})_\n\n`;
      markdown += `${cleanContent}\n\n`;

      if (msg.contextSources && msg.contextSources.length > 0) {
        markdown += `> **Retrieved Artifacts:**\n`;
        msg.contextSources.forEach((source: string | null) => {
          if (source) {
            const cleanSource = source.replace(/[📸🎥📄]/g, '').trim();
            markdown += `> - \`${cleanSource}\`\n`;
          }
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${session.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'session'}_transcript.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: darkMode ? '#fff' : '#000', fontFamily: 'Google Sans Code, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <CubeIcon width={30} height={30} darkMode={darkMode} edgeColor={darkMode ? '#ffffff' : '#0B0B45'} animationDuration="2s" />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>INITIALIZING RAG SESSION...</h3>
          <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0, letterSpacing: '0.13em' }}>Mapping Context Profiles and allocating parallel tensor buffers.</p>
        </div>
      </div>
    );
  }

  const modelApiId = session?.contextProfile?.foundationModel?.apiIdentifier;
  const modelProvider = session?.contextProfile?.foundationModel?.provider;
  const modalityType = session?.contextProfile?.foundationModel?.modality;

  const visibleMessages = messages.slice(-visibleCount);
  const hasMoreMessages = messages.length > visibleCount;

  return (
    <>
      <style>
        {`
          @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .terminal-viewport {
            position: relative;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            padding: 1.5rem;
            margin-top: 7.3rem;
            height: calc(100vh - 7.3rem - 9px);
          }

          textarea::-webkit-scrollbar { width: 6px; }
          textarea::-webkit-scrollbar-track { background: transparent; }
          textarea::-webkit-scrollbar-thumb { background-color: ${darkMode ? '#4b5563' : '#d1d5db'}; border-radius: 10px; }

          @media (max-width: 768px) {
            .terminal-viewport {
              padding: 1rem;
              margin-top: 4.5rem;
              height: calc(100vh - 4.5rem - 9px);
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
            <img src={getModelIcon(modelApiId || '')} alt="Processor Meta" style={{ width: '42px', height: '40px' }} />
            <div>
              <h2 title={session?.contextProfile?.role || 'STANDARD'} style={{ margin: 0, fontSize: '1.15rem', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable' }}>{session?.title}</h2>
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
                title="Download transcript as Markdown"
              >
                <i className="fa-solid fa-download"></i> Export
              </button>

              <span style={{ 
                fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em',
                backgroundColor: session?.status === 'ACTIVE' ? '#10b9811c' : '#f59e0b1c', fontFamily: 'Bodoni Moda Variable',
                color: session?.status === 'ACTIVE' ? '#10b981' : '#f59e0b'
              }}>
                {session?.status} {session?.contextProfile?.vectorCollection ? 'RAG' : ''} SESSION
              </span>
            </div>

            <span style={{ fontSize: '0.8rem', marginTop: '0.35rem', color: darkMode ? '#9ca3af' : '#4b5563', fontFamily: 'Google Sans Code, monospace' }}>
              Billed Metrics: <strong style={{ color: darkMode ? '#f9fafb' : '#111827' }}>{session?.totalTokensUsed?.toLocaleString() || 0}</strong> computational tokens
            </span>
          </div>
        </div>

        <div style={{ 
          flex: 1, position: 'relative', overflow: 'hidden', 
          backgroundColor: darkMode ? '#111827' : '#f9fafb',
          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem',
          display: 'flex', flexDirection: 'column'
        }}>
          
          <div style={{ 
            flex: 1, overflowY: 'auto', padding: '1.5rem', 
            paddingBottom: '180px', 
            display: 'flex', flexDirection: 'column', gap: '1.5rem' 
          }}>
            
            {hasMoreMessages && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <button
                  onClick={() => setVisibleCount((prev: number) => prev + 20)}
                  style={{
                    background: 'none', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                    borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.75rem', 
                    color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
                  }}
                >
                  <i className="fa-solid fa-arrow-up"></i> Load Previous Messages
                </button>
              </div>
            )}

            {visibleMessages.map((msg, index) => {
              const isUser = msg.role === 'USER';
              const avatarName = isUser ? (session?.userId?.split('@')[0] || 'Anonymous') : (session?.contextProfile?.name || 'Vanguard AI');
              const initials = getInitials(avatarName);
              const agentRole = !isUser && msg.content ? session?.contextProfile?.role || 'STANDARD' : null;
              
              let displayContent = msg.content || "";
              
              const isHitlRequest = displayContent.includes('<vanguard_auth_request>approved_');
              const authMatch = displayContent.match(/<vanguard_auth_request>approved_(.*?)<\/vanguard_auth_request>/);
              const toolToApprove = authMatch ? authMatch[1] : null;

              displayContent = displayContent.replace(/<vanguard_auth_request>.*?<\/vanguard_auth_request>/g, '').trim();

              const jotformRegex = /https:\/\/form\.jotform\.com\/(\d+)/g;
              const jotformMatches = [...displayContent.matchAll(jotformRegex)];
              const uniqueFormIds = Array.from(new Set(jotformMatches.map(m => m[1])));

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
                      backgroundColor: darkMode ? '#1f2937' : '#f9fafb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                      overflow: 'hidden'
                    }}>
                      <CubeIcon 
                        width={22} height={22} 
                        darkMode={darkMode} 
                        edgeColor={darkMode ? '#ffffff' : '#0B0B45'} 
                        animationDuration={isAiTyping && index === visibleMessages.length - 1 ? "1.5s" : "0s"} 
                      />
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
                    <div style={{ fontSize: '0.675rem', opacity: isUser ? 0.8 : 0.5, marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'Google Sans Code, monospace', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{avatarName} • {new Date(msg.createdAt || 0).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {!isUser && agentRole && agentRole !== 'STANDARD' && (
                        <span style={{ 
                          padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', 
                          backgroundColor: agentRole === 'SUPERVISOR' ? '#8b5cf620' : '#10b98120', 
                          color: agentRole === 'SUPERVISOR' ? '#8b5cf6' : '#10b981', 
                          border: `1px solid ${agentRole === 'SUPERVISOR' ? '#8b5cf650' : '#10b98150'}` 
                        }}>
                          <i className={`fa-solid ${agentRole === 'SUPERVISOR' ? 'fa-network-wired' : 'fa-people-group'}`} style={{ marginRight: '3px' }}></i>
                          {agentRole}
                        </span>
                      )}
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
                        {displayContent}
                      </ReactMarkdown>

                      {isHitlRequest && !isUser && toolToApprove && (
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
                          <button 
                            onClick={() => {
                              const newSecrets = { ...ephemeralSecrets, [`approved_${toolToApprove}`]: true };
                              setEphemeralSecrets(newSecrets);
                              handleExecutePrompt(undefined, `[HUMAN AUTHORIZATION GRANTED] Please proceed with executing the tool: ${toolToApprove}.`);
                            }}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            <i className="fa-solid fa-check"></i> Approve Execution
                          </button>
                          
                          <button 
                            onClick={() => {
                              handleExecutePrompt(undefined, `[HUMAN AUTHORIZATION DENIED] Do not execute ${toolToApprove}. Please suggest an alternative or abort.`);
                            }}
                            style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            <i className="fa-solid fa-xmark"></i> Reject
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {uniqueFormIds.map(formId => (
                      <JotformEmbed key={formId} formId={formId} darkMode={darkMode} />
                    ))}

                    {msg.contextSources && msg.contextSources.length > 0 && (
                      <div style={{ 
                        marginTop: '1rem', paddingTop: '0.75rem', 
                        borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb')}`, 
                        fontSize: '0.75rem' 
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontFamily: 'Bodoni Moda Variable', color: isUser ? '#fecaca' : (darkMode ? '#9ca3af' : '#6b7280') }}>Generated Artifacts:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {msg.contextSources.map((source: string | null, idx: number) => {
                            if (!source) return null;
                            const urlMatch = source.match(/https:\/\/[^\s]+/);
                            const url = urlMatch ? urlMatch[0] : null;
                            const cleanName = url ? url.split('/').pop() : source.replace(/[📸🎥📄]/g, '').trim();

                            if (!url) {
                              return (
                                <span key={idx} style={{ padding: '0.35rem 0.6rem', backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#1f2937' : '#f3f4f6'), borderRadius: '4px', border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, fontFamily: 'Google Sans Code, monospace', width: 'fit-content' }}>
                                  📄 {cleanName}
                                </span>
                              );
                            }

                            const isAudio = url.endsWith('.mp3') || url.endsWith('.wav');
                            const isVideo = url.endsWith('.mp4');
                            const isImage = url.endsWith('.jpeg') || url.endsWith('.jpg') || url.endsWith('.png');
                            const isDocument = url.endsWith('.md') || url.endsWith('.csv') || url.endsWith('.txt') || url.endsWith('.html') || url.endsWith('.pdf');

                            return (
                              <div key={idx} style={{ 
                                  padding: '0.5rem', backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#111827' : '#f9fafb'), 
                                  border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
                                  borderRadius: '8px', maxWidth: '400px' 
                              }}>
                                {isImage && <img src={url} alt="Generated" style={{ width: '100%', borderRadius: '4px', marginBottom: '0.5rem', objectFit: 'contain' }} loading="lazy" />}
                                {isVideo && <video controls src={url} style={{ width: '100%', borderRadius: '4px', marginBottom: '0.5rem' }} />}
                                {isAudio && <audio controls src={url} style={{ width: '100%', height: '32px', marginBottom: '0.5rem' }} />}
                                {isDocument && (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', backgroundColor: darkMode ? '#1f2937' : '#e5e7eb', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                      <i className="fa-solid fa-file-lines" style={{ fontSize: '2.5rem', color: darkMode ? '#9ca3af' : '#6b7280' }}></i>
                                  </div>
                                )}
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Google Sans Code, monospace', fontSize: '0.7rem', color: isUser ? '#fca5a5' : (darkMode ? '#9ca3af' : '#6b7280') }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName}</span>
                                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: isUser ? '#ffffff' : '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>View ↗</a>
                                </div>
                              </div>
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
              <div style={{ alignSelf: 'flex-start', marginLeft: '3rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '85%' }}>
                <div style={{ padding: '0.85rem 1.15rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.85rem', fontFamily: 'Google Sans Code, monospace' }}>
                  <span style={{ fontStyle: 'italic' }}>
                    {isUploading ? 'Uploading attachments to secure S3 bucket...' : 
                    (modalityType === 'IMAGE' || modalityType === 'VIDEO' ? 'Generating asset pipeline rendering...' : 'Fusing text matrices and visual multimodal indexes...')}
                  </span>
                </div>
                
                {latestActivity && latestActivity.lifecycleState === 'RUNNING' && (
                  (() => {
                    const toolTemplate = NATIVE_TOOLS_TEMPLATES.find(t => t.toolName === latestActivity.toolName);
                    const displayToolName = toolTemplate?.publicName || latestActivity.toolName || 'Reasoning Engine';
                    
                    return (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        backgroundColor: darkMode ? '#111827' : '#f3f4f6', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                        borderRadius: '8px', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'Google Sans Code, monospace',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', animation: 'bubbleFadeIn 0.3s ease-out forwards', marginTop: '0.5rem'
                      }}>
                        <img src={getModelIcon(latestActivity.toolName || '')} alt="Tool Icon" style={{ width: '24px', height: '24px' }} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                          <strong style={{ color: '#800020', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                              Action: {displayToolName}
                          </strong>
                          <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Metadata: {latestActivity.thoughtLog || 'Processing execution parameters...'}
                          </span>
                        </div>
                        
                        <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                          <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#10b981', fontSize: '1rem' }}></i>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <div style={{ 
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem',
          backgroundColor: darkMode ? 'rgba(27, 28, 29, 0.83)' : 'rgba(249, 250, 251, 0.85)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.05)', zIndex: 10
        }}>
          
          {errorMessage && (
            <div style={{ padding: '0.4rem 0.8rem', backgroundColor: '#ef444420', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', fontSize: '0.75rem', fontFamily: 'Google Sans Code, monospace' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> {errorMessage}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {selectedFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', 
                  backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '4px', fontSize: '0.75rem', 
                  color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'Google Sans Code, monospace'
                }}>
                  <i className="fa-solid fa-file"></i>
                  <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <button type="button" onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', color: '#800020', cursor: 'pointer', padding: '0 2px' }}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
            <HaikusDropdown 
              darkMode={darkMode} 
              onSelect={(promptStr) => setInputMessage(promptStr)} 
            />
            
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Document or Media"
              style={{
                background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px', color: darkMode ? '#f9fafb' : '#111827', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', width: '32px', height: '32px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-paperclip"></i>
            </button>

            {session?.contextProfile?.enableWebSearch && session?.id && (
              <WebLinksDropdown
                darkMode={darkMode}
                sessionId={session.id}
                hyperlinks={(session.hyperlinks as string[]) || []}
                onUpdateHyperlinks={(updatedLinks) => {
                  setSession((prev: any) => prev ? { ...prev, hyperlinks: updatedLinks } : prev);
                }}
              />
            )}

            <button
              type="button"
              onClick={() => setIsArtifactsModalOpen(true)}
              title="Open Artifacts Drawer"
              style={{
                background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px', color: darkMode ? '#f9fafb' : '#111827', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', width: '32px', height: '32px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-cubes"></i>
            </button>

            <button
              type="button"
              onClick={() => setIsVectorModalOpen(true)}
              title="Inspect Vector Collection"
              style={{
                background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px', color: darkMode ? '#f9fafb' : '#111827', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', width: '32px', height: '32px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path d="m21.45 6.11-6-3c-.26-.13-.56-.14-.83-.03l-12 5C2.25 8.24 2 8.6 2 9v8c0 .38.21.73.55.89l6 3c.14.07.29.11.45.11.13 0 .26-.03.38-.08l12-5c.37-.16.62-.52.62-.92V7c0-.38-.21-.73-.55-.89M14.96 5.1l3.64 1.82-9.56 3.98L5.4 9.08zM10 12.67l2-.83v5.83l-2 .83zM14 11l2-.83V16l-2 .83zm-10-.38 4 2v5.76l-4-2zm14 4.55V9.34l2-.83v5.83z"></path>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsWorkflowsModalOpen(true)}
              title="View Automation Workflows"
              style={{
                background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px', color: darkMode ? '#f9fafb' : '#111827', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', width: '32px', height: '32px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-circle-nodes"></i>
            </button>
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(true)}
              title="Review Agent Activity"
              style={{
                background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px', color: darkMode ? '#f9fafb' : '#111827', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', width: '32px', height: '32px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-microchip"></i>
            </button>
          </div>

          <form style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              rows={1}
              placeholder={
                isVerifyingCredits 
                  ? "Verifying compute authorization..."
                  : isOutOfCredits 
                  ? (userProfile?.subscriptionStatus === 'ACTIVE'
                      ? "Compute credits exhausted. Please top up to continue..." 
                      : "Compute credits required. Please subscribe to continue...")
                  : session?.status === 'ARCHIVED' 
                  ? "This session is archived and read-only." 
                  : `Ask ${session?.contextProfile?.name || 'Praimfaya'} a question or attach files...`
              }
              disabled={isAiTyping || session?.status === 'ARCHIVED' || isOutOfCredits || isVerifyingCredits}
              style={{
                flex: 1, padding: '0.85rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.925rem',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                backgroundColor: session?.status === 'ARCHIVED' || isOutOfCredits || isVerifyingCredits ? (darkMode ? '#111827' : '#f3f4f6') : (darkMode ? '#1f2937' : '#ffffff'),
                color: darkMode ? '#f9fafb' : '#111827',
                cursor: session?.status === 'ARCHIVED' || isOutOfCredits || isVerifyingCredits ? 'not-allowed' : 'text',
                fontFamily: 'Google Sans Code',
                resize: 'none',
                maxHeight: '100px',
                overflowY: 'auto',
                lineHeight: '1.5'
              }}
            />
            
            {isAiTyping ? (
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  if (!sessionId) return;
                  try {
                    await client.models.ConsoleTerminal.update({ id: sessionId as string, haltRequested: true });
                    setIsAiTyping(false);
                  } catch (err) { console.error(err); }
                }}
                title="Stop Processing"
                style={{
                  padding: '0', width: '46px', height: '46px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.375rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)'
                }}
              >
                <i className="fa-solid fa-stop" style={{ fontSize: '1.2rem' }}></i>
              </button>
            ) : isOutOfCredits && !isVerifyingCredits ? (
              <button
                type="button"
                onClick={() => navigate('/user-profile')}
                title={userProfile?.subscriptionStatus === 'ACTIVE' ? "Top Up Required" : "Subscription Required"}
                style={{
                  padding: '0 1.5rem',
                  height: '46px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.375rem',
                  fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.13em', fontFamily: 'Bodoni Moda Variable',
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
                  boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)'
                }}
              >
                <i className="fa-solid fa-credit-card"></i>
                {userProfile?.subscriptionStatus === 'ACTIVE' ? 'Top Up' : 'Subscribe'}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => handleExecutePrompt(e)}
                title="Submit"
                disabled={session?.status === 'ARCHIVED' || isVerifyingCredits || (!inputMessage.trim() && selectedFiles.length === 0)}
                style={{
                  padding: '0 2.25rem', height: '46px', backgroundColor: '#800020', color: 'white', border: 'none', borderRadius: '0.375rem',
                  fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'Google Sans Code',
                  cursor: (session?.status === 'ARCHIVED' || isVerifyingCredits || (!inputMessage.trim() && selectedFiles.length === 0)) ? 'not-allowed' : 'pointer',
                  opacity: (session?.status === 'ARCHIVED' || isVerifyingCredits || (!inputMessage.trim() && selectedFiles.length === 0)) ? 0.5 : 1,
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {isVerifyingCredits ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-regular fa-paper-plane"></i>}
              </button>
            )}
          </form>

        </div>
      </div>

      {activeAuthPrompt && (
        <EphemeralCredentialsModal
          darkMode={darkMode}
          activeAuthPrompt={activeAuthPrompt}
          ephemeralSecrets={ephemeralSecrets}
          setEphemeralSecrets={setEphemeralSecrets}
          onSubmit={handleSecretSubmit}
          onCancel={() => setActiveAuthPrompt(null)}
        />
      )}

      <ArtifactsDrawerModal 
        isOpen={isArtifactsModalOpen} 
        onClose={() => setIsArtifactsModalOpen(false)} 
        darkMode={darkMode} session={session} artifacts={artifacts} 
      />
      <VectorDrawerModal 
        isOpen={isVectorModalOpen} 
        onClose={() => setIsVectorModalOpen(false)} 
        darkMode={darkMode} session={session} 
      />
      <WorkflowsDrawerModal 
        isOpen={isWorkflowsModalOpen} 
        onClose={() => setIsWorkflowsModalOpen(false)} 
        darkMode={darkMode} session={session} 
      />
      <AgentActivityDrawerModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        darkMode={darkMode} session={session}
      />
    </>
  );
};

export default TerminalSessionUI;