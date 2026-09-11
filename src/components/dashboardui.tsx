import { useState, useEffect } from 'react';
import { signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';
import { usePraimfaya } from '../contexts';
import '../styles/dashboard.scss'; 
import NeumorphicToggle from './neumorphictoggle';

const client = generateClient() as any;

const menuItems = [
    { id: 'overview', icon: 'bx bx-grid-alt', label: 'System Overview' },
    { id: 'analytics', icon: 'bx bx-dollar-circle', label: 'Compute Credits' },
    { id: 'nodes', icon: 'bx bx-network-chart', label: 'Agent Nodes' },
    { id: 'transactions', icon: 'bx bx-brain', label: 'Knowledge Loci' },
    { id: 'settings', icon: 'bx bx-cog', label: 'Account Settings' }
];

const DashboardInterface = ({ darkMode }: { darkMode: boolean }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    
    const [isAdminRole, setIsAdminRole] = useState(false);
    const [isAdminView, setIsAdminView] = useState(false);
    const [planDisplayName, setPlanDisplayName] = useState('No Subscription');

    const navigator = useNavigate();
    const { userLogout } = usePraimfaya(); 

    useEffect(() => {
        const hydrateUserContext = async () => {
            try {
                const session = await fetchAuthSession();
                const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
                const adminGroups = ['superadmin', 'root', 'admin', 'heda'];
                const hasAdminPrivileges = adminGroups.some(group => groups.includes(group));
                setIsAdminRole(hasAdminPrivileges);
                setIsAdminView(hasAdminPrivileges);
                const user = await getCurrentUser();
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

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="ft-grid">
                        <div className="ft-card span-2">
                            <div className="card-header">
                                <h3>Revenue Streams</h3>
                                <button className="icon-btn"><i className="bx bx-dots-horizontal-rounded"></i></button>
                            </div>
                            <div className="mock-chart line-chart" />
                        </div>
                        <div className="ft-card ft-stat-card">
                            <h3>Active Agents</h3>
                            <h1 className="metric">1,042</h1>
                            <span className="trend positive"><i className="bx bx-trending-up"></i> +12.5%</span>
                        </div>
                        <div className="ft-card ft-stat-card">
                            <h3>Network Load</h3>
                            <h1 className="metric">34%</h1>
                            <span className="trend neutral"><i className="bx bx-minus"></i> Stable</span>
                        </div>
                        <div className="ft-card span-full">
                            <div className="card-header">
                                <h3>Recent Transactions</h3>
                            </div>
                            <div className="mock-table-placeholder">
                                <div className="mock-row header"><span>ID</span><span>Agent</span><span>Status</span><span>Amount</span></div>
                                <div className="mock-row"><span>#TRX-892</span><span>Alpha-Node</span><span className="badge success">Settled</span><span>$4,200.00</span></div>
                                <div className="mock-row"><span>#TRX-893</span><span>Beta-Node</span><span className="badge pending">Processing</span><span>$1,150.00</span></div>
                            </div>
                        </div>
                    </div>
                );
            case 'analytics':
                return <div className="ft-card full-height"><h3>AI Performance Metrics</h3><p>Data visualization goes here...</p></div>;
            default:
                return <div className="ft-card full-height"><h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3><p>Dashboard content module...</p></div>;
        }
    };

    return (
        <div className={`dashboard-wrapper ${darkMode ? 'dark-theme' : ''}`}>
            
            <aside className={`ft-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-placeholder" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        
                        <div className="logo-icon"><i className="bx bx-cube-alt"></i></div>
                        
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: '0.75rem',
                            opacity: isCollapsed ? 0 : 1, 
                            maxWidth: isCollapsed ? 0 : '200px', 
                            overflow: 'hidden', 
                            transition: 'all 0.3s ease',
                            pointerEvents: isCollapsed ? 'none' : 'auto',
                            whiteSpace: 'nowrap' 
                        }}>
                            {isAdminRole && (
                                <>
                                <NeumorphicToggle 
                                    darkMode={darkMode}
                                    checked={isAdminView} 
                                    onChange={(e) => setIsAdminView(e.target.checked)} 
                                />
                                <span 
                                    style={{ fontFamily: 'Bodoni Moda Variable', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.13em', fontSize: '0.93rem' }} 
                                    className="logo-text"
                                >
                                    {isAdminView ? 'Admin' : 'User'}
                                </span>
                                </>
                            )}
                             {!isAdminRole && (
                                <>
                                <span 
                                    style={{ fontFamily: 'Bodoni Moda Variable', textTransform: 'uppercase', fontWeight: 300, letterSpacing: '0.13em', fontSize: '0.69rem' }} 
                                    className="logo-text"
                                >
                                    {planDisplayName}
                                </span>
                                </>
                            )}
                            
                        </div>

                    </div>

                    <button 
                        className="ft-toggle-btn" 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle Sidebar"
                    >
                        <i className={`bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`}></i>
                    </button>
                </div>

                <div className="sidebar-label">Main Menu</div>
                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
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
                        <span className="breadcrumb">Dashboard / {menuItems.find(i => i.id === activeTab)?.label}</span>
                        <h2 className='dashboard-content-title'>{menuItems.find(i => i.id === activeTab)?.label}</h2>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar">
                            <i className="bx bx-search"></i>
                            <input type="text" placeholder="Search data..." />
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