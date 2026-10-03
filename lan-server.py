#!/usr/bin/env python3
"""Local HTTPS server helper for the Attendance PWA.
Run: python lan-server.py
Then open https://<PC-IP>:8443 on the phone.
This script creates a self-signed certificate for the local IP.
For a true PWA install, the certificate/CA must be trusted by the phone.
"""
import http.server, ssl, socket, subprocess, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CERT = ROOT / 'lan-cert.pem'
KEY = ROOT / 'lan-key.pem'
PORT = 9443


def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

ip = local_ip()
if not CERT.exists() or not KEY.exists():
    print('Generating a temporary self-signed certificate for', ip)
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
        import datetime

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, ip),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5))
            .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30))
            .add_extension(
                x509.SubjectAlternativeName([x509.IPAddress(__import__('ipaddress').ip_address(ip))]),
                critical=False,
            )
            .sign(private_key, hashes.SHA256())
        )
        KEY.write_bytes(private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ))
        CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    except ImportError:
        raise SystemExit(
            'Missing dependency: cryptography\n'
            'Run: python -m pip install cryptography\n'
            'Then run: python lan-server.py'
        )

os.chdir(ROOT)
server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), http.server.SimpleHTTPRequestHandler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)
server.socket = ctx.wrap_socket(server.socket, server_side=True)
print(f'Open on the phone: https://{ip}:{PORT}/')
print('Keep this window running while doing the initial PWA installation.')
server.serve_forever()
