import Logo from '../logo.svg';
import ProfilePicture from '../profile.png';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Define all route links here
  const navLinks = [
    { path: '/allchat', label: 'All Chat' },
    { path: '/groupchat', label: 'Group Chat' },
    { path: '/audiocall', label: 'Audio Call' },
    { path: '/videocall', label: 'Video Call' },
  ];

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 15px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #ddd',
  };

  const logoStyle = {
    width: '50px',
    height: '50px',
  };

  const titleStyle = {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 10px',
  };

  const linkContainer = {

    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    

    
  };

  const linkStyle = ({ isActive }) => ({
    textDecoration: 'none',
    color: isActive ? '#007bff' : '#333',
    fontWeight: isActive ? 'bold' : 'normal',
  });

  return (
    <nav style={navStyle}>
      <div style={linkContainer}>
        <img style={logoStyle} src={Logo} alt="logo" />
        <p style={titleStyle}>ChatSync</p>
      </div>

      <div style={linkContainer}>
        {navLinks.map((link) => (
          <NavLink key={link.path} to={link.path} style={linkStyle}>
            {link.label}
          </NavLink>
        ))}
        <img
          style={{ ...logoStyle, cursor: 'pointer' }}
          onClick={handleLogout}
          src={ProfilePicture}
          alt="profile"
        />
      </div>
    </nav>
  );
}
