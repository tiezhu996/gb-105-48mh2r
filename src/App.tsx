import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Publish from '@/pages/Publish'
import ProductDetail from '@/pages/ProductDetail'
import Profile from '@/pages/Profile'
import UserProfile from '@/pages/UserProfile'
import { useAuthStore } from '@/store/auth'

function AppRoutes() {
  const { checkAuth } = useAuthStore()

  // 应用启动时若本地有 token，恢复登录态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/publish" element={<Publish />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/user/:id" element={<UserProfile />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}
