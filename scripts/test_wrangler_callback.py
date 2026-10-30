import contextlib
import io
import unittest
from unittest.mock import MagicMock, patch
import wrangler_callback as callback


class CallbackTests(unittest.TestCase):
    def test_exact_callback_retains_state_for_wrangler_validation(self):
        self.assertEqual(callback.callback_target("http://localhost:8976/oauth/callback?code=fictional&state=fictional-state"), "/oauth/callback?code=fictional&state=fictional-state")

    def test_rejects_external_targets_and_malformed_callbacks(self):
        for value in ["http://evil.example:8976/oauth/callback?code=x&state=y", "http://localhost:8976@evil.example/oauth/callback?code=x&state=y", "https://localhost:8976/oauth/callback?code=x&state=y", "http://localhost:8977/oauth/callback?code=x&state=y", "http://localhost:8976/other?code=x&state=y", "http://localhost:8976/oauth/callback?code=x", "http://localhost:8976/oauth/callback?code=x&code=z&state=y", "http://localhost:8976/oauth/callback?code=x&state=y#fragment", "http://localhost:8976/oauth/callback?code=x&state=y\r\n"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                callback.callback_target(value)

    @patch("wrangler_callback.sys.stdin.isatty", return_value=True)
    @patch("wrangler_callback.getpass.getpass", return_value="http://localhost:8976/oauth/callback?code=fictional&state=fictional-state")
    @patch("wrangler_callback.http.client.HTTPConnection")
    def test_loopback_only_no_secret_output(self, connection, prompt, tty):
        connection.return_value.getresponse.return_value.status = 307
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(callback.main(), 0)
        connection.assert_called_once_with("localhost", 8976, timeout=30)
        connection.return_value.request.assert_called_once_with("GET", "/oauth/callback?code=fictional&state=fictional-state", headers={"Host": "localhost:8976"})
        connection.return_value.close.assert_called_once()
        self.assertNotIn("fictional", output.getvalue())

    @patch("wrangler_callback.sys.stdin.isatty", return_value=False)
    @patch("wrangler_callback.getpass.getpass")
    def test_no_noninteractive_echo_fallback(self, prompt, tty):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(callback.main(), 1)
        prompt.assert_not_called()


if __name__ == "__main__":
    unittest.main()
