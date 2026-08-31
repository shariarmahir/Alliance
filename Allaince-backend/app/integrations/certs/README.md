# Bundled intermediate certificates

`globalsign-gcc-r3-dv-tls-ca-2020.pem` is GlobalSign's *GCC R3 DV TLS CA 2020*
intermediate.

It is here because www.cse.com.bd serves an incomplete certificate chain: it
presents only its leaf certificate and omits this intermediate, so a strict
client fails with `CERTIFICATE_VERIFY_FAILED` / "unable to verify the first
certificate" (OpenSSL code 21). Browsers and curl paper over this by fetching
the missing link themselves; httpx does not.

Supplying the intermediate alongside certifi's roots completes the chain and
keeps full verification on, which is the point -- the alternative fix people
reach for is `verify=False`, and that would silently accept *any* certificate
for the host we are scraping.

This is a CSE server misconfiguration. If they ever fix it, this file becomes
redundant but harmless. Replace it if GlobalSign rotates the intermediate:

    curl http://secure.globalsign.com/cacert/gsgccr3dvtlsca2020.crt \
      | openssl x509 -inform DER -out globalsign-gcc-r3-dv-tls-ca-2020.pem
