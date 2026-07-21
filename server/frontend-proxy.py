
import http.server, socketserver, urllib.request, urllib.parse, os, threading
from http import HTTPStatus

DIST = '/home/ubuntu/celeste-app/dist'

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.path.startswith("/api/") or self.path.startswith("/auth/"):
            return self._proxy()
        # Static
        path = self.path.split("?")[0]
        if path == "/" or path == "": path = "/index.html"
        full = os.path.join(DIST, path.lstrip("/"))
        full = os.path.normpath(full)
        if not full.startswith(DIST):
            self.send_error(403); return
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            full = os.path.join(DIST, "index.html")
        try:
            with open(full, "rb") as f:
                data = f.read()
            ctype = "text/html" if full.endswith(".html") else "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def _proxy(self):
        target_url = "http://localhost:3001" + self.path
        try:
            req = urllib.request.Request(target_url, method=self.command, headers={k:v for k,v in self.headers.items()})
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except Exception as e:
            self.send_response(502); self.send_header("Content-Type","text/plain"); self.end_headers()
            self.wfile.write(f"Proxy error: {e}".encode())

    def do_POST(self): self._proxy()
    def do_PUT(self): self._proxy()
    def do_DELETE(self): self._proxy()
    def do_OPTIONS(self): self._proxy()

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

# Dual-stack
import socket
class Dual(Server):
    address_family = socket.AF_INET6  # IPv6 + IPv4-mapped IPv6

with Dual(("::", 5174), Handler) as httpd:
    print("Celeste Python proxy on 5174", flush=True)
    httpd.serve_forever()
