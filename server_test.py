"""HTTP checks use a temporary loopback port and shut the server down afterwards."""
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from serve import GameHandler

class QuietHandler(GameHandler):
    def log_message(self, *args):
        pass

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_game_assets_and_preview_load(self):
        for path in ['/', '/game.js?v=test', '/save-validation.js', '/preview/model-yard.html']:
            with self.subTest(path=path), urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)
                self.assertGreater(len(response.read()), 0)

    def test_private_paths_and_directory_listings_are_blocked(self):
        for path in ['/.git/config', '/.env', '/docs/', '/preview/', '/serve.py', '/campaign.test.cjs', '/../.git/config', '/%2e%2e/.git/config']:
            with self.subTest(path=path), self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(self.base + path)
            self.assertEqual(caught.exception.code, 404)

    def test_browser_headers_block_inline_script_and_stale_development_assets(self):
        with urllib.request.urlopen(self.base + '/') as response:
            self.assertIn("script-src 'self';", response.headers['Content-Security-Policy'])
            self.assertIn("frame-ancestors 'none'", response.headers['Content-Security-Policy'])
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
            self.assertEqual(response.headers['Cache-Control'], 'no-store')

if __name__ == '__main__':
    unittest.main()
