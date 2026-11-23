import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="This page does not exist or was moved."
      action={<Link to="/" className="btn-primary">Back to overview</Link>}
    />
  );
}
