"""Local dev server for Haven Hub: serves the repo root with caching off, so ?demo=1 always runs the latest files.
    python dev/serve.py            →  http://localhost:5178/docs/?demo=1
"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.gs': 'text/plain'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
    print(f'Haven Hub dev server: http://localhost:{port}/docs/?demo=1')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
