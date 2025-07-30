import Logo from '../logo.png';
import ProfilePicture from '../profile.png';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
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
    padding: '7px 15px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #ddd',
  };

  const logoStyle = {
    width: '60PX',
    height: '50PX',
  };

  const profilePictureStyle = {
    width: '60px',
    height: '50px',
  };

  const titleStyle = {
    fontSize: '2vw',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 1px',
  };

  const linkContainer = {

    display: 'flex',
    fontSize: '1.2vw',
    gap: '20px',
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
       
      </div>
       <img
          style={{ ...profilePictureStyle, cursor: 'pointer' }}
          onClick={handleLogout}
          src={ProfilePicture}
          alt="profile"
        />
    </nav>
  );
}
