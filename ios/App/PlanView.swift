import SwiftUI
import UniformTypeIdentifiers

struct PlannedBlock: Codable, Identifiable {
    let id, date, from, to, mat, arg, cons, mats, stato: String
    let min, fatti: Int
}

struct PlanExport: Codable {
    let blocks: [PlannedBlock]
}

@MainActor
final class PlanLibrary: ObservableObject {
    @Published private(set) var blocks: [PlannedBlock] = []
    @Published var message: String?
    private let file = URL.applicationSupportDirectory.appending(path: "plan-v1.json")
    init() {
        guard FileManager.default.fileExists(atPath: file.path) else { return }
        do { blocks = try JSONDecoder().decode(PlanExport.self, from: Data(contentsOf: file)).blocks }
        catch { message = "La copia del piano non è leggibile. Importa di nuovo il JSON." }
    }
    func load(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let input = try JSONDecoder().decode(PlanExport.self, from: Data(contentsOf: url))
            guard Set(input.blocks.map(\.id)).count == input.blocks.count else {
                message = "Il piano contiene identificatori duplicati."; return
            }
            try JSONEncoder().encode(input).write(to: file, options: .atomic)
            blocks = input.blocks
        } catch { message = "Importazione fallita. Scegli il JSON Piano offline di STUDIOOS." }
    }
}

struct PlanView: View {
    @ObservedObject var plan: PlanLibrary
    @ObservedObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var importing = false
    @State private var selected: PlannedBlock?
    var body: some View {
        List {
            Button("Importa piano offline (.json)") { importing = true }
            ForEach(plan.blocks) { b in
                Button {
                    selected = b
                } label: {
                    VStack(alignment: .leading) {
                        Text(b.arg.isEmpty ? b.mat : b.arg)
                        Text("\(b.date) · \(b.from) · \(b.mat) · \(b.min) min").font(.caption)
                    }
                }.disabled(store.block.phase == .running || store.block.phase == .paused || b.min <= 0)
            }
        }.navigationTitle("Piano")
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            if case let .success(url) = result { plan.load(url) }
        }
        .confirmationDialog("Usare questo blocco al posto della bozza?", isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } }), presenting: selected) { b in
            Button("Prepara il blocco") {
                guard store.block.phase == .ready || store.block.phase == .finished else { return }
                if store.change({ block in
                    block = Block()
                    block.title = b.arg.isEmpty ? b.mat : b.arg
                    block.minutes = b.min
                    block.outline = b.cons
                    block.materials = b.mats
                    block.criterion = b.cons.components(separatedBy: .newlines).filter {
                        $0.localizedCaseInsensitiveContains("verifica finale")
                    }.joined(separator: "\n")
                }) { dismiss() }
            }
        }
        .alert("Piano", isPresented: Binding(get: { plan.message != nil }, set: { if !$0 { plan.message = nil } })) {
            Button("OK") { plan.message = nil }
        } message: { Text(plan.message ?? "") }
    }
}

struct PlanAnalysis: View {
    let blocks: [PlannedBlock]
    var body: some View {
        List {
            if blocks.isEmpty { Text("Importa il piano offline nella sezione Piano.") }
            ForEach(Dictionary(grouping: blocks, by: \.mat).keys.sorted(), id: \.self) { subject in
                let items = blocks.filter { $0.mat == subject }
                Section(subject) {
                    LabeledContent("Blocchi", value: "\(items.count)")
                    LabeledContent("Minuti previsti", value: "\(items.reduce(0) { $0 + $1.min })")
                    LabeledContent("Minuti registrati nel piano", value: "\(items.reduce(0) { $0 + $1.fatti })")
                }
            }
        }.navigationTitle("Analisi del piano")
    }
}
