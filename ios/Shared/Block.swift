import Foundation

struct Block: Codable, Equatable {
    enum Phase: String, Codable { case ready, running, paused, finished }
    var title = ""
    var outline = ""
    var materials = ""
    var criterion = ""
    var minutes = 25
    var checked = Set<Int>()
    var phase = Phase.ready
    var deadline: Date?
    var pausedSeconds: TimeInterval = 0

    var steps: [String] { outline.split(separator: "\n").map(String.init) }
    var configured: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !criterion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func remaining(at date: Date) -> TimeInterval {
        switch phase {
        case .ready: return Double(minutes * 60)
        case .running: return max(0, deadline?.timeIntervalSince(date) ?? 0)
        case .paused: return pausedSeconds
        case .finished: return 0
        }
    }

    mutating func start(at date: Date) {
        guard configured, phase == .ready || phase == .paused else { return }
        let seconds = remaining(at: date)
        deadline = date.addingTimeInterval(seconds)
        phase = .running
    }

    mutating func pause(at date: Date) {
        guard phase == .running else { return }
        pausedSeconds = remaining(at: date)
        deadline = nil
        phase = .paused
    }

    mutating func finish() {
        guard phase == .paused || phase == .running else { return }
        phase = .finished
        deadline = nil
    }
}
