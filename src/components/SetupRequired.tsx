import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

export function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Backend Setup Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            This app is configured to run without demo data. Please point it to your backend API and WebSocket server.
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Create a <code>.env</code> file (or set environment variables) with:
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
{`VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000`}
              </pre>
            </li>
            <li>
              Rebuild the app after setting env vars.
            </li>
            <li>
              Make sure you can access <code>${'{VITE_API_URL}'}</code> <code>/health</code> and that your auth/login is configured.
            </li>
          </ol>
          <div className="pt-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
