import { useState } from 'react';
import '../styles/dashboard.scss'; 

const menuItems = [
    { id: 'overview', icon: 'bx bx-grid-alt', label: 'System Overview' },
    { id: 'analytics', icon: 'bx bx-line-chart', label: 'AI Analytics' },
    { id: 'nodes', icon: 'bx bx-network-chart', label: 'Agent Nodes' },
    { id: 'transactions', icon: 'bx bx-transfer', label: 'Transactions' },
    { id: 'settings', icon: 'bx bx-cog', label: 'Settings' }
];

const DashboardInterface = ({ darkMode }: { darkMode: boolean }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

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
                    <div className="logo-placeholder">
                        <div className="logo-icon"><i className="bx bx-cube-alt"></i></div>
                        <span className="logo-text">Praimfaya OS</span>
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
                        <h2>{menuItems.find(i => i.id === activeTab)?.label}</h2>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar">
                            <i className="bx bx-search"></i>
                            <input type="text" placeholder="Search data..." />
                        </div>
                        <button className="icon-btn action-badge"><i className="bx bx-bell"></i></button>
                        <div className="ft-avatar">
                            <img src="https://ui-avatars.com/api/?name=Admin+User&background=0D1B2A&color=fff" alt="User" />
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