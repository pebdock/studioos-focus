#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
@interface OfflineReader : UIView
- (instancetype)initWithPage:(NSString *)page rows:(NSArray<NSDictionary *> *)rows;
@end
NS_ASSUME_NONNULL_END
