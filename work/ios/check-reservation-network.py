"""Anonymous read-only network comparison. Never stores bodies, cookies or redirect queries."""
import concurrent.futures
import json
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

HOSTS = ('seatbookings.xjtlu.edu.cn', 'roombookings.xjtlu.edu.cn', 'uim.xjtlu.edu.cn')

class SchoolRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, url):
        target = urllib.parse.urlsplit(url)
        if target.scheme != 'https' or not (target.hostname or '').endswith('.xjtlu.edu.cn'):
            return None
        return super().redirect_request(request, fp, code, message, headers, url)

def probe(host):
    result = {'host': host}
    start = time.monotonic()
    try:
        result['addresses'] = sorted({row[4][0] for row in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SchoolRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
        request = urllib.request.Request('https://' + host + '/', headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'})
        with opener.open(request, timeout=8) as response:
            result.update(status=response.status, final_host=urllib.parse.urlsplit(response.url).hostname)
    except urllib.error.HTTPError as error:
        result.update(status=error.code, final_host=urllib.parse.urlsplit(error.url).hostname)
    except Exception as error:
        reason = getattr(error, 'reason', error)
        result['error'] = type(reason).__name__
    result['seconds'] = round(time.monotonic() - start, 2)
    return result

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        print(json.dumps(list(pool.map(probe, HOSTS)), ensure_ascii=False, indent=2))
