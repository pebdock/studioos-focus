import Foundation

let start = Date(timeIntervalSince1970: 100)
var b = Block()
b.start(at: start)
precondition(b.phase == .ready)
b.title = "Sintetico"
b.criterion = "Verificare il risultato"
b.minutes = 2
b.start(at: start)
precondition(b.remaining(at: start + 45) == 75)
b.start(at: start + 45)
precondition(b.deadline == start + 120)
b.pause(at: start + 45)
b.checked.insert(0)
let bytes = try JSONEncoder().encode(b)
var restored = try JSONDecoder().decode(Block.self, from: bytes)
precondition(restored == b && restored.remaining(at: start + 500) == 75)
restored.start(at: start + 500)
precondition(restored.deadline == start + 575)
let reopened = try JSONDecoder().decode(Block.self, from: JSONEncoder().encode(restored))
precondition(reopened.remaining(at: start + 580) == 0 && reopened.phase == .running)
restored.finish()
precondition(restored.phase == .finished)
print("OK: avvio, idempotenza, pausa, archivio, sospensione, scadenza e conferma.")
