// app/index.tsx
import { Redirect, type Href } from 'expo-router';

const PERMISSIONS_ROUTE = '/screens/PermissionsScreen' as Href;

export default function Index() {
  return <Redirect href={PERMISSIONS_ROUTE} />;
}
