import http.server
import socketserver

PORT = 3002

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Redirect index.html and root request / to direct-login.html
        if self.path == '/' or self.path.split('?')[0] == '/index.html':
            self.send_response(302)
            self.send_header('Location', '/direct-login.html')
            self.end_headers()
            return
        
        # Otherwise serve the static files normally
        return super().do_GET()

# Ensure address reuse is enabled to prevent port lock issues on restart
socketserver.TCPServer.allow_reuse_address = True

print(f"Starting direct login gateway server on port {PORT}...")
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Server successfully launched! Access: http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.shutdown()
