import { BrowserRouter as Router, Routes, Route ,Navigate  } from "react-router-dom";
import './App.css';
// import ChatApp from "./Component/AllChat";
import RegisterForm from './Auth/register';
import LoginForm from "./Auth/login";
import ProtectedRoute from "./Auth/ProtectedRoute";
import HomePage from "./pages/Home";


// import Header from "./Component/Header";

export default function App() {

  return (
    <Router>
      <Routes>
        <Route path="/chat" element={<ProtectedRoute><HomePage/></ProtectedRoute>} />
        <Route path="/login" element={<LoginForm/>} />
        <Route path="/register" element={<RegisterForm />} />
                <Route path="*" element={<Navigate to="/register" />} />

      </Routes>
    </Router>
  );
} 