package cn.local.ams;

/** Tracks one WebView's main-document load and renderer-visible state. */
final class SportsWebLoadState {
    enum Display { LOADING, CONTENT, ERROR }

    static boolean isMainHttpError(boolean isForMainFrame, int statusCode) {
        return isForMainFrame && statusCode >= 400;
    }

    private long generation;
    private String mainDocumentUrl;
    private boolean committed;
    private boolean finished;
    private boolean preparationStarted;
    private boolean failed;
    private boolean visualReady;

    synchronized long beginNavigation(String url) {
        generation++;
        mainDocumentUrl = documentKey(url);
        committed = false;
        finished = false;
        preparationStarted = false;
        failed = false;
        visualReady = false;
        return generation;
    }

    synchronized long onPageStarted(String url) {
        String key = documentKey(url);
        if (key == null) return generation;
        if (mainDocumentUrl == null || !mainDocumentUrl.equals(key) || committed || failed) {
            return beginNavigation(url);
        }
        return generation;
    }

    /** SSL callbacks do not identify the frame; only a matching, uncommitted main URL can fail the page. */
    synchronized boolean shouldFailForSsl(String errorUrl, String currentPageUrl) {
        return !failed && !committed
            && (matchesMainDocument(errorUrl) || sameDocument(errorUrl, currentPageUrl));
    }

    synchronized boolean failMainDocument(String requestUrl) {
        return failMainDocument(requestUrl, null);
    }

    synchronized boolean failMainDocument(String requestUrl, String currentPageUrl) {
        if (failed || !(matchesMainDocument(requestUrl) || sameDocument(requestUrl, currentPageUrl))) return false;
        failed = true;
        visualReady = false;
        return true;
    }

    synchronized boolean markCommitted(String url) {
        if (failed || committed || !matchesMainDocument(url)) return false;
        committed = true;
        return true;
    }

    synchronized boolean isCommitted(String url) {
        return committed && !failed && matchesMainDocument(url);
    }

    synchronized boolean markFinished(String url) {
        if (failed || !matchesMainDocument(url)) return false;
        finished = true;
        return true;
    }

    synchronized boolean isReadyForVisualPreparation(String url) {
        return committed && finished && !failed && matchesMainDocument(url);
    }

    synchronized boolean beginVisualPreparation(String url) {
        if (!isReadyForVisualPreparation(url) || preparationStarted) return false;
        preparationStarted = true;
        return true;
    }

    synchronized boolean isCurrent(long expectedGeneration, String url) {
        return generation == expectedGeneration && !failed && matchesMainDocument(url);
    }

    synchronized boolean markVisualReady(long expectedGeneration, String url) {
        if (!isCurrent(expectedGeneration, url) || !isReadyForVisualPreparation(url)) return false;
        visualReady = true;
        return true;
    }

    synchronized boolean isContentReady() {
        return !failed && visualReady;
    }

    synchronized boolean isFailed() {
        return failed;
    }

    synchronized long generation() {
        return generation;
    }

    synchronized Display display() {
        if (failed) return Display.ERROR;
        return visualReady ? Display.CONTENT : Display.LOADING;
    }

    private boolean matchesMainDocument(String url) {
        return sameDocument(url, mainDocumentUrl);
    }

    private static boolean sameDocument(String first, String second) {
        String firstKey = documentKey(first);
        String secondKey = documentKey(second);
        return firstKey != null && firstKey.equals(secondKey);
    }

    private static String documentKey(String url) {
        if (url == null || url.isEmpty()) return null;
        int fragment = url.indexOf('#');
        return fragment < 0 ? url : url.substring(0, fragment);
    }
}
