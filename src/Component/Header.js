import Logo from '../logo.svg';
import ProfilePicture from '../profile.png';
import { useNavigate } from 'react-router-dom';


export default function Header() {
    const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');  
    navigate('/login');                 
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #ddd',
  };

  const logoStyle = {
    width: '50px',
    height: '50px', 
  };

  const titleStyle = {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#333',
  };

  return (
    <nav style={navStyle}>
      <img style={logoStyle} src={Logo} alt="logo" />
      <p style={titleStyle}>ChatSync</p>
      <img style={logoStyle} onClick={handleLogout} src={ProfilePicture}alt="profile" />
      
    </nav>
    
  );
}
