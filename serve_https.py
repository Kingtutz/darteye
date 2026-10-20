"""Serve DartEye over HTTPS on the local network, so iPad Safari allows camera access.

Creates a self-signed certificate for this PC's LAN address (recreated if the address changes).
Install it on the iPad once from https://<pc-ip>:8443/darteye.crt (or http://<pc-ip>:8123/darteye.crt).

    python serve_https.py [port]
"""
import datetime
import functools
import ipaddress
import os
import socket
import ssl
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

ROOT = os.path.dirname(os.path.abspath(__file__))
CERT = os.path.join(ROOT, "darteye.crt")
KEY = os.path.join(ROOT, "darteye.key")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8443


def lan_ips():
    ips = set()
    try:  # the address used to reach the internet is the Wi-Fi/LAN one
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
        ip = info[4][0]
        if not ip.startswith(("127.", "169.254.")):
            ips.add(ip)
    return sorted(ips)


def cert_covers(ips):
    if not (os.path.exists(CERT) and os.path.exists(KEY)):
        return False
    cert = x509.load_pem_x509_certificate(open(CERT, "rb").read())
    if cert.not_valid_after_utc < datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7):
        return False
    have = {str(i) for i in cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress)}
    return set(ips) <= have


def make_cert(ips):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "DartEye local server"),
                      x509.NameAttribute(NameOID.ORGANIZATION_NAME, "DartEye")])
    now = datetime.datetime.now(datetime.timezone.utc)
    san = [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    san += [x509.IPAddress(ipaddress.ip_address(ip)) for ip in ips]
    cert = (x509.CertificateBuilder()
            .subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(minutes=5))
            .not_valid_after(now + datetime.timedelta(days=800))  # iOS rejects TLS certs valid > 825 days
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, key_encipherment=True, key_cert_sign=True,
                                         content_commitment=False, data_encipherment=False, key_agreement=False,
                                         crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.SubjectAlternativeName(san), critical=False)
            .sign(key, hashes.SHA256()))
    open(KEY, "wb").write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                            serialization.NoEncryption()))
    open(CERT, "wb").write(cert.public_bytes(serialization.Encoding.PEM))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".crt": "application/x-x509-ca-cert"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always get the latest app after edits
        super().end_headers()

    def send_head(self):
        if os.path.basename(self.path.split("?")[0]) == "darteye.key":
            self.send_error(404)  # never hand out the private key
            return None
        return super().send_head()


def main():
    ips = lan_ips()
    if "--http" in sys.argv:  # plain HTTP (no camera on iPad), still never serves the key
        httpd = ThreadingHTTPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=ROOT))
        for ip in ips:
            print(f"DartEye (http, no camera):  http://{ip}:{PORT}/")
        sys.stdout.flush()
        httpd.serve_forever()
    if not cert_covers(ips):
        make_cert(ips)
        print("Created certificate for", ", ".join(ips))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=ROOT))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    for ip in ips:
        print(f"DartEye on your network:  https://{ip}:{PORT}/   (certificate: https://{ip}:{PORT}/darteye.crt)")
    sys.stdout.flush()
    httpd.serve_forever()


if __name__ == "__main__":
    main()
