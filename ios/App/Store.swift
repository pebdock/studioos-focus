import SwiftUI
#if LIVE
import ActivityKit
#endif

@MainActor
final class Store: ObservableObject {
    static let shared = Store()
    @Published private(set) var block = Block()
    @Published var error: String?
    private var readable = true
    private let file: URL
    #if LIVE
    private var refresh: Task<Void, Never>?
    #endif

    init() {
        file = URL.applicationSupportDirectory.appending(path: "focus-v1.json")
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: file.path) {
                block = try JSONDecoder().decode(Block.self, from: Data(contentsOf: file))
            }
        } catch {
            readable = false
            self.error = "Apertura archivio non riuscita. Riapri l’app per riprovare."
        }
    }

    @discardableResult
    func change(_ edit: (inout Block) -> Void) -> Bool {
        guard readable else { error = "Archivio non disponibile."; return false }
        var next = block
        edit(&next)
        guard next != block else { return true }
        do {
            try JSONEncoder().encode(next).write(to: file, options: .atomic)
            block = next
            reconcile()
            return true
        } catch {
            self.error = "Salvataggio non riuscito. Riprova."
            return false
        }
    }

    func reconcile() {
        #if LIVE
        let previous = refresh
        refresh = Task {
            await previous?.value
            guard readable else { return }
            let current = block
            let activities = Activity<FocusAttributes>.activities
            let existing = activities.first(where: { $0.attributes.title == String(current.title.prefix(120)) })
            for activity in activities where activity.id != existing?.id {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            guard [.paused, .running].contains(current.phase) else {
                await existing?.end(nil, dismissalPolicy: .immediate)
                return
            }
            let state = FocusAttributes.ContentState(deadline: current.deadline, seconds: Int(ceil(current.remaining(at: .now))))
            let content = ActivityContent(state: state, staleDate: nil)
            if let existing {
                await existing.update(content)
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                do {
                    _ = try Activity.request(attributes: FocusAttributes(title: String(current.title.prefix(120))), content: content)
                } catch { self.error = "Live Activity non disponibile. Il blocco è salvato nell’app." }
            }
        }
        #endif
    }
}
