#!/usr/bin/env python3
"""Dev server for The Nightstand — serves the app with no-cache headers so the
browser always loads the latest files (no stale-cache gremlins while we build)."""
import http.server
import socketserver

PORT = 8123
DIRECTORY = "/Users/chelseatomlinson/Reading Genie"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"The Nightstand dev server (no-cache) → http://127.0.0.1:{PORT}")
    httpd.serve_forever()
