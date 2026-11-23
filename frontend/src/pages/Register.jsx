import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.organizationName.trim().length < 2) errs.organizationName = 'At least 2 characters';
    if (!form.name.trim()) errs.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (form.password.length < 8) errs.password = 'At least 8 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await register({
        organizationName: form.organizationName.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success('Organization created. You are the admin.');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your organization"
      subtitle="You become the admin, and a Default Team is created for you."
      footer={<>Already have an account? <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Organization name" error={errors.organizationName}>
          <input className="input" autoFocus placeholder="Acme Inc." value={form.organizationName} onChange={set('organizationName')} />
        </Field>
        <Field label="Your name" error={errors.name}>
          <input className="input" autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="Minimum 8 characters." error={errors.password}>
          <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn-primary w-full !h-10" disabled={busy}>{busy && <Spinner />} Create organization</button>
      </form>
    </AuthShell>
  );
}
