import ActivityKit
import Foundation

struct FocusAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var deadline: Date?
        var seconds: Int
    }
    let title: String
}
