import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  // console.log(token)
  if (!token) {
    return <Navigate to="/register" />;
  }
  return children;
}

export default ProtectedRoute;
