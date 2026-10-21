package cn.local.ams;

import java.net.URI;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** URL policy shared by the main page, popups and payment handoff. No session extraction. */
final class SportsNavigation {
    static final String HOST = "sportscentre.xipueduinno.cn";
    private static final String ROOT = "https://" + HOST + "/website/";

    static boolean official(String value) {
        try {
            URI u = new URI(value);
            String rawPath = u.getRawPath();
            String path = decodeOfficialPath(rawPath);
            return "https".equalsIgnoreCase(u.getScheme()) && HOST.equalsIgnoreCase(u.getHost())
                && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443)
                && path != null && u.normalize().getRawPath().equals(rawPath)
                && ("/website".equals(path) || path.startsWith("/website/"))
                && safePathSegments(path);
        } catch (Exception e) { return false; }
    }

    /** Decode safe path characters while rejecting encoded separators, delimiters and traversal. */
    private static String decodeOfficialPath(String rawPath) throws Exception {
        if (rawPath == null) return null;
        StringBuilder decoded = new StringBuilder(rawPath.length());
        for (int i = 0; i < rawPath.length();) {
            char c = rawPath.charAt(i);
            if (c != '%') {
                int codePoint = rawPath.codePointAt(i);
                if (codePoint == '\\' || Character.isISOControl(codePoint)) return null;
                decoded.appendCodePoint(codePoint);
                i += Character.charCount(codePoint);
                continue;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            while (i < rawPath.length() && rawPath.charAt(i) == '%') {
                if (i + 2 >= rawPath.length()) return null;
                int high = Character.digit(rawPath.charAt(i + 1), 16);
                int low = Character.digit(rawPath.charAt(i + 2), 16);
                if (high < 0 || low < 0) return null;
                bytes.write((high << 4) | low);
                i += 3;
            }
            String part = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
            for (int offset = 0; offset < part.length();) {
                int codePoint = part.codePointAt(offset);
                if (!safeEncodedPathCharacter(codePoint)) return null;
                decoded.appendCodePoint(codePoint);
                offset += Character.charCount(codePoint);
            }
        }
        return decoded.toString();
    }

    private static boolean safeEncodedPathCharacter(int codePoint) {
        if (Character.isISOControl(codePoint) || codePoint == '/' || codePoint == '\\'
            || codePoint == '%' || codePoint == '?' || codePoint == '#') return false;
        if (codePoint < 128) return Character.isLetterOrDigit(codePoint) || "-._~".indexOf(codePoint) >= 0;
        int type = Character.getType(codePoint);
        return Character.isLetterOrDigit(codePoint) || type == Character.NON_SPACING_MARK
            || type == Character.COMBINING_SPACING_MARK || type == Character.ENCLOSING_MARK;
    }

    private static boolean safePathSegments(String path) {
        String[] segments = path.split("/", -1);
        for (int i = 0; i < segments.length; i++) {
            if (".".equals(segments[i]) || "..".equals(segments[i])) return false;
            if (i > 1 && i < segments.length - 1 && segments[i].isEmpty()) return false;
        }
        return true;
    }

    static boolean payment(String value) {
        try {
            URI u = new URI(value); String h = u.getHost();
            if (!"https".equalsIgnoreCase(u.getScheme()) || h == null || u.getRawUserInfo() != null
                || (u.getPort() != -1 && u.getPort() != 443)) return false;
            h = h.toLowerCase(Locale.ROOT);
            return h.equals("wx.tenpay.com") || h.equals("payapp.weixin.qq.com")
                || h.equals("alipay.com") || h.endsWith(".alipay.com");
        } catch (Exception e) { return false; }
    }

    static boolean app(String value) {
        try {
            URI u = new URI(value); String scheme = u.getScheme(); String host = u.getHost(); String path = u.getRawPath();
            if (scheme == null || host == null || path == null || u.getRawUserInfo() != null
                || u.getPort() != -1 || u.getRawFragment() != null || path.indexOf('%') >= 0
                || !u.normalize().getRawPath().equals(path)) return false;
            scheme = scheme.toLowerCase(Locale.ROOT); host = host.toLowerCase(Locale.ROOT);
            return ("weixin".equals(scheme) && "wap".equals(host) && "/pay".equals(path))
                || ("alipays".equals(scheme) && "platformapi".equals(host) && "/startapp".equals(path));
        } catch (Exception e) { return false; }
    }

    static boolean externalHttpsPrompt(String source, String target, boolean gesture) {
        if (!gesture || !official(source)) return false;
        try {
            URI u = new URI(target);
            return "https".equalsIgnoreCase(u.getScheme()) && u.getHost() != null
                && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443);
        } catch (Exception e) { return false; }
    }

    /** Returns a safe section URL, never a transaction endpoint or a URL carrying parameters. */
    static String safeRetryUrl(String value) {
        if (!official(value)) return ROOT + "court";
        try {
            URI u = new URI(value);
            if (u.getRawQuery() != null) return ROOT + "court";
            switch (decodeOfficialPath(u.getRawPath())) {
                case "/website/order": return ROOT + "order#/";
                case "/website/member": return ROOT + "member#/ticket";
                default: return ROOT + "court";
            }
        } catch (Exception e) { return ROOT + "court"; }
    }

    static boolean trusted(String value) { return official(value) || payment(value); }
}
