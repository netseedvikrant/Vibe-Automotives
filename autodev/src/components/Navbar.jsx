import { Search, Bell, Moon, Plus, Factory, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = ({ setShowCreateModal }) => {
  const { profile, logout } = useAuth();
  const isProgramManager = profile?.role === 'Program Manager';

  return (
    <nav className="navbar glass-dark">
      <div className="nav-left">
        <div className="search-wrapper glass">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search programs, parts, or engineering documents..." />
          <div className="search-shortcut">⌘K</div>
        </div>
      </div>

      <div className="nav-right">
        <div className="plant-selector glass">
          <Factory size={16} className="text-accent" />
          <span className="plant-name">{profile?.plant_location || 'Global Headquarters'}</span>
          <ChevronDown size={14} />
        </div>

        <div className="nav-actions">
          <button className="nav-btn flex-center glass" onClick={() => logout()} title="Logout" style={{ gap: '8px', padding: '8px 16px', borderRadius: '8px', width: 'auto' }}>
            <LogOut size={18} />
            <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Logout</span>
          </button>
          
          {isProgramManager && (
            <button 
              className="create-program-btn flex-center"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              <span>New Program</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
