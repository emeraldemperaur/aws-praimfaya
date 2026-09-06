import { useState } from "react";
import { NATIVE_TOOLS_TEMPLATES } from "../utils/prometheus";
import { getModelIcon } from "../utils/voltaire";

export const HaikuDropdown = ({ darkMode, onSelect, role = 'STANDARD' }: { darkMode: boolean, onSelect: (prompt: string) => void, role?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = NATIVE_TOOLS_TEMPLATES.filter(tool => {
    const matchesSearch = tool.publicName.toLowerCase().includes(searchQuery.toLowerCase());
    const isAllowedByRole = (role === 'SUPERVISOR' || role === 'COLLABORATOR') 
      ? tool.modelAvailability === 'ALL_AGENTS' 
      : true;

    return matchesSearch && isAllowedByRole;
  });

  return (
    <div style={{ position: 'relative', fontFamily: 'Bodoni Moda Variable, serif' }}>
      
      <style>{`
        .haiku-scrollable::-webkit-scrollbar {
          width: 6px;
        }
        .haiku-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }
        .haiku-scrollable::-webkit-scrollbar-thumb {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
          border-radius: 10px;
        }
        .haiku-scrollable::-webkit-scrollbar-thumb:hover {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
        }
      `}</style>

      <button
        onClick={(e) => { 
          e.preventDefault(); 
          setIsOpen(!isOpen); 
          if (isOpen) setSearchQuery("");
        }}
        style={{
          background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '8px',
          padding: '0.4rem 0.8rem',
          color: darkMode ? '#f9fafb' : '#111827',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: 400,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          outline: 'none',
          fontFamily: 'Bodoni Moda Variable, serif',
        }}
      >
        俳 Haiku <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '0.65rem' }}></i>
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setIsOpen(false); setSearchQuery(""); }} />
          <div 
            className="haiku-scrollable"
            style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: '280px',
              maxHeight: '350px',
              overflowY: 'auto',
              scrollbarWidth: 'thin', 
              scrollbarColor: `${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} transparent`, 
              background: darkMode ? 'rgba(31, 41, 55, 0.75)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: '12px',
              boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              padding: '0.5rem',
              gap: '0.25rem',
              fontFamily: 'Bodoni Moda Variable, serif',
            }}>
            <div style={{ 
              padding: '0.25rem 0.5rem 0.25rem', fontSize: '0.65rem', fontWeight: 700, color: darkMode ? '#9ca3af' : '#6b7280', 
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              Agentic System Templates
            </div>
            
            <div style={{ padding: '0 0.25rem 0.5rem', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`, marginBottom: '0.25rem' }}>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  background: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                  color: darkMode ? '#f9fafb' : '#111827',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {filteredTemplates.length > 0 ? (
              filteredTemplates.map(tool => (
                <div
                  key={tool.toolName}
                  onClick={() => {
                    onSelect(tool.systemPrompt);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    fontFamily: 'Bodoni Moda Variable, serif',
                    fontWeight: 300,
                  }}
                >
                  <img src={getModelIcon(tool.toolName)} alt={tool.publicName} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 100, color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable, serif' }}>
                    {tool.publicName}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                No templates available.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}