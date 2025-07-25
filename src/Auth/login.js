import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../css/loginUI.css'

// import './css/'

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();


  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      navigate('/chat');

      // console.log(res+"------------------------------")
      setMessage('Login Successful');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className='loginForm'>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required /><br />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required /><br />
        <button type="submit">Login</button>
      </form>
      {message && <p>{message}</p>}
      <p><Link to='/register'>Register Now</Link></p>
    </div>
  );
}

export default LoginForm;
