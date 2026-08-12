import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import ComingSoon from './pages/ComingSoon';
import AdminReleasePage from './pages/AdminReleasePage';
import { ThemeToggle } from './components/ThemeToggle';

function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/admin/release" element={<AdminReleasePage />} />
      </Routes>
    </>
  );
}

export default App;
