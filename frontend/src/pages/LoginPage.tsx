import { LoginForm } from '../components/login/LoginForm'
import { WelcomePanel } from '../components/login/WelcomePanel'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from '../components/InstitutionalChrome'
import '../styles/drims-login.css'

export function LoginPage() {
  return (
    <div className="login-page">
      <InstitutionalHeader />

      <div className="auth-wrapper">
        <div className="background-shape" aria-hidden />
        <div className="secondary-shape" aria-hidden />
        <LoginForm />
        <WelcomePanel />
      </div>

      <InstitutionalFooter />
    </div>
  )
}

export { ForgotPasswordPage } from '../components/login/ForgotPassword'
