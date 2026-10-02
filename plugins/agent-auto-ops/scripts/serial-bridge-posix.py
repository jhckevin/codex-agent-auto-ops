#!/usr/bin/env python3
"""115200 UART bridge using only the Python standard library. No upload/reset commands."""
import argparse, array, errno, fcntl, json, os, select, sys, termios, time

def open_port(port):
    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    try:
        if hasattr(termios, "TIOCEXCL"):
            fcntl.ioctl(fd, termios.TIOCEXCL)
        attrs = termios.tcgetattr(fd)
        attrs[0] = attrs[1] = attrs[3] = 0
        attrs[2] = termios.CLOCAL | termios.CREAD | termios.CS8
        attrs[4] = attrs[5] = termios.B115200
        attrs[6][termios.VMIN] = attrs[6][termios.VTIME] = 0
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
        try:
            fcntl.ioctl(fd, termios.TIOCMBIC, array.array("i", [termios.TIOCM_DTR | termios.TIOCM_RTS]))
        except OSError as error:
            if error.errno not in (errno.ENOTTY, errno.EINVAL):
                raise
        return fd
    except Exception:
        os.close(fd)
        raise

def transact(fd, raw, timeout=4.5):
    if len(raw) > 8000 or not raw.endswith(b"\n"):
        raise ValueError("Request exceeds wire bound")
    request = json.loads(raw)
    termios.tcflush(fd, termios.TCIFLUSH)
    end = time.monotonic() + timeout
    remaining = memoryview(raw)
    while remaining:
        if not select.select([], [fd], [], max(0, end-time.monotonic()))[1]:
            raise TimeoutError("Serial write timeout; outcome unknown")
        remaining = remaining[os.write(fd, remaining):]
    data = b""
    while time.monotonic() < end:
        if not select.select([fd], [], [], max(0, end-time.monotonic()))[0]:
            break
        chunk = os.read(fd, 8192)
        if not chunk:
            raise OSError("Serial disconnected; outcome unknown")
        data += chunk
        if len(data) > 32768:
            raise ValueError("Serial reply exceeds bound")
        while b"\n" in data:
            line, data = data.split(b"\n", 1)
            if not line.startswith(b"@cua "):
                continue
            reply = json.loads(line[5:])
            if reply.get("op") == request.get("op") and reply.get("seq", 0) == request.get("seq", 0):
                return reply
    raise TimeoutError("No matching adapter acknowledgement; outcome unknown")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    args=parser.parse_args()
    fd=None
    try:
        fd=open_port(args.port)
        while True:
            raw=sys.stdin.buffer.readline(8002)
            if not raw:
                break
            print(json.dumps(transact(fd, raw), separators=(",", ":")), flush=True)
    except Exception as error:
        print(json.dumps({"bridge_error": str(error)}), flush=True)
        return 1
    finally:
        if fd is not None:
            os.close(fd)
    return 0

if __name__ == "__main__":
    sys.exit(main())
