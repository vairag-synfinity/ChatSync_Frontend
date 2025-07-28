import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import RegisterForm from './Auth/register';
import LoginForm from "./Auth/login";
import ProtectedRoute from "./Auth/ProtectedRoute";
import HomePage from "./Home"; 
import AllChat from "./Component/AllChat";
import GroupChat from "./Component/GroupChat";
// import AudioCall from "./Component/AudioCall";
import VideoCall from "./Component/VideoCall";
// import GroupAudioCall from "./Component/multiUserVoiceCall";
import GroupVideoCall from "./Component/multiUserVideoCall";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <HomePage />
      <Outlet />
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/allchat" />} />
          <Route path="/allchat" element={<AllChat />} />
          <Route path="/groupchat" element={<GroupChat />} />
          <Route path="/audiocall" element={<GroupVideoCall />} />
          <Route path="/videocall" element={<VideoCall />} />
          {/* <Route path="/groupaudiocall" element={<GroupAudioCall />} /> */}
          {/* <Route path="/groupaudiocall" element={<GroupVideoCall />} /> */}
        </Route>

        <Route path="*" element={<Navigate to="/register" />} />
      </Routes>
    </Router>
  );
}
