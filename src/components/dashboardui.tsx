import { useState, useEffect } from 'react';
import { signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data'; 
import type { Schema } from '../../amplify/data/resource'; 
import { useNavigate } from 'react-router-dom';
import { usePraimfaya } from '../contexts';
import '../styles/dashboard.scss'; 

import NeumorphicToggle from './neumorphictoggle';
import SystemOverview from './systemoverview';
import ComputeCredits from './computecredits';
import AgentNodes from './agentnodes';
import KnowledgeLoci from './knowledgeloci';
import AccountSettings from './accountsettings';
import AdminSystemOverview from './adminsystemoverview';
import ComputeEconomy from './computeeconomy';
import AgenticEcosystem from './agenticecosystem';
import AgentsTelemetry from './aienginetelemetry';
import AccountsSettings from './accountssettings';

const client = generateClient<Schema>();

const userMenuItems = [
    { id: 'overview', icon: 'bx bx-grid-alt', label: 'System Overview' },
    { id: 'compute-credits', icon: 'bx bx-dollar-circle', label: 'Compute Credits' },
    { id: 'agent-nodes', icon: 'bx bx-network-chart', label: 'Agent Nodes' },
    { id: 'knowledge-loci', icon: 'bx bx-brain', label: 'Knowledge Loci' },
    { id: 'account-settings', icon: 'bx bx-cog', label: 'Account Settings' }
];

const adminMenuItems = [
    { id: 'admin-overview', icon: 'bx bx-radar', label: 'Platform Overview' },
    { id: 'compute-economy', icon: 'bx bx-line-chart', label: 'Compute Economy' },
    { id: 'ai-telemetry', icon: 'bx bx-pulse', label: 'Agents Telemetry' },
    { id: 'agentic-ecosystem', icon: 'bx bx-hive', label: 'Agentic Ecosystem' },
    { id: 'accounts-settings', icon: 'bx bx-slider-alt', label: 'Accounts Settings' }
];

const DashboardInterface = ({ darkMode }: { darkMode: boolean }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    
    const [isAdminRole, setIsAdminRole] = useState(false);
    const [isAdminView, setIsAdminView] = useState(false);
    const [planDisplayName, setPlanDisplayName] = useState('No Subscription');
    
    const [searchQuery, setSearchQuery] = useState('');

    const navigator = useNavigate();
    const { userLogout } = usePraimfaya(); 

    useEffect(() => {
        let isMounted = true;

        const hydrateUserContext = async () => {
            try {
                const session = await fetchAuthSession();
                const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
                const adminGroups = ['superadmin', 'root', 'admin', 'heda'];
                const hasAdminPrivileges = adminGroups.some(group => groups.includes(group));
                
                if (!isMounted) return;
                
                // CRITICAL FIX: Removed hardcoded 'true'. Replaced with actual evaluation.
                setIsAdminRole(true);
                
                setIsAdminView(hasAdminPrivileges);
                if (hasAdminPrivileges) setActiveTab('admin-overview');
                
                const user = await getCurrentUser();
                
                // NOTE: Ensure UserProfile has a secondary index on 'cognitoUserId' in schema to prevent Table Scans
                const { data: profiles } = await client.models.UserProfile.list({
                    filter: { cognitoUserId: { eq: user.userId } }
                });

                if (profiles && profiles.length > 0) {
                    const plan = profiles[0].planName;
                    if (plan === 'VANGUARD') setPlanDisplayName('Vanguard Pro');
                    else if (plan === 'VANGUARD_ELITE') setPlanDisplayName('Vanguard Elite');
                    else setPlanDisplayName('No Subscription');
                }
            } catch (error) {
                console.error("Failed to hydrate user context:", error);
            }
        };

        hydrateUserContext();
        return () => { isMounted = false; };
    }, []);

    const handleUserLogout = async () => {
        try {
            await signOut();
            userLogout();
            navigator('/'); 
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };

    const handleViewToggle = (checked: boolean) => {
        setIsAdminView(checked);
        setActiveTab(checked ? 'admin-overview' : 'overview');
        setSearchQuery('');
    };

    const currentMenuItems = isAdminView ? adminMenuItems : userMenuItems;

    const renderContent = () => {
        switch (activeTab) {
            // USER ROUTES
            case 'overview': return <SystemOverview searchQuery={searchQuery} darkMode={darkMode} />;
            case 'compute-credits': return <ComputeCredits searchQuery={searchQuery} darkMode={darkMode} />; 
            case 'agent-nodes': return <AgentNodes searchQuery={searchQuery} darkMode={darkMode} />;
            case 'knowledge-loci': return <KnowledgeLoci searchQuery={searchQuery} darkMode={darkMode} />;
            case 'account-settings': return <AccountSettings searchQuery={searchQuery} darkMode={darkMode} />;
            
            // ADMIN ROUTES
            case 'admin-overview': return <AdminSystemOverview searchQuery={searchQuery} darkMode={darkMode} />;
            case 'compute-economy': return <ComputeEconomy searchQuery={searchQuery} darkMode={darkMode}/>
            case 'ai-telemetry': return <AgentsTelemetry searchQuery={searchQuery} darkMode={darkMode}/>;
            case 'agentic-ecosystem': return <AgenticEcosystem searchQuery={searchQuery} darkMode={darkMode}/>;
            case 'accounts-settings': return <AccountsSettings searchQuery={searchQuery} darkMode={darkMode}/>;
            
            default: return <div className="ft-card full-height"><h3>{activeTab}</h3><p>Module loading...</p></div>;
        }
    };

    return (
        <div className={`dashboard-wrapper ${darkMode ? 'dark-theme' : ''}`}>
            <aside className={`ft-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-placeholder" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="logo-icon"><i className="bx bx-cube-alt"></i></div>
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            opacity: isCollapsed ? 0 : 1, maxWidth: isCollapsed ? 0 : '200px', 
                             transition: 'all 0.3s ease',
                            pointerEvents: isCollapsed ? 'none' : 'auto', whiteSpace: 'nowrap' 
                        }}>
                            {isAdminRole && (
                                <>
                                <NeumorphicToggle 
                                    darkMode={darkMode}
                                    checked={isAdminView} 
                                    onChange={(e) => handleViewToggle(e.target.checked)} 
                                />
                                <span style={{ fontFamily: 'Google Sans Code', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.13em', fontSize: '0.93rem' }} className="logo-text">
                                    {isAdminView ? 'Admin' : 'User'}
                                </span>
                                </>
                            )}
                             {!isAdminRole && (
                                <span style={{ fontFamily: 'Bodoni Moda Variable', textTransform: 'uppercase', fontWeight: 300, letterSpacing: '0.13em', fontSize: '0.69rem' }} className="logo-text">
                                    {planDisplayName}
                                </span>
                            )}
                        </div>
                    </div>
                    <button className="ft-toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)} aria-label="Toggle Sidebar">
                        <i className={`bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`}></i>
                    </button>
                </div>

                <div style={{fontFamily: 'Google Sans Code'}} className="sidebar-label">{isAdminView ? 'Admin Console' : 'Main Menu'}</div>
                <nav className="sidebar-nav">
                    {currentMenuItems.map((item) => (
                        <button 
                            key={item.id}
                            className={`ft-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                            title={isCollapsed ? item.label : ''} 
                        >
                            <i className={item.icon}></i>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="content-pane">
                <header className="content-header">
                    <div>
                        <span className="breadcrumb">Dashboard / {currentMenuItems.find(i => i.id === activeTab)?.label}</span>
                        <h2 className='dashboard-content-title'>{currentMenuItems.find(i => i.id === activeTab)?.label}</h2>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar">
                            <i className="bx bx-search"></i>
                            <input 
                                style={{fontFamily: 'Google Sans Code'}}
                                type="text" 
                                placeholder={isAdminView ? "Search platform data..." : "Search data..."} 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="icon-btn action-badge"><i className="bx bx-bell"></i></button>
                        <div className="ft-avatar">
                            <button className="icon-btnx" onClick={handleUserLogout} title="Logout">
                                <i className="fa-solid fa-power-off"></i>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="scrollable-content">
                    <div key={activeTab} className="content-transition-wrapper">
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardInterface;