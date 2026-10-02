import importlib.util, json, os, pathlib, pty, threading, unittest
p=pathlib.Path(__file__).resolve().parents[1]/"plugins/agent-auto-ops/scripts/serial-bridge-posix.py"
spec=importlib.util.spec_from_file_location("bridge",p);bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
class BridgeTest(unittest.TestCase):
    def test_real_pty_framing_and_timeout(self):
        master,slave=pty.openpty();fd=bridge.open_port(os.ttyname(slave))
        try:
            def device():
                raw=b""
                while not raw.endswith(b"\n"):raw+=os.read(master,8192)
                self.assertEqual(json.loads(raw)["op"],"hello")
                os.write(master,b'log line\n@cua {"op":"heartbeat","seq":0}\n@cua {"op":"hello","seq":0,"ok":true}\n')
            thread=threading.Thread(target=device);thread.start()
            self.assertTrue(bridge.transact(fd,b'{"v":1,"op":"hello","seq":0}\n')["ok"]);thread.join()
            with self.assertRaises(TimeoutError):bridge.transact(fd,b'{"op":"hello","seq":0}\n',.05)
        finally:os.close(fd);os.close(slave);os.close(master)
if __name__=="__main__":unittest.main()
