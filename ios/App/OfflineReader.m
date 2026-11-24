#import "OfflineReader.h"
#import <WebKit/WebKit.h>

@interface OfflineReader () <WKNavigationDelegate>
@property(nonatomic, strong) WKWebView *web;
@property(nonatomic, copy) NSArray<NSDictionary *> *rows;
@end

@implementation OfflineReader
- (instancetype)initWithPage:(NSString *)page rows:(NSArray<NSDictionary *> *)rows {
    self = [super initWithFrame:CGRectZero];
    if (self) {
        _rows = [rows copy];
        _web = [[WKWebView alloc] initWithFrame:self.bounds];
        _web.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        _web.navigationDelegate = self;
        [self addSubview:_web];
        NSURL *root = [NSBundle.mainBundle URLForResource:@"Offline" withExtension:nil];
        if (root) {
            [_web loadFileURL:[root URLByAppendingPathComponent:page] allowingReadAccessToURL:root];
        }
    }
    return self;
}

- (void)webView:(WKWebView *)web decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    handler(action.request.URL.isFileURL ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}

- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {
    if ([web.URL.lastPathComponent isEqualToString:@"viaggi.html"]) {
        [web callAsyncJavaScript:@"window.index = Object.fromEntries(rows.map(b => [b.id,b]));"
                       arguments:@{@"rows": self.rows}
                         inFrame:nil
                  inContentWorld:WKContentWorld.pageWorld
               completionHandler:nil];
    }
}
@end
