import ErrorScreen from '../components/ErrorScreen';
import { isSubdomain } from '../hooks/useTenant';

export default function NotFoundPage() {
  return (
    <ErrorScreen
      variant="404"
      eyebrow="Error 404"
      title="Oops, wrong turn"
      body="This road doesn't lead anywhere. The link might be old, or there's a typo in it. Let's get you back on track."
      actions={[
        { label: 'Take me home', to: '/' },
        { label: 'Browse all cars', to: isSubdomain() ? '/cars' : '/showroom' },
      ]}
    />
  );
}
