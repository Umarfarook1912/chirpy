import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Building2,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { ROUTES } from '../../../constants/routes.constants';
import styles from './Sidebar.module.scss';

const NAV_ITEMS = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Meetings', to: ROUTES.MEETINGS.LIST, icon: Video },
  { label: 'Organization', to: ROUTES.ORGANIZATION, icon: Building2 },
  { label: 'Reports', to: ROUTES.REPORTS, icon: BarChart3 },
  { label: 'Settings', to: ROUTES.SETTINGS, icon: Settings },
];

export interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandLogo}>C</span>
        <span className={styles.brandName}>Chirpy</span>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        <ul className={styles.navList} role="list">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button className={styles.logoutButton} onClick={onLogout} type="button">
        <LogOut size={18} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </aside>
  );
}
