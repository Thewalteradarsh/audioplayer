import { NavLink } from 'react-router-dom';
import { Home, Search, Library } from 'lucide-react';

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-white/10 flex items-center justify-around px-4 z-50">
      <NavItem to="/" icon={<Home size={22} />} label="Home" />
      <NavItem to="/search" icon={<Search size={22} />} label="Search" />
      <NavItem to="/library" icon={<Library size={22} />} label="Library" />
    </nav>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-1.5 px-4 rounded-xl transition-all active:scale-95 ${
        isActive ? 'text-primary' : 'text-grayText hover:text-white'
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </NavLink>
  );
}
