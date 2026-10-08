"""Loopback-only development server for Living Frontiers; no third-party packages."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse

ROOT = Path(__file__).resolve().parent
FILES = {
    'index.html', 'styles.css', 'fog.js', 'projection.js', 'ground-detail.js',
    'simulation.js', 'geography.js', 'terrain-art.js', 'terrain.js', 'world.js',
    'territory.js', 'save-validation.js', 'campaign.js', 'models.js', 'game.js',
    'multiplayer-client.js','peer-session.js','peer-host-worker.js','multiplayer-match.js',
    'preview/visual-lab.html', 'preview/visual-lab.css', 'preview/visual-lab.js',
    'preview/model-yard.html', 'preview/model-yard.css', 'preview/model-yard.js',
    'docs/model-art-pass.md', 'docs/seeded-terrain.md', 'docs/visual-research.md',
    'docs/security-reliability-audit.md', 'docs/online-play.md',
}
CSP = ("default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; "
       "form-action 'none'; frame-ancestors 'none'")

class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        name = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        target = (ROOT / name).resolve()
        if name not in FILES or not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404, 'Not a game asset')
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(('127.0.0.1', args.port), GameHandler) as server:
        print(f'Living Frontiers: http://127.0.0.1:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
