import SwiftUI

struct FocusView: View {
    @ObservedObject var store: Store
    @State private var confirm = false
    private var block: Block { store.block }
    private let web = "https://pebdock.github.io/studioos-focus/"

    private func field<T>(_ key: WritableKeyPath<Block, T>) -> Binding<T> {
        Binding(get: { store.block[keyPath: key] }, set: { value in
            store.change { $0[keyPath: key] = value }
        })
    }

    var body: some View {
        NavigationStack {
            Form {
                if block.phase == .ready {
                    Section("Prepara il blocco") {
                        TextField("Titolo", text: field(\.title))
                        Stepper("Durata · \(block.minutes) min", value: field(\.minutes), in: 1...240)
                        TextField("Scaletta, un passo per riga", text: field(\.outline), axis: .vertical)
                        TextField("Materiali e riferimenti", text: field(\.materials), axis: .vertical)
                        TextField("Criterio di completamento", text: field(\.criterion), axis: .vertical)
                        Button("Avvia blocco") { store.change { $0.start(at: .now) } }
                            .disabled(!block.configured)
                    }
                } else {
                    Section {
                        Text(block.title).font(.title2.bold())
                        if block.phase == .running, let end = block.deadline {
                            Text(timerInterval: min(Date.now, end)...end, countsDown: true)
                                .font(.largeTitle.monospacedDigit()).accessibilityLabel("Tempo rimanente")
                            Button("Pausa") { store.change { $0.pause(at: .now) } }
                        } else if block.phase == .paused {
                            Text(Duration.seconds(Int(ceil(block.pausedSeconds))).formatted(.time(pattern: .minuteSecond)))
                                .font(.largeTitle.monospacedDigit())
                            Button("Riprendi") { store.change { $0.start(at: .now) } }
                        } else {
                            Label("Blocco completato", systemImage: "checkmark.circle")
                        }
                    } header: { Text(block.phase == .paused ? "In pausa" : "Blocco") }
                    if !block.steps.isEmpty {
                        Section("Scaletta") {
                            ForEach(Array(block.steps.enumerated()), id: \.offset) { index, step in
                                Button {
                                    store.change { b in
                                        if b.checked.contains(index) { b.checked.remove(index) }
                                        else { b.checked.insert(index) }
                                    }
                                } label: {
                                    Label(step, systemImage: block.checked.contains(index) ? "checkmark.circle.fill" : "circle")
                                }
                                .accessibilityValue(block.checked.contains(index) ? "Fatto" : "Da fare")
                                .disabled(block.phase == .finished)
                            }
                        }
                    }
                    if !block.materials.isEmpty { Section("Materiali") { Text(block.materials).textSelection(.enabled) } }
                    Section("Criterio di completamento") {
                        Text(block.criterion)
                        if block.phase == .finished {
                            Button("Prepara un nuovo blocco") { store.change { $0 = Block() } }
                        } else { Button("Verifica e concludi") { confirm = true } }
                    }
                }
                Section("Nel browser") {
                    Link("Piano", destination: URL(string: web + "#piano")!)
                    Link("Viaggi della settimana · in Analisi", destination: URL(string: web + "#settimana")!)
                    Link("Analisi", destination: URL(string: web + "#settimana")!)
                    Link("Ripasso", destination: URL(string: web + "ripasso/")!)
                }
            }
            .navigationTitle("Studio")
            .confirmationDialog("Hai soddisfatto il criterio?", isPresented: $confirm, titleVisibility: .visible) {
                Button("Conferma completamento") { store.change { $0.finish() } }
            } message: { Text(block.criterion) }
            .alert("STUDIOOS Focus", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
                Button("OK") { store.error = nil }
            } message: { Text(store.error ?? "") }
        }
    }
}
