import React, { useState, KeyboardEvent } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import hpLogo from '../../assets/svg/hp.png';
import loginPageData from './loginPageData.json';
import hpclbg from '../../assets/hpcl/—Pngtree—a large oil refinery at_12816562.jpg'
import { toast } from 'sonner';
import useAuthStore from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';

function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, hasPageAccess } = useAuthStore();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("dealer");
  const [samlLoading, setSamlLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await login(credentials.username, credentials.password, loginType);
      // Get latest user state after login
      const currentUser = useAuthStore.getState().user;
      console.log("currentUser", currentUser);
      if (currentUser?.is_authenticated) {
        navigate('/dnc/home/wall');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleSamlLogin = async () => {
    try {
      setSamlLoading(true);
      console.log("Initiating SAML SSO login...");
      
      // Call the SSO auth URL endpoint
      const response = await apiClient.get('/api/users/sso_auth_url');
      
      console.log("SSO Auth URL Response:", response);
      
      // If response contains a URL, redirect to it
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else if (response.data?.redirect_url) {
        window.location.href = response.data.redirect_url;
      } else if (typeof response.data === 'string') {
        // If response is directly a URL string
        window.location.href = response.data;
      } else {
        throw new Error('No redirect URL received from server');
      }
    } catch (error) {
      console.error('SAML SSO login error:', error);
      toast.error('Failed to initiate SAML login. Please try again.');
      setSamlLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${hpclbg})`,
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative w-full max-w-lg p-16 rounded-2xl backdrop-blur-md bg-white/10 shadow-2xl border border-white/10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center mb-4 bounce-animation">
            <img
              src={hpLogo}
              alt={loginPageData.logoAlt}
            />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Enter Credentials</h2>
        </div>
        <div className="flex justify-center gap-6 mb-6">
          {["employee", "dealer"].map((type) => (
            <label
              key={type}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors duration-200
        ${loginType === type ? "bg-blue-500 bg-opacity-20 border-blue-500 text-white" : "bg-transparent border-gray-600 text-gray-300 hover:border-blue-400"}`}
            >
              <input
                type="radio"
                name="loginType"
                value={type}
                checked={loginType === type}
                onChange={(e) => setLoginType(e.target.value)}
                className="accent-blue-500"
              />
      {type === "dealer" ? "Dealer Login" : " Employee Login"}
      </label>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="Username"
              className="w-full px-4 py-4 rounded-[20px] bg-white/10 border border-white/20 text-white text-lg placeholder-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              onKeyPress={handleKeyPress}
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full px-4 py-4 rounded-[20px] bg-white/10 border border-white/20 text-white text-lg placeholder-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              onKeyPress={handleKeyPress}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-all duration-300 transform hover:scale-110"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 animate-in" />
              ) : (
                <Eye className="w-5 h-5 animate-in" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-center">
            <button
              type="submit"
              className="px-20 py-5 gradient-blue hover:opacity-90 text-white text-lg uppercase font-semibold rounded-[50px] transition duration-200 ease-in-out transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent shadow-lg flex items-center justify-center"
            >
              Login
            </button>
            {/* SAML button commented out
            {loginType === "employee" && (
              <button
                type="button"
                onClick={handleSamlLogin}
                disabled={true}
                className="min-w-[220px] px-6 py-5 bg-gray-400 cursor-not-allowed text-white text-lg uppercase font-semibold rounded-[50px] shadow-lg flex items-center justify-center opacity-50"
              >
                SAML
              </button>
            )}
            */}
          </div>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-white/80 hover:text-white transition">Forgot Password?</a>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;