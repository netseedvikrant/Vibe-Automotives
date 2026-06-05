import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, Loader2, Car, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Design Engineer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleAuth = async (e) => {
    e.preventDefault();
    console.log('AutoDev: Login Form Submitted');
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        console.log('AutoDev: Attempting Sign Up for:', email);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (authError) {
          console.error('AutoDev: Sign Up Auth Error:', authError);
          throw authError;
        }

        if (authData.user) {
          console.log('AutoDev: Auth user created, updating profile...');
          const dbRole = role === 'CEO' ? 'Admin' : role;
          const { error: profileError } = await supabase
            .from('users')
            .upsert({
              id: authData.user.id,
              full_name: fullName,
              email: email,
              role: dbRole,
              plant_location: 'Detroit Assembly'
            }, { onConflict: 'email' });
          
          if (profileError) {
            console.error('AutoDev: Profile Insertion Error:', profileError);
            throw profileError;
          }
          alert('Account created! You can now login.');
          setIsSignUp(false);
        }
      } else {
        console.log('AutoDev: Attempting Login for:', email);
        const { data, error: loginError } = await login(email, password);
        console.log('AutoDev: Login response received:', { hasData: !!data, hasError: !!loginError });
        if (loginError) {
          console.error('AutoDev: Login Error Details:', loginError);
          throw loginError;
        }
      }
    } catch (err) {
      console.error('AutoDev: Auth Catch Block Error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      console.log('AutoDev: Auth process finished, setting loading to false.');
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert('Security protocol: Contact system administrator for key reset.');
  };

  return (
    <div className="login-container">
      <motion.div 
        className="login-card glass-dark glow-border"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="login-header">
          <div className="login-logo">
            <Car size={32} />
          </div>
          <h1>{isSignUp ? 'Create Portal Account' : 'AutoDev Portal'}</h1>
          <p>{isSignUp ? 'Join the automotive engineering network' : 'Enterprise Program Management System'}</p>
        </div>

        <form onSubmit={handleAuth} className="login-form">
          {error && <div className="login-error flex-center"><Shield size={16} /> {error}</div>}
          
          {isSignUp && (
            <>
              <div className="input-group">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
              <div className="input-group">
                <Shield size={18} className="input-icon" />
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="role-select"
                >
                  <option>Program Manager</option>
                  <option>Lead Engineer</option>
                  <option>Chief Engineer</option>
                  <option>Design Engineer</option>
                  <option>Validation Engineer</option>
                  <option>Quality Engineer</option>
                  <option>Manufacturing Engineer</option>
                  <option>Procurement Engineer</option>
                  <option>Supplier Engineer</option>
                  <option>CEO</option>
                  <option>Admin</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input 
              type="email" 
              placeholder="Corporate Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              placeholder="Security Key / Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          {!isSignUp && (
            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" /> Remember Session
              </label>
              <button type="button" onClick={handleForgotPassword} className="forgot-link">Forgot Key?</button>
            </div>
          )}

          <button type="submit" className="login-btn flex-center" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Register Account' : 'Authenticate Access')}
          </button>

          <button 
            type="button" 
            className="toggle-auth-btn"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Already have an account? Login' : 'Request Access / Create Account'}
          </button>
        </form>

        <div className="login-footer">
          <p>Protected by AutoDev Quantum Security. Unauthorized access is strictly prohibited and monitored.</p>
        </div>
      </motion.div>
      <div className="technical-bg"></div>
    </div>
  );
};

export default LoginPage;
