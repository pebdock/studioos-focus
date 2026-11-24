import SwiftUI


struct LocalPage: UIViewRepresentable {
    let path: String
    var blocks: [PlannedBlock] = []

    func makeUIView(context: Context) -> OfflineReader {
        let rows: [[String: Any]] = blocks.enumerated().map { offset, b in
            ["id": b.id, "row": offset + 6, "date": b.date, "from": b.from, "to": b.to, "mat": b.mat,
             "min": b.min, "stato": b.stato, "fatti": b.fatti, "cons": b.cons]
        }
        return OfflineReader(page: path, rows: rows)
    }
    func updateUIView(_ uiView: OfflineReader, context: Context) {}
}
