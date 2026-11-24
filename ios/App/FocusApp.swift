import AppIntents
import SwiftUI

struct StudyIntent: AppIntent {
    static var title: LocalizedStringResource = "Avvia o riprendi lo studio"
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult & ProvidesDialog {
        let store = Store.shared
        guard store.block.configured && store.block.phase != .finished else {
            return .result(dialog: "Prepara un blocco in STUDIOOS Focus.")
        }
        guard store.change({ $0.start(at: .now) }) else { return .result(dialog: "Archivio non disponibile.") }
        return .result(dialog: "Blocco in corso.")
    }
}

struct Shortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StudyIntent(), phrases: ["Avvia lo studio con \(.$applicationName)"], shortTitle: "Avvia lo studio", systemImageName: "timer")
    }
}

@main
struct FocusApp: App {
    @StateObject private var store = Store.shared
    @Environment(\.scenePhase) var scene
    var body: some Scene {
        WindowGroup {
            FocusView(store: store)
                .onAppear { store.reconcile() }
                .onChange(of: scene) { _, phase in
                    if phase == .active { store.reconcile() }
                }
        }
    }
}
