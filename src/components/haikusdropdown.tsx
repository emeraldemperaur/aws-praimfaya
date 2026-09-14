import { useState, useMemo } from "react";
import { NATIVE_TOOLS_TEMPLATES } from "../utils/prometheus";
import { getModelIcon } from "../utils/voltaire";

export const HaikusDropdown = ({ darkMode, onSelect }: { darkMode: boolean, onSelect: (prompt: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeToolName, setActiveToolName] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    return NATIVE_TOOLS_TEMPLATES.map(tool => {
      const matchesSearch = tool.publicName.toLowerCase().includes(searchQuery.toLowerCase());
      const filteredPrompts = (tool.userPrompts || []).filter(p => 
        p.promptName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.userPrompt.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return {
        ...tool,
        userPrompts: matchesSearch ? tool.userPrompts : filteredPrompts
      };
    }).filter(tool => tool.userPrompts && tool.userPrompts.length > 0);
  }, [searchQuery]);

  const activeTool = filteredTemplates.find(t => t.toolName === activeToolName);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveToolName(null);
  };

  return (
    <div style={{ position: 'relative', fontFamily: 'Bodoni Moda Variable, serif' }} onMouseLeave={() => setActiveToolName(null)}>
      
      <style>{`
        .haikus-scrollable::-webkit-scrollbar {
          width: 5px;
        }
        .haikus-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }
        .haikus-scrollable::-webkit-scrollbar-thumb {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
          border-radius: 10px;
        }
        .haikus-scrollable::-webkit-scrollbar-thumb:hover {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
        }
        .haiku-flyout-enter {
          animation: slideInFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideInFade {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <button
        type="button"
        onClick={(e) => { 
          e.preventDefault(); 
          if (isOpen) {
            closeDropdown();
          } else {
            setIsOpen(true);
          }
        }}
        style={{
          background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          color: darkMode ? '#f9fafb' : '#111827',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          fontWeight: 400,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          outline: 'none',
          fontFamily: 'Bodoni Moda Variable, serif',
        }}
      >
        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#0891b2' }}></i> Prompt Templates <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'up'}`} style={{ fontSize: '0.65rem' }}></i>
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={closeDropdown} />
          
          <div style={{
            position: 'absolute',
            bottom: '120%', 
            left: 0,
            display: 'flex',
            gap: '0.25rem',
            zIndex: 100,
            alignItems: 'flex-end'
          }}>
            
            {/* Primary Dropdown Menu (Parent Tools) */}
            <div 
              className="haikus-scrollable"
              style={{
                width: '350px',
                maxHeight: '400px',
                overflowY: 'auto',
                background: darkMode ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '12px',
                boxShadow: darkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                padding: '0.5rem',
                gap: '0.25rem'
              }}>
              
              <div style={{ padding: '0.25rem 0.25rem 0.5rem', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`, marginBottom: '0.25rem' }}>
                <input
                  type="text"
                  placeholder="Search tools and prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                    background: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                    color: darkMode ? '#f9fafb' : '#111827',
                    fontSize: '0.8rem',
                    fontFamily: 'Google Sans Code, monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {filteredTemplates.length > 0 ? (
                filteredTemplates.map(tool => {
                  const isActive = activeToolName === tool.toolName;
                  return (
                    <div
                      key={tool.toolName}
                      onMouseEnter={() => setActiveToolName(tool.toolName)}
                      onClick={() => setActiveToolName(tool.toolName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isActive 
                          ? (darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') 
                          : 'transparent',
                        transition: 'background 0.2s',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 400,
                        color: darkMode ? '#e5e7eb' : '#374151',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={getModelIcon(tool.toolName)} alt={tool.publicName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {tool.publicName}
                        </span>
                      </div>
                      <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', opacity: isActive ? 1 : 0.4, color: isActive ? '#0891b2' : 'inherit' }}></i>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  No tools found.
                </div>
              )}
            </div>

            {/* Flyout Submenu (User Prompts) */}
            {activeTool && (
              <div 
                className="haikus-scrollable haiku-flyout-enter"
                style={{
                  width: '350px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  background: darkMode ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.5rem',
                  gap: '0.25rem'
                }}>
                
                <div style={{ 
                  padding: '0.25rem 0.5rem 0.5rem', 
                  fontSize: '0.65rem', 
                  fontWeight: 700, 
                  color: darkMode ? '#9ca3af' : '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                  marginBottom: '0.25rem'
                }}>
                  Actions: {activeTool.publicName}
                </div>

                {activeTool.userPrompts.map(prompt => (
                  <div
                    key={prompt.promptName}
                    onClick={() => {
                      onSelect(prompt.userPrompt);
                      closeDropdown();
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      fontSize: '0.85rem',
                      fontWeight: 400,
                      color: darkMode ? '#e5e7eb' : '#374151',
                    }}
                  >
                    {prompt.promptName}
                  </div>
                ))}
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}