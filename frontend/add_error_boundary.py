import os

filepath = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\pages\SuperAdminDashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Let's insert a simple ErrorBoundary at the top of the file
error_boundary_code = """
class ErrorBoundary extends React.Component<any, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 font-mono whitespace-pre-wrap bg-red-50 border border-red-200 rounded">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.toString()}</p>
          <p>{this.state.error?.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
"""

# add it after imports
content = content.replace("export default function SuperAdminDashboard() {", error_boundary_code + "\nexport default function SuperAdminDashboard() {")

# Wrap the tabs area in ErrorBoundary
content = content.replace("{activeTab === 'announcements' && <SystemAnnouncementTab />}", "{activeTab === 'announcements' && <ErrorBoundary><SystemAnnouncementTab /></ErrorBoundary>}")
content = content.replace("{activeTab === 'logs' && <AuditLogTab />}", "{activeTab === 'logs' && <ErrorBoundary><AuditLogTab /></ErrorBoundary>}")
content = content.replace("{activeTab === 'tickets' && <SupportTicketTab />}", "{activeTab === 'tickets' && <ErrorBoundary><SupportTicketTab /></ErrorBoundary>}")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Added ErrorBoundary!")
