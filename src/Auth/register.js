import { useState } from 'react';
import axios from 'axios';
import { useNavigate,Link  } from 'react-router-dom';
import '../css/registerUI.css'



function RegisterForm() {
  const [username, setUsername] = useState('');
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
    const navigate = useNavigate();


  const handleRegister = async (e) => {
    // console.log(process.env.REACT_APP_BACKEND_URL);
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, { username, gmail, password  });
     localStorage.setItem('token', res.data.token);  // Save token in localStorage
     localStorage.setItem('username', res.data.user.username);  // Save username in localStorage
    navigate('/chat'); 
      
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className='registerForm'>
      <h2 className='registerTitle' >Register</h2>
      <form className='regisretFormDetaile' onSubmit={handleRegister}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required /><br />
        <input value={gmail} onChange={(e) => setGmail(e.target.value)}  placeholder="Gmail" required /><br />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required /><br />
        <button type="submit">Register</button>
      </form>
      <spna>{message && <p>{message}</p>}</spna>
      <p> Already Have Account <Link to="/login">Go to Login</Link> </p>
    </div>
  );
}

export default RegisterForm;
