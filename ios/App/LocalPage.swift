import SwiftUI
import WebKit

struct LocalPage: UIViewRepresentable {
    let path: String
    var blocks: [PlannedBlock] = []

    final class Coordinator: NSObject, WKNavigationDelegate {
        let rows: [[String: Any]]
        init(_ blocks: [PlannedBlock]) {
            rows = blocks.enumerated().map { offset, b in
                ["id": b.id, "row": offset + 6, "date": b.date, "from": b.from, "to": b.to, "mat": b.mat,
                 "min": b.min, "stato": b.stato, "fatti": b.fatti, "cons": b.cons]
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(action.request.url?.isFileURL == true ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard webView.url?.lastPathComponent == "viaggi.html" else { return }
            webView.callAsyncJavaScript("window.index = Object.fromEntries(rows.map(b => [b.id,b]));",
                                        arguments: ["rows": rows], in: nil, in: .page, completionHandler: nil)
        }
    }
    func makeCoordinator() -> Coordinator { Coordinator(blocks) }
    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView()
        web.navigationDelegate = context.coordinator
        if let root = Bundle.main.url(forResource: "Offline", withExtension: nil) {
            web.loadFileURL(root.appending(path: path), allowingReadAccessTo: root)
        }
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
